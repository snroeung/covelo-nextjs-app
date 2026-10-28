-- Run in Supabase Dashboard → SQL Editor → New Query
-- An offer post is only worth reading while its offer is live. Expiry is read
-- from the offer itself (catalog end_date, or the end date a member entered),
-- so extending an offer's end date brings its post back — nothing is deleted.
-- The feed, search, saved lists and chip counts all hide expired offer posts;
-- a direct link still opens the post.

-- 1. When an offer post's offer ends: NULL when there is no offer, no end date, or an end date we cannot read.
CREATE OR REPLACE FUNCTION public.board_offer_expiry(p_offer_table TEXT, p_offer_id UUID, p_member_offer_id UUID)
RETURNS DATE
LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT CASE
    WHEN p_offer_table = 'transfer_bonuses' THEN (SELECT t.end_date FROM transfer_bonuses t WHERE t.id = p_offer_id)
    WHEN p_offer_table = 'spending_bonuses' THEN (SELECT s.end_date FROM spending_bonuses s WHERE s.id = p_offer_id)
    WHEN p_member_offer_id IS NOT NULL THEN (
      SELECT CASE WHEN m.details->>'end_date' ~ '^\d{4}-\d{2}-\d{2}$' THEN (m.details->>'end_date')::DATE END
        FROM board_member_offers m WHERE m.id = p_member_offer_id
    )
  END;
$$;

-- 2. The feed view gains the expiry as a last column (CREATE OR REPLACE may only append).
CREATE OR REPLACE VIEW public.board_posts_feed
WITH (security_invoker = true) AS
  SELECT
    p.*,
    CASE WHEN p.is_system THEN 'covelo' ELSE coalesce(nullif(trim(pr.display_name), ''), 'Traveler') END AS author_name,
    pr.avatar_url AS author_avatar_url,
    t.name        AS topic_name,
    (p.score / power(extract(epoch FROM (NOW() - p.created_at)) / 3600.0 + 2, 1.4))::DOUBLE PRECISION AS hot_score,
    ARRAY(SELECT pt.topic_id FROM public.board_post_topics pt WHERE pt.post_id = p.id) AS topic_ids,
    public.board_offer_expiry(p.offer_table, p.offer_id, p.member_offer_id) AS offer_expires_on
  FROM public.board_posts p
  LEFT JOIN public.profiles pr    ON pr.id = p.author_id
  LEFT JOIN public.board_topics t ON t.id = p.topic_id;

-- 3. Chip counts and ordering agree with the lists: expired offers are not counted.
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
     AND coalesce(public.board_offer_expiry(p.offer_table, p.offer_id, p.member_offer_id) >= CURRENT_DATE, TRUE)
   GROUP BY pt.topic_id;
$$;

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
     AND coalesce(public.board_offer_expiry(p.offer_table, p.offer_id, p.member_offer_id) >= CURRENT_DATE, TRUE)
   GROUP BY pt.topic_id;
$$;

REVOKE EXECUTE ON FUNCTION public.board_topic_counts(public.board_post_kind), public.board_topic_activity()
  FROM PUBLIC, anon, authenticated;
