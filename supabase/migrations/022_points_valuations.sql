-- Run in Supabase Dashboard → SQL Editor → New Query
-- points_valuations: landing zone for TPG's monthly "how much is a point
-- worth" table, scraped as a 5th record type by scripts/portal-sync/.
-- Same trust model as transfer_partners — nothing public until an admin
-- approves it (or it's hand-seeded with source='admin', status='admin').

CREATE TABLE public.points_valuations (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program      TEXT NOT NULL,
  cpp          NUMERIC NOT NULL,
  source_month TEXT NOT NULL,
  source       TEXT NOT NULL DEFAULT 'admin' CHECK (source IN ('admin', 'cron')),
  status       TEXT NOT NULL DEFAULT 'admin' CHECK (status IN ('admin', 'pending', 'approved', 'rejected')),
  source_url   TEXT,
  active       BOOLEAN NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (program, source_month)
);

ALTER TABLE public.points_valuations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "points_valuations_public_read" ON public.points_valuations
  FOR SELECT
  USING (
    active = true
    AND status IN ('admin', 'approved')
  );

CREATE POLICY "points_valuations_admin_all" ON public.points_valuations
  FOR ALL
  USING  ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

CREATE INDEX points_valuations_filter_idx ON public.points_valuations (program, active);

CREATE TRIGGER points_valuations_updated_at
  BEFORE UPDATE ON public.points_valuations
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

-- portal_sync_corrections.record_type must accept points_valuation so admin
-- edits made during approval of a scraped points_valuations row can be
-- logged (portalData.ts admin.approve inserts a correction row per edited
-- field) — without this the insert would violate the CHECK constraint.
ALTER TABLE public.portal_sync_corrections DROP CONSTRAINT IF EXISTS portal_sync_corrections_record_type_check;
ALTER TABLE public.portal_sync_corrections ADD CONSTRAINT portal_sync_corrections_record_type_check
  CHECK (record_type IN ('transfer_partner', 'transfer_bonus', 'spending_bonus', 'hotel_collection', 'points_valuation'));
