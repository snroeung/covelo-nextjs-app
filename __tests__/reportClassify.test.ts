import { describe, it, expect } from 'vitest';
import { classifyReport, summarizeReports, cashDelta, datesDiffer, upcomingReports, quoteDays, perDay, reportPerDay } from '@/lib/reports/classify';
import { localIsoDate, laterDate } from '@/lib/dates';
import { flightSubjectKey, hotelSubjectKey, flightQuoteDates, reportOptionKey, reportsForOption } from '@/lib/reports/subject';
import type { BookingReport, QuoteValues } from '@/lib/reports/types';

const quote: QuoteValues = { cash: 1302, points: 104160, start: '2026-11-03', end: '2026-11-10' };

function report(over: Partial<BookingReport> = {}): BookingReport {
  return {
    id: 'r1', optionKey: 'portal:chase', optionName: 'Chase Travel', reporterName: 'Ana', result: 'matched', quotedCash: 1302,
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
  it('matched on different dates at the same per-day rate', () => {
    // 1302 over 7 days = 186/day; 6 days at 186 = 1116
    expect(classifyReport(quote, { ...quote, cash: 1116, points: 89280, end: '2026-11-09' })).toBe('matched');
  });
  it('matched within a cent of per-day rounding', () => {
    const q = { cash: 1000, points: null, start: '2026-11-01', end: '2026-11-04' }; // 333.33/night
    expect(classifyReport(q, { ...q, cash: 666.67, end: '2026-11-03' })).toBe('matched');
  });
  it('different when the dates change but the total does not', () => {
    expect(classifyReport(quote, { ...quote, end: '2026-11-11' })).toBe('different');
  });
  it('one-way quotes are one day', () => {
    const q = { ...quote, end: null };
    expect(classifyReport(q, { ...q, start: '2026-11-05' })).toBe('matched');
    expect(classifyReport(q, { ...q, cash: 1303 })).toBe('different');
  });
  it('treats a missing points value on both sides as equal', () => {
    const q = { ...quote, points: null };
    expect(classifyReport(q, { ...q })).toBe('matched');
  });
});

describe('quoteDays / perDay', () => {
  it('counts nights between dates, one for one-way or same-day', () => {
    expect(quoteDays('2026-11-03', '2026-11-10')).toBe(7);
    expect(quoteDays('2026-11-03', null)).toBe(1);
    expect(quoteDays('2026-11-03', '2026-11-03')).toBe(1);
    expect(quoteDays('2026-03-07', '2026-03-09')).toBe(2); // across a DST change
  });
  it('spreads the total across the days', () => {
    expect(perDay(1302, '2026-11-03', '2026-11-10')).toBe(186);
  });
});

describe('summarizeReports', () => {
  it('counts matched and the per-day cash range, ignoring not-found rows', () => {
    const s = summarizeReports([
      report(),
      report({ id: 'r2', result: 'different', reportedCash: 1260 }),
      report({ id: 'r3', result: 'not_found', reportedCash: null, reportedStart: null, reportedEnd: null }),
    ], quote);
    expect(s).toEqual({ total: 3, matched: 1, lo: 180, hi: 186 });
  });
  it('null range when no report carries a price', () => {
    expect(summarizeReports([report({ result: 'not_found', reportedCash: null })], quote))
      .toEqual({ total: 1, matched: 0, lo: null, hi: null });
  });
});

describe('cashDelta / datesDiffer', () => {
  it('signed per-day delta against the quote', () => {
    expect(cashDelta(report({ reportedCash: 1260 }), quote)).toBe(-6);
    // 3 nights at 190 vs 186/day quoted
    expect(cashDelta(report({ reportedCash: 570, reportedEnd: '2026-11-06' }), quote)).toBe(4);
  });
  it('null delta for not-found', () => {
    expect(cashDelta(report({ reportedCash: null }), quote)).toBeNull();
  });
  it('per-day uses the searched dates when the report has none', () => {
    expect(reportPerDay(report({ reportedCash: 1302, reportedStart: null, reportedEnd: null }), quote)).toBe(186);
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

describe('reportsForOption', () => {
  const tap1 = report({ id: 't1', optionKey: 'transfer:x', optionName: 'TAP Miles&Go' });
  const tap2 = report({ id: 't2', optionKey: 'transfer:y', optionName: 'TAP Air Portugal Miles&Go' });
  const fb = report({ id: 'f1', optionKey: 'transfer:blue-flying', optionName: 'Flying Blue' });
  const chase = report({ id: 'c1' });
  const all = [tap1, tap2, fb, chase];

  it('portal rows take only their own portal', () => {
    expect(reportsForOption(all, { kind: 'portal', sourcePortalId: 'chase', sourceName: 'Chase Travel' })).toEqual([chase]);
  });
  it('transfer rows gather every spelling of the same program', () => {
    const got = reportsForOption(all, { kind: 'transfer', sourcePortalId: 'c1', sourceName: 'TAP Air Portugal Miles&Go' });
    expect(got.map(r => r.id)).toEqual(['t1', 't2']);
  });
  it('a portal named like a program never leaks into a transfer row', () => {
    expect(reportsForOption(all, { kind: 'transfer', sourcePortalId: 'chase', sourceName: 'Chase Travel' })).toEqual([]);
  });
});

describe('upcomingReports', () => {
  const ids = (rs: BookingReport[]) => rs.map(r => r.id);

  it('drops reports for past booking dates and keeps today', () => {
    const out = upcomingReports([
      report({ id: 'past', reportedStart: '2026-10-10' }),
      report({ id: 'today', reportedStart: '2026-10-11' }),
      report({ id: 'later', reportedStart: '2026-11-03' }),
    ], quote, '2026-10-11');
    expect(ids(out)).toEqual(['today', 'later']);
  });

  it('orders today / soonest first, newest report first on the same date', () => {
    const out = upcomingReports([
      report({ id: 'far', reportedStart: '2026-12-01', createdAt: '2026-10-09T00:00:00Z' }),
      report({ id: 'soon-old', reportedStart: '2026-10-12', createdAt: '2026-10-01T00:00:00Z' }),
      report({ id: 'soon-new', reportedStart: '2026-10-12', createdAt: '2026-10-05T00:00:00Z' }),
    ], quote, '2026-10-11');
    expect(ids(out)).toEqual(['soon-new', 'soon-old', 'far']);
  });

  it('a not-found report (no reported dates) falls back to the searched date', () => {
    const nf = report({ id: 'nf', result: 'not_found', reportedStart: null, reportedEnd: null });
    expect(ids(upcomingReports([nf], quote, '2026-11-03'))).toEqual(['nf']);
    expect(upcomingReports([nf], quote, '2026-11-04')).toEqual([]);
  });

  it('with no clock yet, keeps everything but still sorts', () => {
    const out = upcomingReports([
      report({ id: 'b', reportedStart: '2026-11-05' }),
      report({ id: 'a', reportedStart: '2020-01-01' }),
    ], quote, null);
    expect(ids(out)).toEqual(['a', 'b']);
  });

  it('localIsoDate formats in local time with zero padding', () => {
    expect(localIsoDate(new Date(2026, 0, 5, 23, 30).getTime())).toBe('2026-01-05');
  });

  it('laterDate picks the later date and ignores blanks', () => {
    expect(laterDate('2026-10-11', '2026-10-20')).toBe('2026-10-20');
    expect(laterDate('2026-10-20', '2026-10-11')).toBe('2026-10-20');
    expect(laterDate('', '2026-10-11')).toBe('2026-10-11');
    expect(laterDate('2026-10-11', undefined)).toBe('2026-10-11');
    expect(laterDate(undefined, undefined)).toBeUndefined();
  });
});
