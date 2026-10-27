// The feed's filters, as they live in the URL (/discover/board?type=offer&sort=new).
// The URL is the single source of truth, so a filtered feed can be shared and
// the back button restores it. Pure.

export type FeedType = "all" | "tip" | "offer";
export type FeedSort = "hot" | "new" | "top";

export interface BoardFilters {
  type: FeedType;
  /** A topic id, or null for all topics */
  topic: string | null;
  q: string;
  /** Verified offers only (ignored while browsing tips) */
  verified: boolean;
  sort: FeedSort;
}

export const DEFAULT_FILTERS: BoardFilters = { type: "all", topic: null, q: "", verified: false, sort: "hot" };

const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const MAX_QUERY = 100;

interface ParamReader {
  get(name: string): string | null;
}

/** Read filters from search params; anything unrecognised falls back to the default. */
export function parseFilters(params: ParamReader): BoardFilters {
  const type = params.get("type");
  const sort = params.get("sort");
  const topic = params.get("topic");
  return {
    type: type === "tip" || type === "offer" ? type : "all",
    topic: topic && GUID.test(topic) ? topic : null,
    q: (params.get("q") ?? "").slice(0, MAX_QUERY),
    verified: params.get("verified") === "1",
    sort: sort === "new" || sort === "top" ? sort : "hot",
  };
}

/** "?type=offer&sort=new", or "" when everything is the default. */
export function filtersToSearch(f: BoardFilters): string {
  const p = new URLSearchParams();
  if (f.type !== "all") p.set("type", f.type);
  if (f.topic) p.set("topic", f.topic);
  if (f.q.trim()) p.set("q", f.q.trim());
  if (f.verified && f.type !== "tip") p.set("verified", "1");
  if (f.sort !== "hot") p.set("sort", f.sort);
  const s = p.toString();
  return s ? `?${s}` : "";
}

/** The board.posts.list input for these filters. */
export function feedInput(f: BoardFilters) {
  return {
    type: f.type === "all" ? undefined : f.type,
    topic: f.topic ?? undefined,
    q: f.q.trim() || undefined,
    verified: f.verified && f.type !== "tip" ? true : undefined,
    sort: f.sort,
  };
}

/** Anything narrower than the default view — drives the "Clear filters" affordance. */
export function hasActiveFilters(f: BoardFilters): boolean {
  return f.type !== "all" || f.topic !== null || f.q.trim() !== "" || f.verified;
}
