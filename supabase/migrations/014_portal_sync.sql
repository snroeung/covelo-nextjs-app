-- Run in Supabase Dashboard → SQL Editor → New Query
-- Portal Data Sync: transfer_partners, hotel_collections, portal_sync_runs,
-- portal_sync_corrections — landing zone for the weekly scrape+LLM pipeline
-- (scripts/portal-sync/). Everything lands as a pending-review candidate;
-- nothing is publicly visible until an admin approves it.

-- ─── transfer_partners ──────────────────────────────────────────────────────
-- Replaces the hardcoded TRANSFER_PARTNERS constant in
-- lib/points/transferPartners.ts. Note: portal_id uses PortalId values
-- ('capital_one', not 'c1') since this table feeds calcTransferAlternatives()
-- directly — differs from the `issuer` convention below by design.

CREATE TABLE public.transfer_partners (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portal_id    TEXT NOT NULL CHECK (portal_id IN ('chase', 'amex', 'capital_one', 'bilt', 'citi')),
  program      TEXT NOT NULL,
  type         TEXT NOT NULL CHECK (type IN ('hotel', 'airline')),
  ratio        TEXT NOT NULL DEFAULT '1:1',
  chain_key    TEXT,
  iata_codes   TEXT[] NOT NULL DEFAULT '{}',
  source       TEXT NOT NULL DEFAULT 'admin' CHECK (source IN ('admin', 'cron')),
  status       TEXT NOT NULL DEFAULT 'admin' CHECK (status IN ('admin', 'pending', 'approved', 'rejected')),
  source_url   TEXT,
  active       BOOLEAN NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (portal_id, program, type)
);

ALTER TABLE public.transfer_partners ENABLE ROW LEVEL SECURITY;

CREATE POLICY "transfer_partners_public_read" ON public.transfer_partners
  FOR SELECT
  USING (
    active = true
    AND status IN ('admin', 'approved')
  );

CREATE POLICY "transfer_partners_admin_all" ON public.transfer_partners
  FOR ALL
  USING  ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

CREATE INDEX transfer_partners_filter_idx ON public.transfer_partners (portal_id, active);

CREATE TRIGGER transfer_partners_updated_at
  BEFORE UPDATE ON public.transfer_partners
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

-- ─── hotel_collections ──────────────────────────────────────────────────────
-- Net-new concept — Amex Fine Hotels + Resorts, Capital One Premier
-- Collection, Chase Luxury Hotel & Resort Collection, etc.

CREATE TABLE public.hotel_collections (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  issuer          TEXT NOT NULL CHECK (issuer IN ('chase', 'amex', 'c1', 'bilt', 'citi')),
  collection_name TEXT NOT NULL,
  property_name   TEXT,
  perk_summary    TEXT NOT NULL,
  start_date      DATE,
  end_date        DATE,
  source          TEXT NOT NULL DEFAULT 'admin' CHECK (source IN ('admin', 'cron')),
  status          TEXT NOT NULL DEFAULT 'admin' CHECK (status IN ('admin', 'pending', 'approved', 'rejected')),
  source_url      TEXT,
  active          BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.hotel_collections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "hotel_collections_public_read" ON public.hotel_collections
  FOR SELECT
  USING (
    active = true
    AND status IN ('admin', 'approved')
  );

CREATE POLICY "hotel_collections_admin_all" ON public.hotel_collections
  FOR ALL
  USING  ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

CREATE INDEX hotel_collections_filter_idx ON public.hotel_collections (issuer, active);

CREATE TRIGGER hotel_collections_updated_at
  BEFORE UPDATE ON public.hotel_collections
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

-- ─── portal_sync_runs ───────────────────────────────────────────────────────
-- Admin-only audit log, one row per source per cron run. Mirrors the
-- sponsored_ads no-public-policy pattern. raw_text_excerpt backs the
-- eval harness (scripts/portal-sync/eval.ts) — lets a prompt change be
-- replayed against real past input without re-scraping a page that may
-- have since changed.

CREATE TABLE public.portal_sync_runs (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_key         TEXT NOT NULL,
  source_url         TEXT NOT NULL,
  status             TEXT NOT NULL CHECK (status IN ('success', 'partial', 'failed')),
  records_found      INTEGER NOT NULL DEFAULT 0,
  records_written    INTEGER NOT NULL DEFAULT 0,
  error_message      TEXT,
  llm_model          TEXT,
  llm_tokens_used    INTEGER,
  raw_text_excerpt   TEXT,
  started_at         TIMESTAMPTZ NOT NULL,
  finished_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.portal_sync_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "portal_sync_runs_admin_all" ON public.portal_sync_runs
  FOR ALL
  USING  ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

CREATE INDEX portal_sync_runs_source_idx ON public.portal_sync_runs (source_key, started_at);

-- ─── portal_sync_corrections ────────────────────────────────────────────────
-- Admin-only. Captures the diff between an LLM extraction and what the admin
-- actually approved — the ground-truth signal for the few-shot library and
-- eval.ts, per the prompt-iteration quality loop (no fine-tuning).

CREATE TABLE public.portal_sync_corrections (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id           UUID REFERENCES public.portal_sync_runs(id) ON DELETE SET NULL,
  record_type      TEXT NOT NULL CHECK (record_type IN ('transfer_partner', 'transfer_bonus', 'spending_bonus', 'hotel_collection')),
  field            TEXT NOT NULL,
  extracted_value  TEXT,
  corrected_value  TEXT,
  source_url       TEXT NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.portal_sync_corrections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "portal_sync_corrections_admin_all" ON public.portal_sync_corrections
  FOR ALL
  USING  ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

CREATE INDEX portal_sync_corrections_run_idx ON public.portal_sync_corrections (run_id);

-- ─── transfer_bonuses / spending_bonuses: source column + status gate ──────
-- 011_offers_active_model.sql dropped the `status` check from public read
-- because pending-submission review didn't exist yet — it does now. Re-add
-- the gate so cron-inserted pending/rejected rows can never leak publicly
-- through RLS alone (active=false was the only thing hiding them before).

ALTER TABLE public.transfer_bonuses
  ADD COLUMN source TEXT NOT NULL DEFAULT 'admin' CHECK (source IN ('admin', 'cron'));

ALTER TABLE public.spending_bonuses
  ADD COLUMN source TEXT NOT NULL DEFAULT 'admin' CHECK (source IN ('admin', 'cron'));

DROP POLICY IF EXISTS "transfer_bonuses_public_read" ON public.transfer_bonuses;
CREATE POLICY "transfer_bonuses_public_read" ON public.transfer_bonuses
  FOR SELECT
  USING (
    active = true
    AND status IN ('admin', 'approved')
    AND end_date > NOW()
  );

DROP POLICY IF EXISTS "spending_bonuses_public_read" ON public.spending_bonuses;
CREATE POLICY "spending_bonuses_public_read" ON public.spending_bonuses
  FOR SELECT
  USING (
    active = true
    AND status IN ('admin', 'approved')
    AND end_date > NOW()
  );
