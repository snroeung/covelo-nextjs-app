-- Run this in your Supabase SQL editor (Dashboard → SQL Editor → New Query)
-- Creates the public.profiles table for user display name and preferred cards

CREATE TABLE public.profiles (
  id             UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  display_name   TEXT,
  preferred_cards TEXT[] DEFAULT '{}',
  avatar_url     TEXT,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Anyone can read profiles (needed for public leaderboards / shared trips later)
CREATE POLICY "profiles_select" ON public.profiles
  FOR SELECT USING (true);

-- Users can only insert/update their own row
CREATE POLICY "profiles_insert" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles_update" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- Auto-create a profile row when a new user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (new.id, split_part(new.email, '@', 1));
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
