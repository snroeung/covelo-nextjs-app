-- Run in Supabase Dashboard → SQL Editor → New Query
-- Creates transfer_bonuses, spending_bonuses, and sponsored_ads tables

-- ─── transfer_bonuses ────────────────────────────────────────────────────────

CREATE TABLE public.transfer_bonuses (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  issuer           TEXT NOT NULL CHECK (issuer IN ('chase', 'amex', 'c1', 'bilt', 'citi')),
  transfer_partner TEXT NOT NULL,
  bonus_pct        NUMERIC(5, 2) NOT NULL CHECK (bonus_pct > 0),
  -- effective_ratio = 1 + bonus_pct/100  (e.g. 30% bonus → 1.30)
  effective_ratio  NUMERIC(7, 4) GENERATED ALWAYS AS (1 + bonus_pct / 100.0) STORED,
  start_date       DATE,
  end_date         DATE NOT NULL,
  is_targeted      BOOLEAN NOT NULL DEFAULT false,
  source_url       TEXT,
  -- 'admin'    = created by admin team, publicly visible immediately
  -- 'pending'  = user-submitted, awaiting admin review
  -- 'approved' = user-submitted and approved by admin
  -- 'rejected' = user-submitted and rejected
  status           TEXT NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('admin', 'pending', 'approved', 'rejected')),
  submitted_by     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  upvotes          INTEGER NOT NULL DEFAULT 0,
  active           BOOLEAN NOT NULL DEFAULT true,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.transfer_bonuses ENABLE ROW LEVEL SECURITY;

-- Public: only active, visible (admin or approved), and not-yet-expired rows
CREATE POLICY "transfer_bonuses_public_read" ON public.transfer_bonuses
  FOR SELECT
  USING (
    active = true
    AND status IN ('admin', 'approved')
    AND end_date > NOW()
  );

-- Authenticated users can submit new bonuses (enter pending queue)
CREATE POLICY "transfer_bonuses_user_insert" ON public.transfer_bonuses
  FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND status = 'pending'
    AND submitted_by = auth.uid()
  );

-- Admins have full access (all operations, all rows)
CREATE POLICY "transfer_bonuses_admin_all" ON public.transfer_bonuses
  FOR ALL
  USING  ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

CREATE INDEX transfer_bonuses_filter_idx ON public.transfer_bonuses (issuer, active, end_date);

CREATE TRIGGER transfer_bonuses_updated_at
  BEFORE UPDATE ON public.transfer_bonuses
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

-- ─── spending_bonuses ─────────────────────────────────────────────────────────

CREATE TABLE public.spending_bonuses (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  issuer           TEXT NOT NULL CHECK (issuer IN ('chase', 'amex', 'c1', 'bilt', 'citi')),
  merchant_name    TEXT NOT NULL,
  bonus_multiplier NUMERIC(6, 2) NOT NULL CHECK (bonus_multiplier > 0),
  bonus_type       TEXT NOT NULL CHECK (bonus_type IN ('points_multiplier', 'cash_back_pct')),
  card_ids         TEXT[] NOT NULL DEFAULT '{}',
  start_date       DATE,
  end_date         DATE NOT NULL,
  is_targeted      BOOLEAN NOT NULL DEFAULT false,
  source_url       TEXT,
  status           TEXT NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('admin', 'pending', 'approved', 'rejected')),
  submitted_by     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  upvotes          INTEGER NOT NULL DEFAULT 0,
  active           BOOLEAN NOT NULL DEFAULT true,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.spending_bonuses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "spending_bonuses_public_read" ON public.spending_bonuses
  FOR SELECT
  USING (
    active = true
    AND status IN ('admin', 'approved')
    AND end_date > NOW()
  );

CREATE POLICY "spending_bonuses_user_insert" ON public.spending_bonuses
  FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND status = 'pending'
    AND submitted_by = auth.uid()
  );

CREATE POLICY "spending_bonuses_admin_all" ON public.spending_bonuses
  FOR ALL
  USING  ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

CREATE INDEX spending_bonuses_filter_idx ON public.spending_bonuses (issuer, active, end_date);

CREATE TRIGGER spending_bonuses_updated_at
  BEFORE UPDATE ON public.spending_bonuses
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

-- ─── sponsored_ads ────────────────────────────────────────────────────────────

CREATE TABLE public.sponsored_ads (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner     TEXT NOT NULL,
  product     TEXT NOT NULL,
  slot        TEXT NOT NULL CHECK (slot IN ('hero', 'grid_inline', 'below_grid', 'sidebar')),
  headline    TEXT NOT NULL,
  subheadline TEXT,
  bullets     TEXT[] NOT NULL DEFAULT '{}',
  cta_label   TEXT NOT NULL,
  cta_url     TEXT NOT NULL,
  tracking_id TEXT NOT NULL,
  disclosure  TEXT NOT NULL DEFAULT 'Sponsored · Covelo may receive compensation when you apply.',
  tone        TEXT NOT NULL DEFAULT 'neutral',
  image_url   TEXT,
  active      BOOLEAN NOT NULL DEFAULT false,
  start_date  DATE,
  end_date    DATE,
  impressions BIGINT NOT NULL DEFAULT 0,
  clicks      BIGINT NOT NULL DEFAULT 0,
  created_by  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.sponsored_ads ENABLE ROW LEVEL SECURITY;

-- No public RLS reads — ads are served via tRPC using supabaseAdmin (service role),
-- which bypasses RLS entirely. Only admins can read/write via the dashboard.
CREATE POLICY "sponsored_ads_admin_all" ON public.sponsored_ads
  FOR ALL
  USING  ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

CREATE INDEX sponsored_ads_active_slot_idx ON public.sponsored_ads (slot, active);

CREATE TRIGGER sponsored_ads_updated_at
  BEFORE UPDATE ON public.sponsored_ads
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();
