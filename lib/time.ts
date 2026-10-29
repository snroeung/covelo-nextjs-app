// One rule for dates and times. Timestamps are stored and exchanged in UTC.
// A calendar date with no time ("ends 2026-12-31") is shown as written, and
// the moment it stops counting is the end of that day in the *viewer's* zone:
// the browser sends its IANA zone on every request (TZ_HEADER), the server
// reads it into the tRPC context, and anything that depends on "today" uses it.

export const UTC = "UTC";
export const TZ_HEADER = "x-timezone";

export function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** A usable IANA zone from untrusted input (a header), else UTC. */
export function zoneOrUtc(tz: string | null | undefined): string {
  const v = tz?.trim();
  return v && v.length <= 64 && isValidTimeZone(v) ? v : UTC;
}

/** The browser's zone, e.g. "America/Los_Angeles". UTC off the browser or when it can't say. */
export function browserTimeZone(): string {
  try {
    return zoneOrUtc(Intl.DateTimeFormat().resolvedOptions().timeZone);
  } catch {
    return UTC;
  }
}

/** The calendar date, "YYYY-MM-DD", that `now` falls on in `timeZone`. */
export function dateInZone(now: Date, timeZone: string = UTC): string {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: zoneOrUtc(timeZone), year: "numeric", month: "2-digit", day: "2-digit" })
    .formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}
