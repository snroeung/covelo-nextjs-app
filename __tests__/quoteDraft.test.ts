import { describe, it, expect } from 'vitest';
import { draftFromQuote, quoteFromDraft } from '@/components/booking/QuoteFields';

describe('draftFromQuote', () => {
  const base = { points: 108062, start: '2026-10-19', end: '2026-10-22' };
  it('rounds float noise to cents', () => {
    expect(draftFromQuote({ ...base, cash: 1350.768000000000 }).cash).toBe('1350.77');
  });
  it('keeps whole and 2dp amounts exact', () => {
    expect(draftFromQuote({ ...base, cash: 1262 }).cash).toBe('1262');
    expect(draftFromQuote({ ...base, cash: 421.5 }).cash).toBe('421.5');
  });
});

describe('quoteFromDraft', () => {
  const draft = { cash: '1302', points: '', start: '2026-10-19', end: '2026-10-22' };
  it('accepts today and later', () => {
    expect(quoteFromDraft(draft, true, '2026-10-19')).not.toBeNull();
    expect(quoteFromDraft(draft, true, '2026-10-01')).not.toBeNull();
  });
  it('rejects a start date before today', () => {
    expect(quoteFromDraft(draft, true, '2026-10-20')).toBeNull();
  });
  it('skips the past-date check with no clock yet', () => {
    expect(quoteFromDraft({ ...draft, start: '2020-01-01' }, true)).not.toBeNull();
  });
});
