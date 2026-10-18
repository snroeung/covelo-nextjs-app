-- Run in Supabase Dashboard → SQL Editor → New Query
-- Admin topic merge (plan §12.6). A merge moves rows across four tables, so it
-- is one function and therefore one transaction — a failure leaves nothing
-- half-moved. Depends on 025–028.
--
-- Everything on `p_source` ends up on `p_target`: its posts, its aliases, its
-- own key (as a new alias, so the old name still resolves) and any topic that
-- had already been merged into it. The source is hidden, pointing at the target.

CREATE OR REPLACE FUNCTION public.board_merge_topics(p_source UUID, p_target UUID)
RETURNS VOID LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  v_primary_posts UUID[];
BEGIN
  IF p_source = p_target THEN
    RAISE EXCEPTION 'A topic cannot be merged into itself' USING ERRCODE = '22023';
  END IF;
  PERFORM 1 FROM board_topics WHERE id = p_source;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Source topic not found' USING ERRCODE = 'P0002';
  END IF;
  PERFORM 1 FROM board_topics WHERE id = p_target AND merged_into_id IS NULL AND status <> 'hidden';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Target topic must be a visible, unmerged topic' USING ERRCODE = '22023';
  END IF;

  -- Posts that already carry the target: drop their source link. If the source
  -- was the primary, the target takes over as primary (the unique one-primary
  -- index forbids two at once, so release first, then promote).
  SELECT array_agg(s.post_id) INTO v_primary_posts
    FROM board_post_topics s
    JOIN board_post_topics t ON t.post_id = s.post_id AND t.topic_id = p_target
   WHERE s.topic_id = p_source AND s.is_primary;

  DELETE FROM board_post_topics s
   USING board_post_topics t
   WHERE s.topic_id = p_source AND t.post_id = s.post_id AND t.topic_id = p_target;

  UPDATE board_post_topics
     SET is_primary = true
   WHERE topic_id = p_target AND post_id = ANY (coalesce(v_primary_posts, '{}'));

  -- Everything else on the source moves over as-is (primary flag included)
  UPDATE board_post_topics SET topic_id = p_target WHERE topic_id = p_source;
  UPDATE board_posts SET topic_id = p_target WHERE topic_id = p_source;
  UPDATE board_posts SET suggested_topic_id = p_target WHERE suggested_topic_id = p_source;

  -- Names that used to reach the source now reach the target
  UPDATE board_topic_aliases SET topic_id = p_target WHERE topic_id = p_source;
  INSERT INTO board_topic_aliases (key, topic_id)
    SELECT key, p_target FROM board_topics WHERE id = p_source
    ON CONFLICT (key) DO NOTHING;
  UPDATE board_topics SET merged_into_id = p_target WHERE merged_into_id = p_source;

  UPDATE board_topics SET status = 'hidden', merged_into_id = p_target WHERE id = p_source;
  PERFORM board_refresh_topic(p_target);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.board_merge_topics(UUID, UUID) FROM PUBLIC, anon, authenticated;
