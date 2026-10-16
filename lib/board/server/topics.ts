// Topic dedupe ladder (plan §12.2) and creation. The client previews the
// first two rungs with lib/board/topics.ts; the server is authoritative and
// adds aliases and pg_trgm (board_similar_topics).

import { TRPCError } from "@trpc/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { TOPIC_RULES } from "@/lib/board/constants";
import { validateTopic, sameProgramTopic, keySimilarity } from "@/lib/board/topics";
import type { TopicStatus } from "@/lib/board/types";
import { must } from "./errors";

export interface TopicRow {
  id: string;
  name: string;
  key: string;
  status: TopicStatus;
  merged_into_id: string | null;
}

export interface TopicIndex {
  topics: TopicRow[];
  byId: Map<string, TopicRow>;
  /** alias key → topic id */
  aliases: Map<string, string>;
}

export type TopicInput = { id: string } | { name: string };

const TOPIC_COLUMNS = "id, name, key, status, merged_into_id";

export async function loadTopicIndex(admin: SupabaseClient): Promise<TopicIndex> {
  const [topics, aliases] = await Promise.all([
    admin.from("board_topics").select(TOPIC_COLUMNS).limit(2000),
    admin.from("board_topic_aliases").select("key, topic_id").limit(5000),
  ]);
  const rows = must(topics, "topic list") as unknown as TopicRow[];
  return {
    topics: rows,
    byId: new Map(rows.map((t) => [t.id, t])),
    aliases: new Map((must(aliases, "alias list") as unknown as Array<{ key: string; topic_id: string }>).map((a) => [a.key, a.topic_id])),
  };
}

/** The topic a post should live under: follows merges; null for a hidden topic with nowhere to go. */
export function followMerge(index: TopicIndex, topic: TopicRow): TopicRow | null {
  let cur = topic;
  for (let hops = 0; hops < 5; hops++) {
    if (cur.merged_into_id) {
      const next = index.byId.get(cur.merged_into_id);
      if (!next) return null;
      cur = next;
      continue;
    }
    return cur.status === "hidden" ? null : cur;
  }
  return null;
}

/** Every topic id that rolls up under `id` (itself plus anything merged into it), for filters. */
export function topicFamily(index: TopicIndex, id: string): string[] {
  const ids = new Set([id]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const t of index.topics) {
      if (t.merged_into_id && ids.has(t.merged_into_id) && !ids.has(t.id)) {
        ids.add(t.id);
        grew = true;
      }
    }
  }
  return [...ids];
}

export type PlanItem = { type: "existing"; topic: TopicRow } | { type: "new"; name: string; key: string };

export interface TopicPlan {
  /** Every pick in the order made — the first becomes the post's primary topic */
  ordered: PlanItem[];
  existing: TopicRow[];
  toCreate: Array<{ name: string; key: string }>;
}

const bad = (message: string) => new TRPCError({ code: "BAD_REQUEST", message });

/** One typed name → an existing topic, or null when it is genuinely new. */
async function matchName(
  admin: SupabaseClient,
  index: TopicIndex,
  name: string,
  key: string,
): Promise<TopicRow | null> {
  const byKey = index.topics.find((t) => t.key === key);
  const aliasId = index.aliases.get(key);
  const hit = byKey ?? (aliasId ? index.byId.get(aliasId) : undefined) ?? index.topics.find((t) => sameProgramTopic(t.name, name));
  if (hit) {
    const target = followMerge(index, hit);
    if (!target) throw bad("That topic isn't available.");
    return target;
  }

  const { data } = await admin.rpc("board_similar_topics", { q: key, min_similarity: TOPIC_RULES.autoMergeSimilarity });
  const similar = (data as Array<{ id: string }> | null)?.[0];
  return similar ? index.byId.get(similar.id) ?? null : null;
}

/**
 * Resolve what the member picked. Read-only — nothing is created until the
 * submission has passed moderation. Throws BAD_REQUEST for an invalid or
 * blocked name.
 */
export async function planTopics(
  admin: SupabaseClient,
  index: TopicIndex,
  inputs: readonly TopicInput[],
  isBlocked: (name: string) => boolean,
): Promise<TopicPlan> {
  const ordered: PlanItem[] = [];
  const addExisting = (topic: TopicRow) => {
    if (!ordered.some((i) => i.type === "existing" && i.topic.id === topic.id)) ordered.push({ type: "existing", topic });
  };

  for (const input of inputs) {
    if ("id" in input) {
      const row = index.byId.get(input.id);
      const target = row ? followMerge(index, row) : null;
      if (!target) throw bad("That topic isn't available.");
      addExisting(target);
      continue;
    }

    const v = validateTopic(input.name, { isBlocked });
    if (!v.ok) throw bad(v.error);
    const match = await matchName(admin, index, v.name, v.key);
    if (match) addExisting(match);
    else if (!ordered.some((i) => i.type === "new" && i.key === v.key)) ordered.push({ type: "new", name: v.name, key: v.key });
  }

  return {
    ordered,
    existing: ordered.flatMap((i) => (i.type === "existing" ? [i.topic] : [])),
    toCreate: ordered.flatMap((i) => (i.type === "new" ? [{ name: i.name, key: i.key }] : [])),
  };
}

export interface CreatedTopic {
  topic: TopicRow;
  /** False when someone else created it first (the race in plan §12.2) */
  createdNew: boolean;
}

/** Insert new topics; `on conflict (key) do nothing`, then read back whoever won. */
export async function createTopics(
  admin: SupabaseClient,
  toCreate: TopicPlan["toCreate"],
  userId: string,
): Promise<CreatedTopic[]> {
  const out: CreatedTopic[] = [];
  for (const t of toCreate) {
    const inserted = await admin
      .from("board_topics")
      .upsert({ name: t.name, key: t.key, status: "provisional", created_by: userId }, { onConflict: "key", ignoreDuplicates: true })
      .select(TOPIC_COLUMNS);
    const row = (must(inserted, "topic create") as unknown as TopicRow[])[0];
    if (row) {
      out.push({ topic: row, createdNew: true });
      continue;
    }
    const existing = await admin.from("board_topics").select(TOPIC_COLUMNS).eq("key", t.key).single();
    out.push({ topic: must(existing, "topic lookup") as unknown as TopicRow, createdNew: false });
  }
  return out;
}

export async function deleteTopics(admin: SupabaseClient, ids: readonly string[]): Promise<void> {
  if (ids.length > 0) await admin.from("board_topics").delete().in("id", ids as string[]);
}

export interface TopicPreview {
  valid: boolean;
  error: string | null;
  name: string | null;
  key: string | null;
  /** Same topic already exists — selecting it creates nothing */
  exact: TopicRow | null;
  /** Close enough that the composer should ask "Did you mean …?" */
  didYouMean: TopicRow | null;
  suggestions: TopicRow[];
}

/** Composer preview (topics.resolve): the ladder's verdict for a draft name, with near-misses. */
export async function previewTopic(
  admin: SupabaseClient,
  index: TopicIndex,
  raw: string,
  isBlocked: (name: string) => boolean,
): Promise<TopicPreview> {
  const v = validateTopic(raw, { isBlocked });
  if (!v.ok) return { valid: false, error: v.error, name: null, key: null, exact: null, didYouMean: null, suggestions: [] };

  let exact: TopicRow | null = null;
  try {
    exact = await matchName(admin, index, v.name, v.key);
  } catch (e) {
    if (e instanceof TRPCError) return { valid: false, error: e.message, name: v.name, key: v.key, exact: null, didYouMean: null, suggestions: [] };
    throw e;
  }
  if (exact) return { valid: true, error: null, name: v.name, key: v.key, exact, didYouMean: null, suggestions: [] };

  const { data } = await admin.rpc("board_similar_topics", { q: v.key, min_similarity: TOPIC_RULES.suggestSimilarity });
  const suggestions = ((data as Array<{ id: string }> | null) ?? [])
    .map((r) => index.byId.get(r.id))
    .filter((t): t is TopicRow => !!t);
  const top = suggestions[0];
  return {
    valid: true, error: null, name: v.name, key: v.key, exact: null,
    didYouMean: top && keySimilarity(v.key, top.key) >= TOPIC_RULES.autoMergeSimilarity ? top : null,
    suggestions,
  };
}
