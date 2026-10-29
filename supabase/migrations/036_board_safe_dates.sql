-- Run in Supabase Dashboard → SQL Editor → New Query
-- One date rule for offer expiry: a member-entered end date that is not a real
-- calendar day ("2026-02-31") reads as "no end date" instead of raising an error
-- in the feed, chip counts, activity and purge queries; and "today" is the UTC
-- day everywhere, matching todayIso() in lib/offers/live.ts.

-- 1. Today, in UTC, whatever the session time zone.
CREATE OR REPLACE FUNCTION public.utc_today()
RETURNS DATE
LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT (now() AT TIME ZONE 'UTC')::DATE;
$$;

-- 2. Text → DATE, or NULL when it is not a real YYYY-MM-DD day.
CREATE OR REPLACE FUNCTION public.board_try_date(p_text TEXT)
RETURNS DATE
LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $$
BEGIN
  IF p_text IS NULL OR p_text !~ '^\d{4}-\d{2}-\d{2}$' THEN RETURN NULL; END IF;
  RETURN p_text::DATE;
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$$;

-- 3. Same signature as 034, so the feed view keeps working.
CREATE OR REPLACE FUNCTION public.board_offer_expiry(p_offer_table TEXT, p_offer_id UUID, p_member_offer_id UUID)
RETURNS DATE
LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT CASE
    WHEN p_offer_table = 'transfer_bonuses' THEN (SELECT t.end_date FROM transfer_bonuses t WHERE t.id = p_offer_id)
    WHEN p_offer_table = 'spending_bonuses' THEN (SELECT s.end_date FROM spending_bonuses s WHERE s.id = p_offer_id)
    WHEN p_member_offer_id IS NOT NULL THEN (
      SELECT public.board_try_date(m.details->>'end_date') FROM board_member_offers m WHERE m.id = p_member_offer_id
    )
  END;
$$;

-- 4. Counts and activity compare against the UTC day.
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
     AND coalesce(public.board_offer_expiry(p.offer_table, p.offer_id, p.member_offer_id) >= public.utc_today(), TRUE)
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
     AND coalesce(public.board_offer_expiry(p.offer_table, p.offer_id, p.member_offer_id) >= public.utc_today(), TRUE)
   GROUP BY pt.topic_id;
$$;

REVOKE EXECUTE ON FUNCTION public.board_topic_counts(public.board_post_kind), public.board_topic_activity()
  FROM PUBLIC, anon, authenticated;
