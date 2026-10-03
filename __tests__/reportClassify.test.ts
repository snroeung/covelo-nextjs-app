import { describe, it, expect } from 'vitest';
import { classifyReport, changedFields, summarizeReports, cashDelta, datesDiffer } from '@/lib/reports/classify';
import { flightSubjectKey, hotelSubjectKey, flightQuoteDates, reportOptionKey } from '@/lib/reports/subject';
import type { BookingReport, QuoteValues } from '@/lib/reports/types';

const quote: QuoteValues = { cash: 1302, points: 104160, start: '2026-11-03', end: '2026-11-10' };

function report(over: Partial<BookingReport> = {}): BookingReport {
  return {
    id: 'r1', optionKey: 'chase', reporterName: 'Ana', result: 'matched', quotedCash: 1302,
    reportedCash: 1302, reportedPoints: 104160, reportedStart: '2026-11-03', reportedEnd: '2026-11-10',
    createdAt: '2026-10-01T00:00:00Z', isMine: false, ...over,
  };
}

describe('classifyReport', () => {
  it('not found when nothing was entered', () => {
    expect(classifyReport(quote, null)).toBe('not_found');
  });
  it('matched when every value equals the quote', () => {
    expect(classifyReport(quote, { ...quote })).toBe('matched');
  });
  it('matched compares cash to the cent', () => {
    expect(classifyReport(quote, { ...quote, cash: 1302.001 })).toBe('matched');
  });
  it('different when cash changes', () => {
    expect(classifyReport(quote, { ...quote, cash: 1350 })).toBe('different');
  });
  it('different when points change', () => {
    expect(classifyReport(quote, { ...quote, points: 90000 })).toBe('different');
  });
  it('different when a date changes', () => {
    expect(classifyReport(quote, { ...quote, end: '2026-11-11' })).toBe('different');
  });
  it('treats a missing points value on both sides as equal', () => {
    const q = { ...quote, points: null };
    expect(classifyReport(q, { ...q })).toBe('matched');
  });
});

describe('changedFields', () => {
  it('lists each changed field once', () => {
    expect(changedFields(quote, { ...quote, cash: 1, start: '2026-11-04', end: '2026-11-11' }))
      .toEqual(['cash price', 'dates']);
  });
  it('is empty when nothing changed', () => {
    expect(changedFields(quote, { ...quote })).toEqual([]);
  });
});

describe('summarizeReports', () => {
  it('counts matched and the cash range, ignoring not-found rows', () => {
    const s = summarizeReports([
      report(),
      report({ id: 'r2', result: 'different', reportedCash: 1250 }),
      report({ id: 'r3', result: 'not_found', reportedCash: null }),
    ]);
    expect(s).toEqual({ total: 3, matched: 1, lo: 1250, hi: 1302 });
  });
  it('null range when no report carries a price', () => {
    expect(summarizeReports([report({ result: 'not_found', reportedCash: null })]))
      .toEqual({ total: 1, matched: 0, lo: null, hi: null });
  });
});

describe('cashDelta / datesDiffer', () => {
  it('signed delta against the quote', () => {
    expect(cashDelta(report({ reportedCash: 1250 }), 1302)).toBe(-52);
    expect(cashDelta(report({ reportedCash: 1320.5 }), 1302)).toBe(18.5);
  });
  it('null delta for not-found', () => {
    expect(cashDelta(report({ reportedCash: null }), 1302)).toBeNull();
  });
  it('flags dates that differ from the search', () => {
    expect(datesDiffer(report(), quote)).toBe(false);
    expect(datesDiffer(report({ reportedEnd: '2026-11-12' }), quote)).toBe(true);
    expect(datesDiffer(report({ reportedStart: null }), quote)).toBe(false);
  });
});

describe('subject keys', () => {
  const seg = (o: string, d: string, at: string, n: string) => ({
    origin: { iata_code: o }, destination: { iata_code: d }, departing_at: at,
    marketing_carrier: { iata_code: 'ba' }, marketing_carrier_flight_number: n,
  });
  const offer = {
    id: 'off_123',
    slices: [
      { segments: [seg('JFK', 'LHR', '2026-11-03T18:00:00', '112'), seg('LHR', 'CDG', '2026-11-04T09:00:00', '304')] },
      { segments: [seg('CDG', 'JFK', '2026-11-10T11:00:00', '117')] },
    ],
  };

  it('flight key ignores the per-search offer id', () => {
    expect(flightSubjectKey(offer)).toBe(flightSubjectKey({ ...offer, id: 'off_999' }));
    expect(flightSubjectKey(offer)).toBe('JFK-CDG-2026-11-03-BA112+BA304|CDG-JFK-2026-11-10-BA117');
  });
  it('flight quote dates — end null for one-way', () => {
    expect(flightQuoteDates(offer)).toEqual({ start: '2026-11-03', end: '2026-11-10' });
    expect(flightQuoteDates({ slices: [offer.slices[0]] })).toEqual({ start: '2026-11-03', end: null });
  });
  it('hotel key normalizes room-name case and whitespace', () => {
    expect(hotelSubjectKey('acc_1', '  Deluxe   King ', '2026-11-03', '2026-11-05'))
      .toBe(hotelSubjectKey('acc_1', 'deluxe king', '2026-11-03T00:00:00', '2026-11-05'));
  });
});

describe('reportOptionKey', () => {
  it('portal rows key on the portal id', () => {
    expect(reportOptionKey({ kind: 'portal', sourcePortalId: 'chase', sourceName: 'Chase Travel' })).toBe('portal:chase');
  });
  it('transfer rows ignore the routing issuer and program-name spelling', () => {
    const a = reportOptionKey({ kind: 'transfer', sourcePortalId: 'c1', sourceName: 'British Airways Club' });
    const b = reportOptionKey({ kind: 'transfer', sourcePortalId: 'chase', sourceName: 'British Airways Executive Club' });
    expect(a).toBe(b);
    expect(a.startsWith('transfer:')).toBe(true);
  });
  it('different programs get different keys', () => {
    expect(reportOptionKey({ kind: 'transfer', sourcePortalId: 'amex', sourceName: 'Flying Blue' }))
      .not.toBe(reportOptionKey({ kind: 'transfer', sourcePortalId: 'amex', sourceName: 'Virgin Atlantic Flying Club' }));
  });
});
