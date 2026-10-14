-- Run in Supabase Dashboard → SQL Editor → New Query
-- The Board — moderation, reports, author standing, smart-topic support,
-- rate-limit indexes and the feed view. Depends on 025_board.sql.
-- Same access model as 025: no client access; server/routers/board.ts uses
-- the service role.

CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;

-- ─── Moderation state on posts + comments ────────────────────────────────────
-- unscanned: stages 1–2 clean, LLM skipped/timed out — visible, cron rescans
-- clean: passed · held: author + admins only · removed: taken down by an admin

CREATE TYPE public.board_mod_status AS ENUM ('clean', 'unscanned', 'held', 'removed');

ALTER TABLE public.board_posts
  ADD COLUMN mod_status         public.board_mod_status NOT NULL DEFAULT 'unscanned',
  ADD COLUMN mod_reasons        TEXT[] NOT NULL DEFAULT '{}',   -- why held (MOD_REASONS)
  ADD COLUMN mod_flags          TEXT[] NOT NULL DEFAULT '{}',   -- allowed but notable (MOD_FLAGS)
  ADD COLUMN mod_scores         JSONB,                          -- classifier output
  ADD COLUMN mod_model          TEXT,
  ADD COLUMN suggested_topic_id UUID REFERENCES public.board_topics(id) ON DELETE SET NULL,
  ADD COLUMN comments_locked    BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN removed_by         UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN removed_at         TIMESTAMPTZ,
  ADD COLUMN removed_reason     TEXT,
  ADD COLUMN removed_note       TEXT CHECK (char_length(removed_note) <= 500),
  ADD CONSTRAINT board_posts_removed_fields CHECK ((mod_status = 'removed') = (removed_at IS NOT NULL));

ALTER TABLE public.board_comments
  ADD COLUMN mod_status     public.board_mod_status NOT NULL DEFAULT 'unscanned',
  ADD COLUMN mod_reasons    TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN mod_flags      TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN mod_scores     JSONB,
  ADD COLUMN mod_model      TEXT,
  ADD COLUMN removed_by     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN removed_at     TIMESTAMPTZ,
  ADD COLUMN removed_reason TEXT,
  ADD COLUMN removed_note   TEXT CHECK (char_length(removed_note) <= 500),
  ADD CONSTRAINT board_comments_removed_fields CHECK ((mod_status = 'removed') = (removed_at IS NOT NULL));

-- Moderation queue + rescan cron
CREATE INDEX board_posts_mod_queue_idx    ON public.board_posts (mod_status, created_at) WHERE mod_status IN ('held', 'unscanned');
CREATE INDEX board_comments_mod_queue_idx ON public.board_comments (mod_status, created_at) WHERE mod_status IN ('held', 'unscanned');

-- ─── Rate-limit indexes (lib/board/limits.ts) ────────────────────────────────

CREATE INDEX board_posts_author_recent_idx         ON public.board_posts (author_id, created_at DESC);
CREATE INDEX board_comments_author_recent_idx      ON public.board_comments (author_id, created_at DESC);
CREATE INDEX board_comments_author_post_recent_idx ON public.board_comments (author_id, post_id, created_at DESC);
CREATE INDEX board_topics_creator_recent_idx       ON public.board_topics (created_by, created_at DESC);

-- ─── Smart topics ────────────────────────────────────────────────────────────

CREATE INDEX board_topics_key_trgm_idx ON public.board_topics USING GIN (key extensions.gin_trgm_ops);

-- Extra dedupe keys that resolve to a topic: merged-away topics' keys and
-- admin-added synonyms ("airport lounge" → Lounges).
CREATE TABLE public.board_topic_aliases (
  key        TEXT PRIMARY KEY,
  topic_id   UUID NOT NULL REFERENCES public.board_topics(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX board_topic_aliases_topic_idx    ON public.board_topic_aliases (topic_id);
CREATE INDEX board_topic_aliases_key_trgm_idx ON public.board_topic_aliases USING GIN (key extensions.gin_trgm_ops);

-- Dedupe ladder step 3–4 (plan §12.2): topics whose key or alias key is
-- trigram-similar to `q` (already passed through topicKey()). Hidden topics
-- resolve to their merge target.
CREATE OR REPLACE FUNCTION public.board_similar_topics(q TEXT, min_similarity REAL DEFAULT 0.6)
RETURNS TABLE (id UUID, name TEXT, key TEXT, status TEXT, similarity REAL)
LANGUAGE sql STABLE SET search_path = public, extensions AS $$
  WITH candidates AS (
    SELECT t.id, extensions.similarity(t.key, q) AS sim
      FROM board_topics t
     WHERE t.key OPERATOR(extensions.%) q OR t.key = q
    UNION ALL
    SELECT a.topic_id, extensions.similarity(a.key, q)
      FROM board_topic_aliases a
     WHERE a.key OPERATOR(extensions.%) q OR a.key = q
  ),
  resolved AS (
    SELECT coalesce(t.merged_into_id, t.id) AS id, max(c.sim) AS sim
      FROM candidates c
      JOIN board_topics t ON t.id = c.id
     GROUP BY coalesce(t.merged_into_id, t.id)
  )
  SELECT t.id, t.name, t.key, t.status, r.sim::REAL
    FROM resolved r
    JOIN board_topics t ON t.id = r.id
   WHERE r.sim >= min_similarity AND t.status <> 'hidden'
   ORDER BY r.sim DESC, t.name
   LIMIT 5;
$$;

-- Topic lifecycle (plan §12.3). Visible = not deleted, not held/removed, not a
-- rejected offer. provisional → active at ≥2 distinct authors; dormant → active
-- on a fresh post. common/hidden never change here.
CREATE OR REPLACE FUNCTION public.board_refresh_topic(tid UUID)
RETURNS VOID LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  authors  INTEGER;
  last_at  TIMESTAMPTZ;
BEGIN
  SELECT count(DISTINCT coalesce(p.author_id::TEXT, 'system')), max(p.created_at)
    INTO authors, last_at
    FROM board_post_topics pt
    JOIN board_posts p ON p.id = pt.post_id
   WHERE pt.topic_id = tid
     AND p.deleted_at IS NULL
     AND p.mod_status IN ('clean', 'unscanned')
     AND p.review IS DISTINCT FROM 'rejected';

  UPDATE board_topics
     SET last_post_at = last_at,
         status = CASE
           WHEN status = 'provisional' AND authors >= 2 THEN 'active'
           WHEN status = 'dormant' AND last_at > NOW() - INTERVAL '60 days' THEN 'active'
           ELSE status
         END
   WHERE id = tid;
END;
$$;

CREATE OR REPLACE FUNCTION public.board_post_topics_refresh()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  PERFORM board_refresh_topic(coalesce(NEW.topic_id, OLD.topic_id));
  RETURN NULL;
END;
$$;

CREATE TRIGGER board_post_topics_refresh_trg
  AFTER INSERT OR DELETE ON public.board_post_topics
  FOR EACH ROW EXECUTE FUNCTION public.board_post_topics_refresh();

CREATE OR REPLACE FUNCTION public.board_posts_refresh_topics()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  tid UUID;
BEGIN
  FOR tid IN SELECT topic_id FROM board_post_topics WHERE post_id = NEW.id LOOP
    PERFORM board_refresh_topic(tid);
  END LOOP;
  RETURN NULL;
END;
$$;

CREATE TRIGGER board_posts_refresh_topics_trg
  AFTER UPDATE OF mod_status, deleted_at, review ON public.board_posts
  FOR EACH ROW
  WHEN (OLD.mod_status IS DISTINCT FROM NEW.mod_status
     OR OLD.deleted_at IS DISTINCT FROM NEW.deleted_at
     OR OLD.review IS DISTINCT FROM NEW.review)
  EXECUTE FUNCTION public.board_posts_refresh_topics();

-- Cron (scripts/board/rescan.ts, Phase 8): active topics quiet for 60 days.
CREATE OR REPLACE FUNCTION public.board_mark_dormant_topics()
RETURNS INTEGER LANGUAGE sql SET search_path = public AS $$
  WITH changed AS (
    UPDATE board_topics
       SET status = 'dormant'
     WHERE status = 'active'
       AND (last_post_at IS NULL OR last_post_at < NOW() - INTERVAL '60 days')
    RETURNING 1
  )
  SELECT count(*)::INTEGER FROM changed;
$$;

-- Duplicate check (plan §8.2): highest title similarity among the author's
-- posts since `since`.
CREATE OR REPLACE FUNCTION public.board_max_title_similarity(p_author UUID, p_title TEXT, p_since TIMESTAMPTZ)
RETURNS REAL LANGUAGE sql STABLE SET search_path = public, extensions AS $$
  SELECT coalesce(max(extensions.similarity(lower(p.title), lower(p_title))), 0)::REAL
    FROM board_posts p
   WHERE p.author_id = p_author
     AND p.created_at >= p_since
     AND p.deleted_at IS NULL;
$$;

-- ─── Reports ─────────────────────────────────────────────────────────────────

CREATE TABLE public.board_reports (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_kind TEXT NOT NULL CHECK (target_kind IN ('post', 'comment')),
  target_id   UUID NOT NULL,
  reporter_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason      TEXT NOT NULL CHECK (reason IN (
                'Offensive', 'Off-topic', 'Spam', 'Referral link', 'Misleading offer', 'Other')),
  note        TEXT CHECK (char_length(note) <= 500),
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (reporter_id, target_kind, target_id)
);

CREATE INDEX board_reports_target_idx          ON public.board_reports (target_kind, target_id) WHERE resolved_at IS NULL;
CREATE INDEX board_reports_reporter_recent_idx ON public.board_reports (reporter_id, created_at DESC);

-- ─── Audit log ───────────────────────────────────────────────────────────────
-- Every automatic decision (reject/hold/allow) and every admin action. A
-- rejected create stores only a hash of its content — never the text.

CREATE TABLE public.board_mod_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_kind     TEXT NOT NULL CHECK (target_kind IN ('post', 'comment', 'topic', 'user', 'term')),
  -- NULL for rejected creates (nothing was stored)
  target_id       UUID,
  -- Whose content/account this is about — backs the rejectedCreate rate limit
  subject_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  -- NULL = system (pipeline / cron)
  actor_id        UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action          TEXT NOT NULL CHECK (action IN (
                    'auto_allow', 'auto_hold', 'auto_reject', 'rescan',
                    'take_down', 'restore', 'approve_held', 'set_topic',
                    'lock_comments', 'unlock_comments', 'set_standing', 'rate_lock',
                    'topic_rename', 'topic_merge', 'topic_hide', 'topic_promote',
                    'term_add', 'term_remove', 'reports_hold')),
  reasons         TEXT[] NOT NULL DEFAULT '{}',
  scores          JSONB,
  model           TEXT,
  content_hash    TEXT,
  note            TEXT CHECK (char_length(note) <= 1000),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX board_mod_events_subject_recent_idx ON public.board_mod_events (subject_user_id, action, created_at DESC);
CREATE INDEX board_mod_events_target_idx         ON public.board_mod_events (target_kind, target_id, created_at DESC);

-- ─── Blocklist (admin-editable; code list in lib/board/moderation is the seed) ─

CREATE TABLE public.board_blocked_terms (
  -- Stored already normalized (lib/board/moderation/normalize.ts)
  term       TEXT PRIMARY KEY CHECK (char_length(term) BETWEEN 2 AND 64),
  tier       TEXT NOT NULL CHECK (tier IN ('hard', 'soft')),
  added_by   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Author standing ─────────────────────────────────────────────────────────

CREATE TABLE public.board_user_flags (
  user_id    UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  standing   TEXT NOT NULL CHECK (standing IN ('banned', 'restricted')),
  set_by     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  note       TEXT CHECK (char_length(note) <= 500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Admin flag wins; otherwise admin removals in the last 30 days decide
-- (STANDING_THRESHOLDS: ≥2 watch, ≥4 restricted). Users with neither are
-- absent → 'normal'.
CREATE VIEW public.board_author_standing
WITH (security_invoker = true) AS
  WITH removals AS (
    SELECT author_id AS user_id, count(*) AS n
      FROM (
        SELECT author_id, removed_at FROM public.board_posts    WHERE mod_status = 'removed' AND author_id IS NOT NULL
        UNION ALL
        SELECT author_id, removed_at FROM public.board_comments WHERE mod_status = 'removed'
      ) r
     WHERE removed_at > NOW() - INTERVAL '30 days'
     GROUP BY author_id
  )
  SELECT
    coalesce(f.user_id, r.user_id) AS user_id,
    coalesce(r.n, 0)::INTEGER      AS removals_30d,
    coalesce(
      f.standing,
      CASE WHEN r.n >= 4 THEN 'restricted' WHEN r.n >= 2 THEN 'watch' ELSE 'normal' END
    ) AS standing
  FROM public.board_user_flags f
  FULL OUTER JOIN removals r ON r.user_id = f.user_id;

-- ─── Feed view ───────────────────────────────────────────────────────────────
-- Posts + author display + primary topic + hot score, computed at query time
-- so PostgREST can order by it. Visibility (held/removed/rejected/deleted) is
-- applied by the router per viewer — the view returns everything.

CREATE VIEW public.board_posts_feed
WITH (security_invoker = true) AS
  SELECT
    p.*,
    CASE WHEN p.is_system THEN 'covelo' ELSE coalesce(nullif(trim(pr.display_name), ''), 'Traveler') END AS author_name,
    pr.avatar_url AS author_avatar_url,
    t.name        AS topic_name,
    (p.score / power(extract(epoch FROM (NOW() - p.created_at)) / 3600.0 + 2, 1.4))::DOUBLE PRECISION AS hot_score
  FROM public.board_posts p
  LEFT JOIN public.profiles pr    ON pr.id = p.author_id
  LEFT JOIN public.board_topics t ON t.id = p.topic_id;

-- ─── RLS: deny all clients ───────────────────────────────────────────────────

ALTER TABLE public.board_topic_aliases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.board_reports       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.board_mod_events    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.board_blocked_terms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.board_user_flags    ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.board_topic_aliases, public.board_reports, public.board_mod_events,
  public.board_blocked_terms, public.board_user_flags,
  public.board_author_standing, public.board_posts_feed
  FROM anon, authenticated;

REVOKE EXECUTE ON FUNCTION
  public.board_similar_topics(TEXT, REAL),
  public.board_refresh_topic(UUID),
  public.board_mark_dormant_topics(),
  public.board_max_title_similarity(UUID, TEXT, TIMESTAMPTZ)
  FROM PUBLIC, anon, authenticated;
