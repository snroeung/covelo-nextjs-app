import type { BookingReport, QuoteValues, ReportResult } from '@/lib/reports/types';

const cents = (n: number) => Math.round(n * 100);

/**
 * Matched when every value the traveller confirmed equals the quote, Different
 * when any was edited, Not found when they couldn't find the result at all
 * (`entered` null). Cash compares to the cent so 1302 and 1302.00 agree.
 */
export function classifyReport(quote: QuoteValues, entered: QuoteValues | null): ReportResult {
  if (!entered) return 'not_found';
  const same =
    cents(entered.cash) === cents(quote.cash) &&
    (entered.points ?? null) === (quote.points ?? null) &&
    entered.start === quote.start &&
    (entered.end ?? null) === (quote.end ?? null);
  return same ? 'matched' : 'different';
}

/** Which fields differ from the quote — drives the "You changed …" notice. */
export function changedFields(quote: QuoteValues, entered: QuoteValues): ('cash price' | 'points' | 'dates')[] {
  const out: ('cash price' | 'points' | 'dates')[] = [];
  if (cents(entered.cash) !== cents(quote.cash)) out.push('cash price');
  if ((entered.points ?? null) !== (quote.points ?? null)) out.push('points');
  if (entered.start !== quote.start || (entered.end ?? null) !== (quote.end ?? null)) out.push('dates');
  return out;
}

export interface ReportSummary {
  total: number;
  matched: number;
  /** Cash range across reports that carry a price; null when none do */
  lo: number | null;
  hi: number | null;
}

export function summarizeReports(reports: BookingReport[]): ReportSummary {
  const prices = reports.map(r => r.reportedCash).filter((c): c is number => c !== null);
  return {
    total: reports.length,
    matched: reports.filter(r => r.result === 'matched').length,
    lo: prices.length ? Math.min(...prices) : null,
    hi: prices.length ? Math.max(...prices) : null,
  };
}

/** Reported minus quoted cash; null when the report carries no price. */
export function cashDelta(report: BookingReport, quoteCash: number): number | null {
  if (report.reportedCash === null) return null;
  return (cents(report.reportedCash) - cents(quoteCash)) / 100;
}

export function datesDiffer(report: BookingReport, quote: QuoteValues): boolean {
  if (report.reportedStart === null) return false;
  return report.reportedStart !== quote.start || (report.reportedEnd ?? null) !== (quote.end ?? null);
}
