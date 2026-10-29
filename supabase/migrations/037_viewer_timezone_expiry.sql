-- Run in Supabase Dashboard → SQL Editor → New Query
-- Stored timestamps stay UTC; when a dated offer stops counting is the end of
-- its last day in the *viewer's* time zone. The app passes the viewer's "today"
-- into the chip counts, and the database-wide read policies only have to be wide
-- enough for every zone (the app trims per viewer).

-- 1. Chip counts take the viewer's today (defaults to the UTC day). New signature: drop the old one.
DROP FUNCTION IF EXISTS public.board_topic_counts(public.board_post_kind);

CREATE OR REPLACE FUNCTION public.board_topic_counts(p_kind public.board_post_kind DEFAULT NULL, p_today DATE DEFAULT NULL)
RETURNS TABLE (topic_id UUID, n BIGINT)
LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT pt.topic_id, count(*)
    FROM board_post_topics pt
    JOIN board_posts p ON p.id = pt.post_id
   WHERE p.deleted_at IS NULL
     AND p.mod_status IN ('clean', 'unscanned')
     AND p.review IS DISTINCT FROM 'rejected'
     AND (p_kind IS NULL OR p.kind = p_kind)
     AND coalesce(public.board_offer_expiry(p.offer_table, p.offer_id, p.member_offer_id) >= coalesce(p_today, public.utc_today()), TRUE)
   GROUP BY pt.topic_id;
$$;

REVOKE EXECUTE ON FUNCTION public.board_topic_counts(public.board_post_kind, DATE)
  FROM PUBLIC, anon, authenticated;

-- 2. Public read of offers: live in any time zone. The earliest "today" on Earth is UTC-12's (UTC today − 1);
--    evergreen offers (NULL end_date, migration 018) stay visible.
DROP POLICY IF EXISTS "transfer_bonuses_public_read" ON public.transfer_bonuses;
CREATE POLICY "transfer_bonuses_public_read" ON public.transfer_bonuses
  FOR SELECT
  USING (active = true AND (end_date IS NULL OR end_date >= public.utc_today() - 1));

DROP POLICY IF EXISTS "spending_bonuses_public_read" ON public.spending_bonuses;
CREATE POLICY "spending_bonuses_public_read" ON public.spending_bonuses
  FOR SELECT
  USING (active = true AND (end_date IS NULL OR end_date >= public.utc_today() - 1));
