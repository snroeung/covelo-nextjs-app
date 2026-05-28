-- Run in Supabase SQL Editor
-- Adds username (unique) and onboarding_completed to profiles

ALTER TABLE public.profiles
  ADD COLUMN username TEXT UNIQUE,
  ADD COLUMN onboarding_completed BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.profiles
  ADD CONSTRAINT username_format CHECK (username ~ '^[a-zA-Z0-9_]{3,20}$');
