-- Run in Supabase Dashboard → SQL Editor → New Query
-- Per-post save-toggle cap (plan §3.1, 20 / 24 h). Unsaving deletes the
-- board_saves row, so toggles left no trace to count. This insert-only log
-- records each one; the router counts the last 24 h per (user, post).

CREATE TABLE IF NOT EXISTS public.board_save_toggles (
  id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  post_id    UUID NOT NULL REFERENCES public.board_posts(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS board_save_toggles_user_post_idx
  ON public.board_save_toggles (user_id, post_id, created_at DESC);

-- RLS on with no policies = no client access. Service role bypasses RLS.
ALTER TABLE public.board_save_toggles ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.board_save_toggles FROM anon, authenticated;
