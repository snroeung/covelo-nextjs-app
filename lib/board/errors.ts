// Turn whatever a failed board call threw into one line a member can act on.
// tRPC client errors carry the server's message, a code, and — for rate
// limits — when to try again (server/trpc.ts adds `data.retryAt`).

export interface BoardError {
  message: string;
  code: string | null;
  /** ISO time the member may retry, for rate limits */
  retryAt: string | null;
}

const FIELD_LABELS: Record<string, string> = {
  title: "Title",
  body: "Details",
  topics: "Topic",
  value: "Value",
  name: "Offer name",
  from: "From",
  to: "To",
  conditions: "Conditions",
  ends: "Ends",
  url: "Source link",
  note: "Note",
  reason: "Reason",
};

interface Issue {
  code?: string;
  path?: Array<string | number>;
  message?: string;
  minimum?: number;
  maximum?: number;
}

function friendlyIssue(issue: Issue): string {
  const field = [...(issue.path ?? [])].reverse().find((p): p is string => typeof p === "string");
  const label = field ? FIELD_LABELS[field] ?? field : null;
  if (issue.code === "too_small" && label) return issue.minimum === 1 ? `${label} is required.` : `${label} is too short.`;
  if (issue.code === "too_big" && label) return `${label} is too long${issue.maximum ? ` (max ${issue.maximum})` : ""}.`;
  return issue.message || "Something in the form isn't valid.";
}

export function describeError(err: unknown): BoardError {
  const e = err as { message?: string; data?: { code?: string; retryAt?: string } } | null;
  const code = e?.data?.code ?? null;
  const retryAt = typeof e?.data?.retryAt === "string" ? e.data.retryAt : null;
  const raw = typeof e?.message === "string" ? e.message : "";

  // Zod failures arrive as a JSON array of issues
  if (raw.startsWith("[")) {
    try {
      const issues = JSON.parse(raw) as Issue[];
      if (Array.isArray(issues) && issues.length > 0) return { message: friendlyIssue(issues[0]), code: code ?? "BAD_REQUEST", retryAt };
    } catch {
      /* fall through to the raw text */
    }
  }
  if (code === "UNAUTHORIZED") return { message: "Sign in to do that.", code, retryAt };
  if (/failed to fetch|networkerror|load failed/i.test(raw)) {
    return { message: "Can't reach covelo — check your connection and try again.", code: code ?? "NETWORK", retryAt };
  }
  return { message: raw || "Something went wrong. Try again.", code, retryAt };
}

export const isRateLimited = (e: BoardError) => e.code === "TOO_MANY_REQUESTS";
