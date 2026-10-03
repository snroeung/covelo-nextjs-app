-- Run in Supabase Dashboard → SQL Editor → New Query
-- booking_reports: what travellers actually saw after clicking through to a
-- booking option (portal or transfer partner) from a Covelo comparison.
-- Shared with every viewer of the same itinerary/room, so reads are public;
-- writes are the signed-in reporter's own rows only, and rows are immutable.

CREATE TABLE public.booking_reports (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Snapshot of profiles.display_name so the public read never joins profiles
  reporter_name    TEXT NOT NULL DEFAULT 'Traveler',
  subject_type     TEXT NOT NULL CHECK (subject_type IN ('flight', 'hotel')),
  -- Normalized itinerary / room identity — see lib/reports/subject.ts
  subject_key      TEXT NOT NULL,
  -- OptionRowView.key — portal id or transfer program
  option_key       TEXT NOT NULL,
  option_name      TEXT NOT NULL,
  quoted_cash      NUMERIC NOT NULL,
  quoted_points    INTEGER,
  searched_start   DATE NOT NULL,
  searched_end     DATE,
  reported_cash    NUMERIC,
  reported_points  INTEGER,
  reported_start   DATE,
  reported_end     DATE,
  result           TEXT NOT NULL CHECK (result IN ('matched', 'different', 'not_found')),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.booking_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "booking_reports_public_read" ON public.booking_reports
  FOR SELECT
  USING (true);

CREATE POLICY "booking_reports_insert_own" ON public.booking_reports
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX booking_reports_subject_idx
  ON public.booking_reports (subject_type, subject_key, option_key, created_at DESC);

-- Backs the per-user throttle in server/routers/reports.ts submit
CREATE INDEX booking_reports_user_recent_idx
  ON public.booking_reports (user_id, created_at DESC);

-- user_id must never be readable by clients: with the anon key, PostgREST
-- would otherwise serve it straight off the public-read policy. Column grants
-- hide it on the base table; the feed view exposes only "is this mine?".
REVOKE SELECT ON public.booking_reports FROM anon, authenticated;
GRANT SELECT (
  id, reporter_name, subject_type, subject_key, option_key, option_name,
  quoted_cash, quoted_points, searched_start, searched_end,
  reported_cash, reported_points, reported_start, reported_end,
  result, created_at
) ON public.booking_reports TO anon, authenticated;

-- Runs as the view owner so it can compare user_id; reads are public anyway.
CREATE VIEW public.booking_reports_feed AS
  SELECT
    id, reporter_name, subject_type, subject_key, option_key, option_name,
    quoted_cash, reported_cash, reported_points, reported_start, reported_end,
    result, created_at,
    (user_id = auth.uid()) AS is_mine
  FROM public.booking_reports;

GRANT SELECT ON public.booking_reports_feed TO anon, authenticated;
