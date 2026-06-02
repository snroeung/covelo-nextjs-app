-- Run this in Supabase Dashboard → SQL Editor → New Query

CREATE TABLE public.trips (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  title                TEXT NOT NULL,
  destination          TEXT NOT NULL,
  destination_place_id TEXT,
  destination_lat      DOUBLE PRECISION,
  destination_lng      DOUBLE PRECISION,
  start_date           DATE NOT NULL,
  end_date             DATE NOT NULL,
  travelers            JSONB NOT NULL DEFAULT '{"adults":1,"children":0,"pets":0}',
  activities           JSONB NOT NULL DEFAULT '[]',
  pins                 JSONB NOT NULL DEFAULT '[]',
  itinerary_days       JSONB NOT NULL DEFAULT '{}',
  created_at           TIMESTAMPTZ DEFAULT NOW(),
  updated_at           TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.trips ENABLE ROW LEVEL SECURITY;

-- Users can only see and modify their own trips
CREATE POLICY "trips_select" ON public.trips FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "trips_insert" ON public.trips FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "trips_update" ON public.trips FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "trips_delete" ON public.trips FOR DELETE USING (auth.uid() = user_id);

-- Keep updated_at current automatically
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trips_updated_at
  BEFORE UPDATE ON public.trips
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();
