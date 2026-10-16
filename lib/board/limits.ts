// Board rate limits (plan §3.1). Counted from Postgres in the router — never
// Redis — so they hold when integration:redis:board is off and include
// held/removed rows (a takedown doesn't refund quota).
//
// The router fetches the caller's recent event timestamps; the checkers
// below are pure so every limit is unit-testable.

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

// ─── Checkers ────────────────────────────────────────────────────────────────

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

export type Standing = "normal" | "watch" | "restricted" | "banned";

export interface LimitContext {
  isAdmin: boolean;
  standing: Standing;
  accountCreatedAt: Date;
  /** Clean/unscanned, non-deleted posts the user has — 0 means still "new" */
  approvedPostCount: number;
  now: Date;
}

export type LimitResult =
  | { ok: true }
  | { ok: false; code: "TOO_MANY_REQUESTS"; message: string; retryAt: Date }
  | { ok: false; code: "FORBIDDEN"; message: string }
  | { ok: false; code: "BAD_REQUEST"; message: string };

const OK: LimitResult = { ok: true };

/** Plural noun used in member-facing limit messages. */
const ACTION_NOUN: Record<BoardLimitAction, string> = {
  post: "posts",
  offerPost: "offer posts",
  newOfferPost: "new offers",
  comment: "comments",
  topicCreate: "new topics",
  report: "reports",
  vote: "votes",
  rejectedCreate: "blocked submissions",
  edit: "edits",
};

/** Verb phrase for "You can … again in …". */
const ACTION_VERB: Record<BoardLimitAction, string> = {
  post: "post",
  offerPost: "share an offer",
  newOfferPost: "submit a new offer",
  comment: "comment",
  topicCreate: "create a topic",
  report: "report",
  vote: "vote",
  rejectedCreate: "post",
  edit: "edit",
};

export function isNewAccount(ctx: Pick<LimitContext, "accountCreatedAt" | "approvedPostCount" | "now">): boolean {
  const ageDays = (ctx.now.getTime() - ctx.accountCreatedAt.getTime()) / DAY_MS;
  return ageDays < NEW_ACCOUNT.maxAgeDays || ctx.approvedPostCount === 0;
}

/** Caps after new-account halving and standing overrides. `null` = no cap. */
export function effectiveLimits(action: BoardLimitAction, ctx: LimitContext): { perHour: number | null; perDay: number | null } {
  const base = BOARD_LIMITS[action];
  let perDay: number | null = base.perDay;
  if (perDay !== null && isNewAccount(ctx)) perDay = Math.ceil(perDay / 2);
  if (ctx.standing === "watch" || ctx.standing === "restricted") {
    const override = STANDING_DAILY_LIMITS[ctx.standing];
    const key = action === "comment" ? "comment" : action === "post" || action === "offerPost" || action === "newOfferPost" ? "post" : null;
    if (key && perDay !== null) perDay = Math.min(perDay, override[key]);
  }
  // A per-hour cap above the per-day cap is meaningless; keep them consistent
  const perHour = base.perHour === null ? null : perDay === null ? base.perHour : Math.min(base.perHour, perDay);
  return { perHour, perDay };
}

/** "2 h 14 m", "45 m", "less than a minute" */
export function formatWait(ms: number): string {
  const totalMin = Math.ceil(ms / 60_000);
  if (totalMin <= 0) return "less than a minute";
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return h > 0 ? (m > 0 ? `${h} h ${m} m` : `${h} h`) : `${m} m`;
}

/**
 * When the window frees up a slot: the event that has to age out is the
 * (count − cap + 1)-th oldest inside the window.
 */
function retryAtFor(inWindow: Date[], cap: number, windowMs: number): Date {
  const sorted = [...inWindow].sort((a, b) => a.getTime() - b.getTime());
  const blocker = sorted[sorted.length - cap];
  return new Date(blocker.getTime() + windowMs);
}

/**
 * Rolling-window check for one action. `timestamps` = the user's events of
 * this kind in the last 24 h (any order; older ones are ignored).
 */
export function checkRateLimit(action: BoardLimitAction, timestamps: readonly Date[], ctx: LimitContext): LimitResult {
  if (ctx.isAdmin) return OK;
  if (ctx.standing === "banned") return { ok: false, code: "FORBIDDEN", message: "Your account can't post on the board." };

  const { perHour, perDay } = effectiveLimits(action, ctx);
  const now = ctx.now.getTime();
  const inDay = timestamps.filter((t) => now - t.getTime() < DAY_MS);
  const inHour = inDay.filter((t) => now - t.getTime() < HOUR_MS);

  const breaches: Array<{ retryAt: Date; cap: number; window: "hour" | "day" }> = [];
  if (perDay !== null && inDay.length >= perDay) {
    breaches.push({ retryAt: perDay === 0 ? new Date(now + DAY_MS) : retryAtFor(inDay, perDay, DAY_MS), cap: perDay, window: "day" });
  }
  if (perHour !== null && inHour.length >= perHour) {
    breaches.push({ retryAt: perHour === 0 ? new Date(now + HOUR_MS) : retryAtFor(inHour, perHour, HOUR_MS), cap: perHour, window: "hour" });
  }
  if (breaches.length === 0) return OK;

  // The member waits for the later of the two windows
  const worst = breaches.reduce((a, b) => (b.retryAt > a.retryAt ? b : a));
  return {
    ok: false,
    code: "TOO_MANY_REQUESTS",
    retryAt: worst.retryAt,
    message: `You can ${ACTION_VERB[action]} again in ${formatWait(worst.retryAt.getTime() - now)} — limit is ${worst.cap} ${ACTION_NOUN[action]} per ${worst.window}.`,
  };
}

/** Minimum gap since the user's previous post/comment. */
export function checkCooldown(kind: "post" | "comment", lastAt: Date | null, ctx: Pick<LimitContext, "isAdmin" | "now">): LimitResult {
  if (ctx.isAdmin || !lastAt) return OK;
  const gap = kind === "post" ? BOARD_COOLDOWNS.postMs : BOARD_COOLDOWNS.commentMs;
  const elapsed = ctx.now.getTime() - lastAt.getTime();
  if (elapsed >= gap) return OK;
  const retryAt = new Date(lastAt.getTime() + gap);
  const secs = Math.ceil((gap - elapsed) / 1000);
  return { ok: false, code: "TOO_MANY_REQUESTS", retryAt, message: `Slow down — you can ${kind} again in ${secs} s.` };
}

/** Write lock after too many rejected submissions (BOARD_COOLDOWNS.rejectLockHours). */
export function checkRejectLock(rejectedTimestamps: readonly Date[], ctx: LimitContext): LimitResult {
  if (ctx.isAdmin) return OK;
  const limit = checkRateLimit("rejectedCreate", rejectedTimestamps, ctx);
  if (limit.ok || limit.code !== "TOO_MANY_REQUESTS") return limit;
  const latest = rejectedTimestamps.reduce((a, b) => (b > a ? b : a));
  const retryAt = new Date(latest.getTime() + BOARD_COOLDOWNS.rejectLockHours * HOUR_MS);
  return {
    ok: false,
    code: "TOO_MANY_REQUESTS",
    retryAt,
    message: `Too many submissions broke the board rules. You can post again in ${formatWait(retryAt.getTime() - ctx.now.getTime())}.`,
  };
}

/** Topic caps on one post: ≤5 topics total, ≤3 of them new (counted after dedupe). */
export function checkPostTopics(totalTopics: number, newTopics: number): LimitResult {
  if (totalTopics < 1) return { ok: false, code: "BAD_REQUEST", message: "Pick at least one topic." };
  if (totalTopics > BOARD_PER_POST_LIMITS.topicsPerPost) {
    return { ok: false, code: "BAD_REQUEST", message: `Pick up to ${BOARD_PER_POST_LIMITS.topicsPerPost} topics.` };
  }
  if (newTopics > BOARD_PER_POST_LIMITS.newTopicsPerPost) {
    return { ok: false, code: "BAD_REQUEST", message: `Max ${BOARD_PER_POST_LIMITS.newTopicsPerPost} new topics per post.` };
  }
  return OK;
}

/** Per-target 24 h caps (comments on a post, replies to a parent, vote changes, saves, edits). */
export type PerTargetLimit = "commentsPerPost" | "repliesPerParent" | "voteChangesPerTarget" | "saveTogglesPerPost" | "editsPerPost";

const PER_TARGET_MESSAGE: Record<PerTargetLimit, (cap: number) => string> = {
  commentsPerPost: (cap) => `You've hit ${cap} comments on this post for today.`,
  repliesPerParent: (cap) => `You've hit ${cap} replies to this comment for today.`,
  voteChangesPerTarget: (cap) => `You've changed this vote ${cap} times today — it's locked until tomorrow.`,
  saveTogglesPerPost: (cap) => `You've toggled save on this post ${cap} times today.`,
  editsPerPost: (cap) => `You've edited this post ${cap} times today.`,
};

export function checkPerTarget(limit: PerTargetLimit, countLast24h: number, ctx: Pick<LimitContext, "isAdmin" | "now">): LimitResult {
  if (ctx.isAdmin) return OK;
  const cap = BOARD_PER_POST_LIMITS[limit];
  if (countLast24h < cap) return OK;
  return { ok: false, code: "TOO_MANY_REQUESTS", message: PER_TARGET_MESSAGE[limit](cap), retryAt: new Date(ctx.now.getTime() + DAY_MS) };
}

/** Remaining quota for the composer (board.limits.me). */
export function remaining(action: BoardLimitAction, timestamps: readonly Date[], ctx: LimitContext): { hour: number | null; day: number | null } {
  if (ctx.isAdmin) return { hour: null, day: null };
  const { perHour, perDay } = effectiveLimits(action, ctx);
  const now = ctx.now.getTime();
  const inDay = timestamps.filter((t) => now - t.getTime() < DAY_MS).length;
  const inHour = timestamps.filter((t) => now - t.getTime() < HOUR_MS).length;
  return {
    hour: perHour === null ? null : Math.max(0, perHour - inHour),
    day: perDay === null ? null : Math.max(0, perDay - inDay),
  };
}
