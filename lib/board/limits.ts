// Board rate limits (plan §3.1). Counted from Postgres in the router — never
// Redis — so they hold when integration:redis:board is off and include
// held/removed rows (a takedown doesn't refund quota).
//
// The checker functions land in Phase 2; this file holds the numbers only.

/** Per-user rolling-window caps. `null` = no cap for that window. */
export const BOARD_LIMITS = {
  post:          { perHour: 5,   perDay: 10 },
  offerPost:     { perHour: 3,   perDay: 5 },
  newOfferPost:  { perHour: 2,   perDay: 3 },
  comment:       { perHour: 30,  perDay: 100 },
  topicCreate:   { perHour: null, perDay: 6 },
  report:        { perHour: 10,  perDay: 30 },
  vote:          { perHour: 120, perDay: 500 },
  rejectedCreate:{ perHour: 5,   perDay: 10 },
  edit:          { perHour: 10,  perDay: 30 },
} as const;
export type BoardLimitAction = keyof typeof BOARD_LIMITS;

/** Per-user, per-target caps within 24 h (unless noted). */
export const BOARD_PER_POST_LIMITS = {
  /** New topic rows one post may create — counted after dedupe */
  newTopicsPerPost: 3,
  /** Topics on one post, existing + new */
  topicsPerPost: 5,
  commentsPerPost: 20,
  repliesPerParent: 5,
  voteChangesPerTarget: 10,
  /** Enforced by unique (reporter_id, target_kind, target_id) — ever, not 24 h */
  reportsPerTarget: 1,
  saveTogglesPerPost: 20,
  editsPerPost: 5,
} as const;

export const BOARD_COOLDOWNS = {
  /** Min gap between one user's consecutive posts */
  postMs: 30_000,
  /** Min gap between one user's consecutive comments */
  commentMs: 5_000,
  /** Same author linking the same catalog offer */
  sameOfferLinkDays: 7,
  /** Hitting the rejectedCreate cap locks writes this long */
  rejectLockHours: 24,
} as const;

/** New accounts get halved per-day caps (Math.ceil(limit / 2)). */
export const NEW_ACCOUNT = {
  maxAgeDays: 7,
} as const;

/** Per-day overrides by author standing (plan §8.5). `banned` → FORBIDDEN, admin → exempt. */
export const STANDING_DAILY_LIMITS = {
  watch:      { post: 3, comment: 30 },
  restricted: { post: 1, comment: 10 },
} as const;
