// Weekly job: active topics with no visible post for 60 days go dormant
// (plan §12.3). The rule lives in SQL (board_mark_dormant_topics, migration
// 026); a new post in a dormant topic reactivates it by trigger, so this only
// ever moves topics one way. Dormant topics leave the chip row but stay
// searchable and postable.

import type { SupabaseClient } from "@supabase/supabase-js";
import { must } from "./errors";
import { bustTopicsCache } from "./cache";

/** How many topics went dormant. The shared topic list is only busted when something changed. */
export async function markDormantTopics(admin: SupabaseClient): Promise<number> {
  const res = await admin.rpc("board_mark_dormant_topics");
  const count = Number(must(res as never, "dormant topics") ?? 0);
  if (count > 0) await bustTopicsCache();
  return count;
}
