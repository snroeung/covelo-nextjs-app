import { describe, expect, it } from 'vitest';
import { dateRange, flightSummarySubtitle, nightsBetween, shortDate, staySummarySubtitle } from '@/lib/searchSummary';

describe('searchSummary', () => {
  it('formats ISO dates without a timezone shift', () => {
    expect(shortDate('2026-10-03')).toBe('Oct 03');
    expect(shortDate('2026-01-01')).toBe('Jan 01');
    expect(shortDate('2026-12-31')).toBe('Dec 31');
  });

  it('leaves unparseable dates alone', () => {
    expect(shortDate('soon')).toBe('soon');
    expect(shortDate('2026-13-01')).toBe('2026-13-01');
  });

  it('builds a range, or a single date for one-way', () => {
    expect(dateRange('2026-10-03', '2026-10-06')).toBe('Oct 03 – Oct 06');
    expect(dateRange('2026-10-03')).toBe('Oct 03');
    expect(dateRange('2026-10-03', null)).toBe('Oct 03');
    expect(dateRange('')).toBe('');
  });

  it('summarises a flight search', () => {
    expect(flightSummarySubtitle('2026-10-03', '2026-10-06', 1)).toBe('Oct 03 – Oct 06 · 1 adult');
    expect(flightSummarySubtitle('2026-10-03', undefined, 2)).toBe('Oct 03 · 2 adults');
  });

  it('summarises a stay search', () => {
    expect(staySummarySubtitle('2026-10-03', '2026-10-06', 3, 2)).toBe('Oct 03 – Oct 06 · 3 nights · 2 guests');
    expect(staySummarySubtitle('2026-10-03', '2026-10-04', 1, 1)).toBe('Oct 03 – Oct 04 · 1 night · 1 guest');
  });

  it('counts nights across month ends and DST changes', () => {
    expect(nightsBetween('2026-10-03', '2026-10-06')).toBe(3);
    expect(nightsBetween('2026-10-30', '2026-11-02')).toBe(3);
    expect(nightsBetween('2026-11-01', '2026-11-02')).toBe(1); // US DST ends 2026-11-01
    expect(nightsBetween('2026-10-06', '2026-10-03')).toBe(0);
    expect(nightsBetween('', '2026-10-03')).toBe(0);
  });
});
