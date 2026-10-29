-- Run in Supabase Dashboard → SQL Editor → New Query
-- Two gaps found building the member router (depends on 025/026):
--
-- 1. Removing a vote deleted its row, which reset change_count — a member
--    could dodge the per-target vote-flap limit by clearing and re-voting.
--    A removed vote is now a row with value 0. The score trigger already
--    adds (NEW.value - OLD.value), so 0 needs no trigger change.
-- 2. Post edits are rate limited (hourly/daily and per post) from the audit
--    log, so 'post_edit' needs to be a valid action.

ALTER TABLE public.board_votes DROP CONSTRAINT board_votes_value_check;
ALTER TABLE public.board_votes ADD CONSTRAINT board_votes_value_check CHECK (value IN (-1, 0, 1));

ALTER TABLE public.board_mod_events DROP CONSTRAINT board_mod_events_action_check;
ALTER TABLE public.board_mod_events ADD CONSTRAINT board_mod_events_action_check CHECK (action IN (
  'auto_allow', 'auto_hold', 'auto_reject', 'rescan',
  'take_down', 'restore', 'approve_held', 'set_topic',
  'lock_comments', 'unlock_comments', 'set_standing', 'rate_lock',
  'topic_rename', 'topic_merge', 'topic_hide', 'topic_promote',
  'term_add', 'term_remove', 'reports_hold', 'post_edit'));
