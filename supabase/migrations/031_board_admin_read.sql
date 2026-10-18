-- Run in Supabase Dashboard → SQL Editor → New Query
-- Lets an admin's session read the board tables the shared "Pending review"
-- queue needs (portalData.admin.listAll), exactly as it already reads
-- transfer_bonuses & co. Depends on 025–030.
--
-- Access afterwards (verified against the real roles with fake JWT claims, in
-- a rolled-back transaction):
--   admin   (app_metadata.role = 'admin')  SELECT on the tables below, every row; no write grant
--   member  (signed in, any other claims)  0 rows — not even their own held post (the API still serves those)
--   forged  (user_metadata.role = 'admin') 0 rows — only app_metadata, which only the service role can set, counts
--   anon                                   permission denied
-- Not opened at all: board_votes, board_saves, board_mod_events, board_blocked_terms,
-- board_user_flags, board_topic_aliases, board_author_standing.
-- Every write still goes through server/routers via the service role, because a
-- moderation action spans tables, writes an audit row and fires triggers.

GRANT SELECT ON
  public.board_posts, public.board_comments, public.board_topics,
  public.board_post_topics, public.board_reports, public.board_member_offers,
  public.board_posts_feed
TO authenticated;

CREATE POLICY board_posts_admin_read ON public.board_posts
  FOR SELECT TO authenticated USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
CREATE POLICY board_comments_admin_read ON public.board_comments
  FOR SELECT TO authenticated USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
CREATE POLICY board_topics_admin_read ON public.board_topics
  FOR SELECT TO authenticated USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
CREATE POLICY board_post_topics_admin_read ON public.board_post_topics
  FOR SELECT TO authenticated USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
CREATE POLICY board_reports_admin_read ON public.board_reports
  FOR SELECT TO authenticated USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
CREATE POLICY board_member_offers_admin_read ON public.board_member_offers
  FOR SELECT TO authenticated USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
-- board_posts_feed is security_invoker, so it inherits the policies above.

-- An admin can dismiss a post's or comment's reports without acting on it (the
-- board page's "Reported" filter) — audited as its own action.
ALTER TABLE public.board_mod_events DROP CONSTRAINT board_mod_events_action_check;
ALTER TABLE public.board_mod_events ADD CONSTRAINT board_mod_events_action_check CHECK (action IN (
  'auto_allow', 'auto_hold', 'auto_reject', 'rescan',
  'take_down', 'restore', 'approve_held', 'set_topic',
  'lock_comments', 'unlock_comments', 'set_standing', 'rate_lock',
  'topic_rename', 'topic_merge', 'topic_hide', 'topic_promote',
  'term_add', 'term_remove', 'reports_hold', 'post_edit', 'dismiss_reports'));
