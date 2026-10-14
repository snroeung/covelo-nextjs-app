-- Run in Supabase Dashboard → SQL Editor → New Query
-- The Board (/discover/board): member travel tips + offer posts, topics,
-- threaded comments, votes, saves. Moderation columns/tables are in 026.
--
-- Access model: every board table denies anon/authenticated outright. All
-- reads and writes go through server/routers/board.ts with the service role,
-- which applies visibility (held/removed/rejected), rate limits and
-- moderation before touching a row. Same reasoning as booking_reports (024):
-- user_id/author_id must never be readable straight off PostgREST.

-- ─── Catalog additions ───────────────────────────────────────────────────────
-- `source` already says where a catalog row came from (014). A member-created
-- offer published by an admin is source = 'member' — no separate `origin`.

ALTER TABLE public.transfer_bonuses DROP CONSTRAINT IF EXISTS transfer_bonuses_source_check;
ALTER TABLE public.transfer_bonuses
  ADD CONSTRAINT transfer_bonuses_source_check CHECK (source IN ('admin', 'cron', 'member')),
  ADD COLUMN post_to_board    BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN board_topic      TEXT,
  -- NULL = keep auto-generating from the offer (lib/board/genPost.ts)
  ADD COLUMN board_post_title TEXT,
  ADD COLUMN board_post_body  TEXT;

ALTER TABLE public.spending_bonuses DROP CONSTRAINT IF EXISTS spending_bonuses_source_check;
ALTER TABLE public.spending_bonuses
  ADD CONSTRAINT spending_bonuses_source_check CHECK (source IN ('admin', 'cron', 'member')),
  ADD COLUMN post_to_board    BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN board_topic      TEXT,
  ADD COLUMN board_post_title TEXT,
  ADD COLUMN board_post_body  TEXT;

-- ─── Enums ───────────────────────────────────────────────────────────────────

CREATE TYPE public.board_post_kind AS ENUM ('tip', 'offer');
CREATE TYPE public.board_review    AS ENUM ('pending', 'approved', 'rejected');

-- ─── board_topics ────────────────────────────────────────────────────────────

CREATE TABLE public.board_topics (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Display name, normalized by lib/board/topics.ts normalizeTopic()
  name           TEXT NOT NULL CHECK (char_length(name) BETWEEN 2 AND 28),
  -- Dedupe key, lib/board/topics.ts topicKey(): lowercase, "&"/"and" dropped,
  -- hyphens → spaces, last word singularized. "Award-Flights" → "award flight"
  key            TEXT NOT NULL UNIQUE,
  -- common: seeded/promoted, always a chip · provisional: new, author-only ·
  -- active: ≥2 distinct authors · dormant: no posts in 60 d · hidden: admin/merged
  status         TEXT NOT NULL DEFAULT 'provisional'
                   CHECK (status IN ('common', 'provisional', 'active', 'dormant', 'hidden')),
  merged_into_id UUID REFERENCES public.board_topics(id) ON DELETE SET NULL,
  created_by     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  last_post_at   TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (merged_into_id IS NULL OR merged_into_id <> id)
);

INSERT INTO public.board_topics (name, key, status) VALUES
  ('Transfer bonuses',  'transfer bonus',   'common'),
  ('Hotels',            'hotel',            'common'),
  ('Award flights',     'award flight',     'common'),
  ('Statement credits', 'statement credit', 'common');

-- ─── board_member_offers ─────────────────────────────────────────────────────
-- Offers a member created in the composer. Board-only until an admin publishes
-- one through the offer editor, which inserts the catalog row and repoints
-- the post (published_* set here, post.member_offer_id cleared).

CREATE TABLE public.board_member_offers (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type            TEXT NOT NULL CHECK (type IN (
                    'TRANSFER BONUS', 'PARTNER DEAL', 'STATEMENT CREDIT',
                    'SIGN-UP BONUS', 'FREE NIGHT', 'PACKAGE')),
  value           TEXT NOT NULL CHECK (char_length(value) BETWEEN 1 AND 24),     -- "+25%", "5×", "$100"
  name            TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
  from_program    TEXT NOT NULL CHECK (char_length(from_program) BETWEEN 1 AND 80),
  to_program      TEXT CHECK (char_length(to_program) <= 80),
  conditions      TEXT CHECK (char_length(conditions) <= 300),
  ends_label      TEXT CHECK (char_length(ends_label) <= 40),                    -- free text ("Jun 30")
  source_url      TEXT CHECK (char_length(source_url) <= 2000),
  published_table TEXT CHECK (published_table IN ('transfer_bonuses', 'spending_bonuses')),
  published_id    UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK ((published_table IS NULL) = (published_id IS NULL))
);

-- ─── board_posts ─────────────────────────────────────────────────────────────

CREATE TABLE public.board_posts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind            public.board_post_kind NOT NULL,
  -- NULL only for covelo system posts (admin-published offers)
  author_id       UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  is_system       BOOLEAN NOT NULL DEFAULT false,
  -- Primary topic, shown in card meta. All topics (1–5) are in board_post_topics.
  topic_id        UUID REFERENCES public.board_topics(id) ON DELETE SET NULL,
  title           TEXT NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
  body            TEXT NOT NULL DEFAULT '' CHECK (char_length(body) <= 10000),
  -- Router-filled at write time: author name, topic names, offer name/from/to.
  -- Lets search hit joined fields without a trigger chasing every rename.
  search_extra    TEXT NOT NULL DEFAULT '',
  search_tsv      TSVECTOR GENERATED ALWAYS AS (
                    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
                    setweight(to_tsvector('english', coalesce(body, '')), 'B') ||
                    setweight(to_tsvector('english', coalesce(search_extra, '')), 'C')
                  ) STORED,
  -- Offer linkage (kind = 'offer' only): a catalog row XOR a member offer
  offer_table     TEXT CHECK (offer_table IN ('transfer_bonuses', 'spending_bonuses')),
  offer_id        UUID,
  member_offer_id UUID REFERENCES public.board_member_offers(id) ON DELETE RESTRICT,
  -- Verification (offers only; tips are always NULL)
  review          public.board_review,
  verified_by     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  verified_at     TIMESTAMPTZ,
  reject_reason   TEXT,
  score           INTEGER NOT NULL DEFAULT 0,   -- denormalized sum of votes
  comment_count   INTEGER NOT NULL DEFAULT 0,   -- denormalized, excludes soft-deleted
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at      TIMESTAMPTZ,
  CONSTRAINT board_posts_author_xor_system CHECK ((author_id IS NULL) = is_system),
  CONSTRAINT board_posts_tip_has_no_review CHECK (kind = 'offer' OR review IS NULL),
  CONSTRAINT board_posts_offer_has_review  CHECK (kind = 'tip' OR review IS NOT NULL),
  CONSTRAINT board_posts_tip_has_no_offer  CHECK (kind = 'offer' OR (offer_id IS NULL AND member_offer_id IS NULL)),
  CONSTRAINT board_posts_offer_has_one_link CHECK (kind = 'tip' OR ((offer_id IS NOT NULL) <> (member_offer_id IS NOT NULL))),
  CONSTRAINT board_posts_offer_table_pair  CHECK ((offer_table IS NULL) = (offer_id IS NULL)),
  CONSTRAINT board_posts_reject_has_reason CHECK (review IS DISTINCT FROM 'rejected' OR reject_reason IS NOT NULL)
);

CREATE INDEX board_posts_recent_idx  ON public.board_posts (created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX board_posts_topic_idx   ON public.board_posts (topic_id);
CREATE INDEX board_posts_review_idx  ON public.board_posts (review) WHERE kind = 'offer';
CREATE INDEX board_posts_search_idx  ON public.board_posts USING GIN (search_tsv);
CREATE INDEX board_posts_offer_idx   ON public.board_posts (offer_table, offer_id) WHERE offer_id IS NOT NULL;
-- One covelo system post per catalog offer (editor "Post to board" upserts it)
CREATE UNIQUE INDEX board_posts_system_offer_uq
  ON public.board_posts (offer_table, offer_id) WHERE is_system AND deleted_at IS NULL;

-- ─── board_post_topics ───────────────────────────────────────────────────────
-- 1–5 topics per post, ≤3 of them created by that post (lib/board/limits.ts).

CREATE TABLE public.board_post_topics (
  post_id     UUID NOT NULL REFERENCES public.board_posts(id) ON DELETE CASCADE,
  topic_id    UUID NOT NULL REFERENCES public.board_topics(id) ON DELETE CASCADE,
  is_primary  BOOLEAN NOT NULL DEFAULT false,
  -- This post created the topic — backs the 3-new-topics-per-post cap
  created_new BOOLEAN NOT NULL DEFAULT false,
  PRIMARY KEY (post_id, topic_id)
);

CREATE INDEX board_post_topics_topic_idx ON public.board_post_topics (topic_id);
CREATE UNIQUE INDEX board_post_topics_one_primary ON public.board_post_topics (post_id) WHERE is_primary;

-- ─── board_comments ──────────────────────────────────────────────────────────

CREATE TABLE public.board_comments (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id    UUID NOT NULL REFERENCES public.board_posts(id) ON DELETE CASCADE,
  parent_id  UUID REFERENCES public.board_comments(id) ON DELETE CASCADE,
  author_id  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body       TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 5000),
  score      INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  CHECK (parent_id IS NULL OR parent_id <> id)
);

CREATE INDEX board_comments_post_idx   ON public.board_comments (post_id, created_at);
CREATE INDEX board_comments_parent_idx ON public.board_comments (parent_id) WHERE parent_id IS NOT NULL;

-- ─── board_votes ─────────────────────────────────────────────────────────────
-- One row per user per target. A composite PK can't hold the nullable target
-- columns, so uniqueness is two partial indexes.

CREATE TABLE public.board_votes (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  post_id      UUID REFERENCES public.board_posts(id) ON DELETE CASCADE,
  comment_id   UUID REFERENCES public.board_comments(id) ON DELETE CASCADE,
  value        SMALLINT NOT NULL CHECK (value IN (-1, 1)),
  -- Backs the vote-flap limit (BOARD_PER_POST_LIMITS.voteChangesPerTarget)
  change_count INTEGER NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK ((post_id IS NOT NULL) <> (comment_id IS NOT NULL))
);

CREATE UNIQUE INDEX board_votes_post_uq    ON public.board_votes (user_id, post_id)    WHERE post_id IS NOT NULL;
CREATE UNIQUE INDEX board_votes_comment_uq ON public.board_votes (user_id, comment_id) WHERE comment_id IS NOT NULL;
CREATE INDEX board_votes_user_recent_idx   ON public.board_votes (user_id, updated_at DESC);

-- ─── board_saves ─────────────────────────────────────────────────────────────

CREATE TABLE public.board_saves (
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  post_id      UUID NOT NULL REFERENCES public.board_posts(id) ON DELETE CASCADE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, post_id)
);

-- ─── Triggers ────────────────────────────────────────────────────────────────

-- Score: keep board_posts.score / board_comments.score equal to the vote sum.
CREATE OR REPLACE FUNCTION public.board_votes_apply()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  delta INTEGER;
BEGIN
  IF TG_OP = 'INSERT' THEN
    delta := NEW.value;
  ELSIF TG_OP = 'DELETE' THEN
    delta := -OLD.value;
  ELSE
    delta := NEW.value - OLD.value;
  END IF;

  IF delta <> 0 THEN
    IF coalesce(NEW.post_id, OLD.post_id) IS NOT NULL THEN
      UPDATE board_posts SET score = score + delta WHERE id = coalesce(NEW.post_id, OLD.post_id);
    ELSE
      UPDATE board_comments SET score = score + delta WHERE id = coalesce(NEW.comment_id, OLD.comment_id);
    END IF;
  END IF;

  RETURN NULL;
END;
$$;

CREATE TRIGGER board_votes_apply_trg
  AFTER INSERT OR UPDATE OF value OR DELETE ON public.board_votes
  FOR EACH ROW EXECUTE FUNCTION public.board_votes_apply();

-- Count vote changes + stamp updated_at on a changed value
CREATE OR REPLACE FUNCTION public.board_votes_touch()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.value IS DISTINCT FROM OLD.value THEN
    NEW.change_count := OLD.change_count + 1;
    NEW.updated_at := NOW();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER board_votes_touch_trg
  BEFORE UPDATE ON public.board_votes
  FOR EACH ROW EXECUTE FUNCTION public.board_votes_touch();

-- Author's own +1 on every new post/comment (design: myVote = 1 at create)
CREATE OR REPLACE FUNCTION public.board_author_self_vote()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.author_id IS NOT NULL THEN
    IF TG_TABLE_NAME = 'board_posts' THEN
      INSERT INTO board_votes (user_id, post_id, value) VALUES (NEW.author_id, NEW.id, 1);
    ELSE
      INSERT INTO board_votes (user_id, comment_id, value) VALUES (NEW.author_id, NEW.id, 1);
    END IF;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER board_posts_self_vote_trg
  AFTER INSERT ON public.board_posts
  FOR EACH ROW EXECUTE FUNCTION public.board_author_self_vote();

CREATE TRIGGER board_comments_self_vote_trg
  AFTER INSERT ON public.board_comments
  FOR EACH ROW EXECUTE FUNCTION public.board_author_self_vote();

-- comment_count: recount visible comments on any change that affects it
CREATE OR REPLACE FUNCTION public.board_comments_recount()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  pid UUID := coalesce(NEW.post_id, OLD.post_id);
BEGIN
  UPDATE board_posts
     SET comment_count = (SELECT count(*) FROM board_comments WHERE post_id = pid AND deleted_at IS NULL)
   WHERE id = pid;
  RETURN NULL;
END;
$$;

CREATE TRIGGER board_comments_recount_trg
  AFTER INSERT OR UPDATE OF deleted_at OR DELETE ON public.board_comments
  FOR EACH ROW EXECUTE FUNCTION public.board_comments_recount();

-- updated_at on content edits
CREATE OR REPLACE FUNCTION public.board_touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER board_posts_touch_trg
  BEFORE UPDATE OF title, body ON public.board_posts
  FOR EACH ROW EXECUTE FUNCTION public.board_touch_updated_at();

CREATE TRIGGER board_comments_touch_trg
  BEFORE UPDATE OF body ON public.board_comments
  FOR EACH ROW EXECUTE FUNCTION public.board_touch_updated_at();

-- ─── RLS: deny all clients ───────────────────────────────────────────────────
-- RLS on with no policies = no client access. Service role bypasses RLS.

ALTER TABLE public.board_topics        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.board_member_offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.board_posts         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.board_post_topics   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.board_comments      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.board_votes         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.board_saves         ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.board_topics, public.board_member_offers, public.board_posts,
  public.board_post_topics, public.board_comments, public.board_votes, public.board_saves
  FROM anon, authenticated;
