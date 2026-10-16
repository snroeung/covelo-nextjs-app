import { describe, it, expect } from 'vitest';
import { scanBlocklist, type BlockedTerm } from '@/lib/board/moderation/blocklist';

// No offensive words in this repo (obscenity owns the English list). Plumbing
// is tested with made-up admin terms; the English dataset is tested only for
// what it must NOT flag.

const ADMIN_TERMS: BlockedTerm[] = [
  { term: 'zorblax', tier: 'hard' },
  { term: 'quimbly', tier: 'soft' },
];

describe('scanBlocklist — English dataset (negative cases)', () => {
  it.each([
    'Bilt → Hyatt 30% is live — Cat 1–4 rooms land near 2.4¢ a point',
    'Search awards one passenger at a time; the second seat is often a different fare bucket',
    'Booked a business class seat to Tokyo with Aeroplan, assistant at the lounge was great',
    'The pen is mightier than the sword',
    'Grapes and bananas so cheap at the airport market',
    'Visited the Dickens museum, then a pub in Scunthorpe',
    'Hancock Park, Essex, Middlesex and Sussex hotels',
    'Analysis of the 5/24 rule for Chase cards',
  ])('passes clean text: %s', (text) => {
    expect(scanBlocklist(text)).toEqual({ tier: null, hits: [] });
  });

  it('returns nothing for empty text', () => {
    expect(scanBlocklist('   ')).toEqual({ tier: null, hits: [] });
  });
});

describe('scanBlocklist — admin terms', () => {
  it('flags an admin hard term as hard', () => {
    expect(scanBlocklist('this is zorblax', ADMIN_TERMS)).toEqual({ tier: 'hard', hits: ['zorblax'] });
  });

  it('flags an admin soft term as soft', () => {
    expect(scanBlocklist('so quimbly today', ADMIN_TERMS)).toEqual({ tier: 'soft', hits: ['quimbly'] });
  });

  it('hard wins over soft and both are reported', () => {
    const r = scanBlocklist('quimbly and zorblax', ADMIN_TERMS);
    expect(r.tier).toBe('hard');
    expect(r.hits.sort()).toEqual(['quimbly', 'zorblax']);
  });

  it('catches obfuscated admin terms through obscenity transformers', () => {
    expect(scanBlocklist('z0rbl4x', ADMIN_TERMS).tier).toBe('hard');      // leetspeak
    // "!" is leetspeak for "i" to obscenity, so use "." for the case + punctuation check
    expect(scanBlocklist('ZORBLAX.', ADMIN_TERMS).tier).toBe('hard');     // case + punctuation
    expect(scanBlocklist('zorrrrblax', ADMIN_TERMS).tier).toBe('hard');   // stretched letters
    expect(scanBlocklist('ｚｏｒｂｌａｘ', ADMIN_TERMS).tier).toBe('hard');   // full-width look-alikes
  });

  it('matches admin terms as whole words only', () => {
    expect(scanBlocklist('superzorblaxian', ADMIN_TERMS).tier).toBeNull();
  });

  it('matches multi-word admin terms', () => {
    const terms: BlockedTerm[] = [{ term: 'buy  my course', tier: 'soft' }];
    expect(scanBlocklist('please buy my course now', terms).tier).toBe('soft');
  });

  it('escapes obscenity pattern syntax in admin terms', () => {
    const terms: BlockedTerm[] = [{ term: 'a?b', tier: 'soft' }];
    expect(scanBlocklist('axb', terms).tier).toBeNull();
  });

  it('ignores blank admin terms', () => {
    expect(scanBlocklist('hello', [{ term: '  ', tier: 'hard' }]).tier).toBeNull();
  });

  it('reuses compiled matchers for the same term list', () => {
    const terms: BlockedTerm[] = [{ term: 'zorblax', tier: 'soft' }];
    expect(scanBlocklist('zorblax', terms).tier).toBe('soft');
    expect(scanBlocklist('title zorblax', terms).tier).toBe('soft');
  });
});
