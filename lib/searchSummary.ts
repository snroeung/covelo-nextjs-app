// Short labels for the phone results bar ("PHL → SFO" / "Oct 03 – Oct 06 · 1 adult").
// Dates come in as 'YYYY-MM-DD' and are read as plain strings — going through
// Date would shift them by the viewer's timezone.

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** '2026-10-03' → 'Oct 03'; anything unparseable comes back unchanged. */
export function shortDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  const month = MONTHS[Number(m[2]) - 1];
  return month ? `${month} ${m[3]}` : iso;
}

/** 'Oct 03 – Oct 06', or just 'Oct 03' for a one-way / open-ended trip. */
export function dateRange(start: string, end?: string | null): string {
  if (!start) return '';
  return end ? `${shortDate(start)} – ${shortDate(end)}` : shortDate(start);
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

export function flightSummarySubtitle(start: string, end: string | null | undefined, passengers: number): string {
  return [dateRange(start, end), plural(passengers, 'adult')].filter(Boolean).join(' · ');
}

export function staySummarySubtitle(checkIn: string, checkOut: string, nights: number, guests: number): string {
  return [dateRange(checkIn, checkOut), plural(nights, 'night'), plural(guests, 'guest')].filter(Boolean).join(' · ');
}

/** Whole nights between two 'YYYY-MM-DD' dates (UTC math, so DST can't skew it); 0 when either is missing or the range is inverted. */
export function nightsBetween(checkIn: string, checkOut: string): number {
  const a = /^(\d{4})-(\d{2})-(\d{2})/.exec(checkIn);
  const b = /^(\d{4})-(\d{2})-(\d{2})/.exec(checkOut);
  if (!a || !b) return 0;
  const ms = Date.UTC(+b[1], +b[2] - 1, +b[3]) - Date.UTC(+a[1], +a[2] - 1, +a[3]);
  return Math.max(0, Math.round(ms / 86_400_000));
}
