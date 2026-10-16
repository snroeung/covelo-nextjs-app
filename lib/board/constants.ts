// Shared board constants — server routers, admin UI and member UI all read
// from here so reasons and thresholds never drift between surfaces.

export const BOARD_POST_KINDS = ["tip", "offer"] as const;
export type BoardPostKind = (typeof BOARD_POST_KINDS)[number];

/** Seeded `common` topics — always first in chips and the composer. */
export const BOARD_COMMON_TOPICS = [
  "Transfer bonuses",
  "Hotels",
  "Award flights",
  "Statement credits",
] as const;

/** Types a member can pick when creating a new offer in the composer. */
export const BOARD_OFFER_TYPES = [
  "TRANSFER BONUS",
  "PARTNER DEAL",
  "STATEMENT CREDIT",
  "SIGN-UP BONUS",
  "FREE NIGHT",
  "PACKAGE",
] as const;
export type BoardOfferType = (typeof BOARD_OFFER_TYPES)[number];

/** Admin rejecting an offer post's verification — shown to the author. */
export const BOARD_REJECT_REASONS = [
  "Offer expired",
  "Can't confirm terms",
  "Referral link",
  "Duplicate post",
  "Off-topic",
] as const;

/** Admin taking down a post or comment — shown to the author. */
export const BOARD_REMOVE_REASONS = [
  "Offensive",
  "Off-topic",
  "Spam",
  "Referral link",
  "Offer expired",
  "Duplicate",
  "Other",
] as const;

/** Member reporting a post or comment. */
export const BOARD_REPORT_REASONS = [
  "Offensive",
  "Off-topic",
  "Spam",
  "Referral link",
  "Misleading offer",
  "Other",
] as const;

/** Moderation reason codes stored in `mod_reasons` / `mod_flags`. */
export const MOD_REASONS = [
  "hard_blocklist",
  "soft_blocklist",
  "toxicity",
  "referral_link",
  "too_many_links",
  "off_topic",
  "spam",
  "duplicate",
  "restricted_author",
  // `watch` standing with no classifier verdict — watched authors get no fast-path allow
  "watch_unscanned",
  "reports",
] as const;
export type ModReason = (typeof MOD_REASONS)[number];

export const MOD_FLAGS = ["borderline_topic", "topic_mismatch"] as const;
export type ModFlag = (typeof MOD_FLAGS)[number];

/** Decision thresholds for lib/board/moderation/decide.ts (plan §8.2). */
export const MOD_THRESHOLDS = {
  /** toxicity ≥ this → reject */
  toxicityReject: 0.85,
  /** toxicity ≥ this (and below reject) → hold */
  toxicityHold: 0.5,
  /** on_topic below this with no lexicon hit → hold as off_topic */
  offTopicHold: 0.35,
  /** on_topic below this (and ≥ offTopicHold) → allow + borderline_topic flag */
  borderlineTopic: 0.6,
  /** spam ≥ this → hold */
  spamHold: 0.8,
  /** Same-author title trigram similarity within 24 h → duplicate */
  duplicateTitle: 0.9,
  /** LLM suggested a different topic with at least this confidence → topic_mismatch flag */
  topicMismatch: 0.7,
  /** Distinct reporters that auto-hold a target */
  reportsAutoHold: 3,
  /** Max links in one post/comment before reject */
  maxLinks: 3,
  /** LLM classifier timeout before falling back to `unscanned` */
  classifyTimeoutMs: 2500,
} as const;

/** Removals in the last 30 days that move an author's standing (plan §8.5). */
export const STANDING_THRESHOLDS = {
  watch: 2,
  restricted: 4,
  windowDays: 30,
} as const;

/** Topic name and lifecycle rules (plan §12). */
export const TOPIC_RULES = {
  minLength: 2,
  maxLength: 28,
  maxWords: 4,
  /** Distinct authors before a provisional topic becomes an active chip */
  activateAuthors: 2,
  /** Days with no visible posts before an active topic goes dormant */
  dormantDays: 60,
  /** Feed chip row cap before "More topics" */
  chipCap: 12,
  /** Active (non-common) topics shown in the composer chip row */
  composerChipCap: 8,
  /** trigram similarity ≥ this auto-maps to an existing topic */
  autoMergeSimilarity: 0.85,
  /** trigram similarity ≥ this shows "Did you mean" */
  suggestSimilarity: 0.6,
} as const;

export const BOARD_TEXT_LIMITS = {
  titleMax: 200,
  bodyMax: 10_000,
  commentMax: 5_000,
  reportNoteMax: 500,
} as const;
