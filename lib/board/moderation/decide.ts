// Stage 5 (plan §8.2). Pure decision: every earlier stage's output plus the
// author's standing → allow / hold / reject. Thresholds live in
// MOD_THRESHOLDS; the matrix is pinned by __tests__/board/decide.test.ts.

import { MOD_THRESHOLDS, type ModFlag, type ModReason } from "@/lib/board/constants";
import type { Standing } from "@/lib/board/limits";
import type { BlocklistResult } from "./blocklist";
import type { LinkScan } from "./links";
import type { LexiconResult } from "./lexicon";
import type { ClassifierVerdict } from "./classify";

export interface ModerationSignals {
  blocklist: BlocklistResult;
  links: Pick<LinkScan, "referral" | "tooMany">;
  lexicon: Pick<LexiconResult, "score">;
  /** null when the classifier was skipped, disabled, timed out or failed */
  classifier: ClassifierVerdict | null;
  standing: Standing;
  /** Highest title similarity to the author's own posts in the last 24 h (posts only) */
  duplicateSimilarity?: number;
  /** Topics the author chose — for the topic_mismatch flag */
  chosenTopics?: string[];
}

export type ModerationDecision =
  | { action: "reject"; reasons: ModReason[]; message: string }
  | { action: "hold"; modStatus: "held"; reasons: ModReason[]; flags: ModFlag[]; message: string }
  | { action: "allow"; modStatus: "clean" | "unscanned"; reasons: []; flags: ModFlag[] };

export const MOD_MESSAGES = {
  offensive: "This breaks the board rules (offensive language).",
  referral: "Remove referral or affiliate links.",
  tooManyLinks: `Posts can include at most ${MOD_THRESHOLDS.maxLinks} links.`,
  banned: "Your account can't post on the board.",
  held: "Held for review — only you can see this until an admin approves it.",
  heldOffTopic: "Held for review — this doesn't look travel or points related.",
} as const;

/** What the author reads on a held post/comment, given why it was held. */
export function heldMessage(reasons: readonly string[]): string {
  return reasons.length > 0 && reasons.every((r) => r === "off_topic") ? MOD_MESSAGES.heldOffTopic : MOD_MESSAGES.held;
}

export function decideModeration(s: ModerationSignals): ModerationDecision {
  const c = s.classifier;

  // ─── reject: nothing gets stored ───
  if (s.standing === "banned") return { action: "reject", reasons: ["restricted_author"], message: MOD_MESSAGES.banned };
  if (s.blocklist.tier === "hard") return { action: "reject", reasons: ["hard_blocklist"], message: MOD_MESSAGES.offensive };
  if (c && c.toxicity >= MOD_THRESHOLDS.toxicityReject) return { action: "reject", reasons: ["toxicity"], message: MOD_MESSAGES.offensive };
  if (s.links.referral.length > 0) return { action: "reject", reasons: ["referral_link"], message: MOD_MESSAGES.referral };
  if (s.links.tooMany) return { action: "reject", reasons: ["too_many_links"], message: MOD_MESSAGES.tooManyLinks };

  // ─── hold: stored, visible to author + admins ───
  const reasons: ModReason[] = [];
  if (s.blocklist.tier === "soft") reasons.push("soft_blocklist");
  if (c && c.toxicity >= MOD_THRESHOLDS.toxicityHold) reasons.push("toxicity");
  if (c && c.on_topic < MOD_THRESHOLDS.offTopicHold && s.lexicon.score === 0) reasons.push("off_topic");
  if (c && c.spam >= MOD_THRESHOLDS.spamHold) reasons.push("spam");
  if ((s.duplicateSimilarity ?? 0) >= MOD_THRESHOLDS.duplicateTitle) reasons.push("duplicate");
  if (s.standing === "restricted") reasons.push("restricted_author");
  if (s.standing === "watch" && !c) reasons.push("watch_unscanned");

  const flags: ModFlag[] = [];
  if (c && c.on_topic >= MOD_THRESHOLDS.offTopicHold && c.on_topic < MOD_THRESHOLDS.borderlineTopic) {
    flags.push("borderline_topic");
  }
  if (
    c?.suggested_topic &&
    c.topic_confidence >= MOD_THRESHOLDS.topicMismatch &&
    s.chosenTopics && s.chosenTopics.length > 0 &&
    !s.chosenTopics.some((t) => t.toLowerCase() === c.suggested_topic!.toLowerCase())
  ) {
    flags.push("topic_mismatch");
  }

  if (reasons.length > 0) {
    return { action: "hold", modStatus: "held", reasons, flags, message: heldMessage(reasons) };
  }

  return { action: "allow", modStatus: c ? "clean" : "unscanned", reasons: [], flags };
}
