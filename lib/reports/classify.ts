import type { BookingReport, QuoteValues, ReportResult } from '@/lib/reports/types';

const cents = (n: number) => Math.round(n * 100);

/** Whole days from start to end — nights for a stay, trip length for a round trip. One-way = 1. */
export function quoteDays(start: string, end: string | null): number {
  if (!end) return 1;
  const ms = Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`);
  return Number.isFinite(ms) ? Math.max(1, Math.round(ms / 86_400_000)) : 1;
}

/** A total spread across the quote's days. */
export function perDay(total: number, start: string, end: string | null): number {
  return total / quoteDays(start, end);
}

/**
 * Same per-day rate within a rounding step: a $1,000 / 3-night stay shows as
 * $333.33/nt, and someone who books 2 nights at $666.67 saw the same rate.
 */
function sameRate(a: number, aDays: number, b: number, bDays: number, step: number): boolean {
  return Math.abs(a / aDays - b / bDays) <= step + 1e-9;
}

/**
 * Matched when the traveller saw the quote's per-day cash (to the cent) and
 * per-day points — on any dates, so a shorter or shifted stay at the same
 * nightly rate still matches. Different otherwise; Not found when they
 * couldn't find the result at all (`entered` null).
 */
export function classifyReport(quote: QuoteValues, entered: QuoteValues | null): ReportResult {
  if (!entered) return 'not_found';
  const qDays = quoteDays(quote.start, quote.end);
  const eDays = quoteDays(entered.start, entered.end);
  const cashSame = sameRate(cents(entered.cash), eDays, cents(quote.cash), qDays, 1);
  const pointsSame = entered.points === null || quote.points === null
    ? (entered.points ?? null) === (quote.points ?? null)
    : sameRate(entered.points, eDays, quote.points, qDays, 1);
  return cashSame && pointsSame ? 'matched' : 'different';
}

/** The date a report is for: what the traveller entered, else the searched date. */
export function reportBookingDate(report: BookingReport, quote: QuoteValues): string {
  return report.reportedStart ?? quote.start;
}

/**
 * Reports for bookings from `today` on, today / soonest first; same date →
 * newest report first. Past-dated reports are dropped — a fare someone saw for
 * a date that's gone says nothing about what's bookable now. `today` null (no
 * clock yet) skips the cutoff but still sorts.
 */
export function upcomingReports(reports: BookingReport[], quote: QuoteValues, today: string | null): BookingReport[] {
  return reports
    .map(r => ({ r, date: reportBookingDate(r, quote) }))
    .filter(x => today === null || x.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date) || b.r.createdAt.localeCompare(a.r.createdAt))
    .map(x => x.r);
}

export interface ReportSummary {
  total: number;
  matched: number;
  /** Per-day cash range across reports that carry a price; null when none do */
  lo: number | null;
  hi: number | null;
}

/** Reported cash per day of the reported dates (searched dates when none); null without a price. */
export function reportPerDay(report: BookingReport, quote: QuoteValues): number | null {
  if (report.reportedCash === null) return null;
  return report.reportedStart === null
    ? perDay(report.reportedCash, quote.start, quote.end)
    : perDay(report.reportedCash, report.reportedStart, report.reportedEnd);
}

/** Counts plus the per-day cash range seen across reports. */
export function summarizeReports(reports: BookingReport[], quote: QuoteValues): ReportSummary {
  const prices = reports.map(r => reportPerDay(r, quote)).filter((c): c is number => c !== null);
  return {
    total: reports.length,
    matched: reports.filter(r => r.result === 'matched').length,
    lo: prices.length ? Math.min(...prices) : null,
    hi: prices.length ? Math.max(...prices) : null,
  };
}

/** Reported minus quoted cash, per day, to the cent; null when the report carries no price. */
export function cashDelta(report: BookingReport, quote: QuoteValues): number | null {
  const reported = reportPerDay(report, quote);
  if (reported === null) return null;
  return (Math.round(reported * 100) - Math.round(perDay(quote.cash, quote.start, quote.end) * 100)) / 100;
}

export function datesDiffer(report: BookingReport, quote: QuoteValues): boolean {
  if (report.reportedStart === null) return false;
  return report.reportedStart !== quote.start || (report.reportedEnd ?? null) !== (quote.end ?? null);
}
