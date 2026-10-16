-- Run in Supabase Dashboard → SQL Editor → New Query
-- Feed helpers for server/routers/board.ts (depends on 025–027). Filtering a
-- feed by topic, and counting posts per topic, would otherwise mean sending
-- thousands of post ids in a PostgREST URL.

-- 1. The feed view gains topic_ids (all 1–5 topics on the post) so a topic
--    filter is `topic_ids && {ids}`. Columns are only ever appended.
CREATE OR REPLACE VIEW public.board_posts_feed
WITH (security_invoker = true) AS
  SELECT
    p.*,
    CASE WHEN p.is_system THEN 'covelo' ELSE coalesce(nullif(trim(pr.display_name), ''), 'Traveler') END AS author_name,
    pr.avatar_url AS author_avatar_url,
    t.name        AS topic_name,
    (p.score / power(extract(epoch FROM (NOW() - p.created_at)) / 3600.0 + 2, 1.4))::DOUBLE PRECISION AS hot_score,
    ARRAY(SELECT pt.topic_id FROM public.board_post_topics pt WHERE pt.post_id = p.id) AS topic_ids
  FROM public.board_posts p
  LEFT JOIN public.profiles pr    ON pr.id = p.author_id
  LEFT JOIN public.board_topics t ON t.id = p.topic_id;

-- 2. Chip counts: public-visible posts per topic, optionally one kind.
CREATE OR REPLACE FUNCTION public.board_topic_counts(p_kind public.board_post_kind DEFAULT NULL)
RETURNS TABLE (topic_id UUID, n BIGINT)
LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT pt.topic_id, count(*)
    FROM board_post_topics pt
    JOIN board_posts p ON p.id = pt.post_id
   WHERE p.deleted_at IS NULL
     AND p.mod_status IN ('clean', 'unscanned')
     AND p.review IS DISTINCT FROM 'rejected'
     AND (p_kind IS NULL OR p.kind = p_kind)
   GROUP BY pt.topic_id;
$$;

-- 3. Chip ordering (plan §12.5): posts and distinct authors in the last 30 days.
CREATE OR REPLACE FUNCTION public.board_topic_activity()
RETURNS TABLE (topic_id UUID, posts_30d BIGINT, authors_30d BIGINT)
LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT pt.topic_id, count(*), count(DISTINCT coalesce(p.author_id::TEXT, 'system'))
    FROM board_post_topics pt
    JOIN board_posts p ON p.id = pt.post_id
   WHERE p.created_at > NOW() - INTERVAL '30 days'
     AND p.deleted_at IS NULL
     AND p.mod_status IN ('clean', 'unscanned')
     AND p.review IS DISTINCT FROM 'rejected'
   GROUP BY pt.topic_id;
$$;

REVOKE EXECUTE ON FUNCTION public.board_topic_counts(public.board_post_kind), public.board_topic_activity()
  FROM PUBLIC, anon, authenticated;

-- 4. comment_count is public, so it must not count held comments (only their
--    author and admins can see those). Recount on moderation changes too, so
--    approving a held comment — or holding one — moves the count.
CREATE OR REPLACE FUNCTION public.board_comments_recount()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  pid UUID := coalesce(NEW.post_id, OLD.post_id);
BEGIN
  UPDATE board_posts
     SET comment_count = (
       SELECT count(*) FROM board_comments
        WHERE post_id = pid AND deleted_at IS NULL AND mod_status <> 'held'
     )
   WHERE id = pid;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS board_comments_recount_trg ON public.board_comments;
CREATE TRIGGER board_comments_recount_trg
  AFTER INSERT OR UPDATE OF deleted_at, mod_status OR DELETE ON public.board_comments
  FOR EACH ROW EXECUTE FUNCTION public.board_comments_recount();
