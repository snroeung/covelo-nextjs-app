// board_mod_events writer (plan §8.8). Audit trouble must never break a
// member's request, so failures are logged and swallowed.

import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

export type ModEventAction =
  | "auto_allow" | "auto_hold" | "auto_reject" | "rescan" | "take_down" | "restore" | "approve_held"
  | "set_topic" | "lock_comments" | "unlock_comments" | "set_standing" | "rate_lock" | "topic_rename"
  | "topic_merge" | "topic_hide" | "topic_promote" | "term_add" | "term_remove" | "reports_hold" | "post_edit" | "dismiss_reports";

export interface ModEvent {
  targetKind: "post" | "comment" | "topic" | "user" | "term";
  /** Null for rejected creates — nothing was stored */
  targetId?: string | null;
  subjectUserId?: string | null;
  /** Null = the system */
  actorId?: string | null;
  action: ModEventAction;
  reasons?: readonly string[];
  scores?: unknown;
  model?: string | null;
  contentHash?: string | null;
  note?: string | null;
}

/** Rejected content is audited by hash only — never the text. */
export function contentHash(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

export async function logModEvent(admin: SupabaseClient, e: ModEvent): Promise<void> {
  try {
    const { error } = await admin.from("board_mod_events").insert({
      target_kind: e.targetKind,
      target_id: e.targetId ?? null,
      subject_user_id: e.subjectUserId ?? null,
      actor_id: e.actorId ?? null,
      action: e.action,
      reasons: e.reasons ?? [],
      scores: e.scores ?? null,
      model: e.model ?? null,
      content_hash: e.contentHash ?? null,
      note: e.note ?? null,
    });
    if (error) console.warn("[board/audit] insert failed:", error.message);
  } catch (err) {
    console.warn("[board/audit] insert threw:", err instanceof Error ? err.message : err);
  }
}
