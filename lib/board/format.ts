// Display helpers for the board. Pure.

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

/** "5m", "2h", "3d", "6w", "4mo" — how long ago, as compact as the post cards need. */
export function timeAgo(iso: string, now: number = Date.now()): string {
  const ms = Math.max(0, now - new Date(iso).getTime());
  if (!Number.isFinite(ms)) return "";
  if (ms < HOUR) return `${Math.max(1, Math.round(ms / MIN))}m`;
  if (ms < DAY) return `${Math.round(ms / HOUR)}h`;
  if (ms < 14 * DAY) return `${Math.round(ms / DAY)}d`;
  if (ms < 60 * DAY) return `${Math.round(ms / (7 * DAY))}w`;
  return `${Math.round(ms / (30 * DAY))}mo`;
}

/** "1 comment" / "4 comments" */
export function pluralize(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** "in 2 h 14 m" style wait for a retry-at timestamp; "a moment" when it has passed. */
export function untilLabel(iso: string, now: number = Date.now()): string {
  const ms = new Date(iso).getTime() - now;
  if (!Number.isFinite(ms) || ms <= 0) return "a moment";
  const totalMin = Math.ceil(ms / MIN);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return h > 0 ? (m > 0 ? `${h} h ${m} m` : `${h} h`) : `${m} m`;
}
