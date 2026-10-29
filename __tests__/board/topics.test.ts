import { describe, it, expect } from 'vitest';
import {
  singularize, normalizeTopic, isProgramTopic, topicKey, validateTopic, keySimilarity, matchTopic, suggestTopicForText, type TopicRef,
} from '@/lib/board/topics';
import { BOARD_COMMON_TOPICS } from '@/lib/board/constants';

const TOPICS: TopicRef[] = [
  { name: 'Transfer bonuses', key: 'transfer bonus' },
  { name: 'Hotels', key: 'hotel' },
  { name: 'Award flights', key: 'award flight' },
  { name: 'Statement credits', key: 'statement credit' },
  { name: 'Lounges', key: 'lounge' },
  { name: 'World of Hyatt', key: 'world of hyatt' },
];

describe('singularize', () => {
  it.each([
    ['flights', 'flight'], ['credits', 'credit'], ['lounges', 'lounge'], ['bonuses', 'bonus'],
    ['passes', 'pass'], ['companies', 'company'], ['boxes', 'box'], ['beaches', 'beach'],
    ['status', 'status'], ['bonus', 'bonus'], ['class', 'class'], ['business', 'business'],
    ['miles', 'miles'], ['honors', 'honors'], ['bus', 'bus'], ['visa', 'visa'],
  ])('%s → %s', (word, expected) => {
    expect(singularize(word)).toBe(expected);
  });
});

describe('topicKey', () => {
  it('matches the keys seeded in 025_board.sql', () => {
    expect(BOARD_COMMON_TOPICS.map(topicKey)).toEqual(['transfer bonus', 'hotel', 'award flight', 'statement credit']);
  });

  it('folds case, hyphens, plural and "&"/"and"', () => {
    expect(topicKey('Award-Flights')).toBe('award flight');
    expect(topicKey('award flight')).toBe('award flight');
    expect(topicKey('Bars & Lounges')).toBe('bars lounge');
    expect(topicKey('Bars and Lounges')).toBe('bars lounge');
    expect(topicKey('  LOUNGES 🛋️ ')).toBe('lounge');
  });

  it('only singularizes the last word', () => {
    expect(topicKey('Points transfers')).toBe('points transfer');
  });
});

describe('normalizeTopic', () => {
  it('sentence-cases and collapses whitespace', () => {
    expect(normalizeTopic('  airport   LOUNGES ')).toBe('Airport lounges');
  });

  it('upper-cases known acronyms', () => {
    expect(normalizeTopic('tsa precheck')).toBe('TSA precheck');
    expect(normalizeTopic('ihg diamond')).toBe('IHG diamond');
  });

  it('keeps deliberate mixed case and short caps', () => {
    expect(normalizeTopic('AAdvantage deals')).toBe('AAdvantage deals');
    expect(normalizeTopic('JFK lounges')).toBe('JFK lounges');
  });

  it('strips emoji and stray punctuation, keeps & + - \'', () => {
    expect(normalizeTopic('✈️ Miles & More!!')).toBe('Miles & more');
    expect(normalizeTopic("Kids' travel")).toBe("Kids' travel");
  });

  it('caps length at 28', () => {
    expect(normalizeTopic('a'.repeat(40))).toHaveLength(28);
  });
});

describe('validateTopic', () => {
  it('accepts a normal topic and returns name + key', () => {
    expect(validateTopic('airport lounges')).toEqual({ ok: true, name: 'Airport lounges', key: 'airport lounge' });
  });

  it.each([
    ['x', 'at least 2'],
    ['🛋️', 'at least 2'],
    ['1234', 'one letter'],
    ['one two three four five', '4 words'],
    ['visit hyatt.com', 'links'],
    ['@admin', 'links'],
    ['#deals', 'links'],
  ])('rejects %s', (raw, message) => {
    const r = validateTopic(raw);
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error).toContain(message);
  });

  it('rejects names the isBlocked callback flags', () => {
    const r = validateTopic('Zorblax deals', { isBlocked: (n) => n.toLowerCase().includes('zorblax') });
    expect(r).toEqual({ ok: false, error: 'That topic name breaks the board rules.' });
  });

  it('skips the blocked check when no callback is given (client)', () => {
    expect(validateTopic('Zorblax deals').ok).toBe(true);
  });
});

describe('keySimilarity', () => {
  it('is 1 for equal keys and lower for different ones', () => {
    expect(keySimilarity('lounge', 'lounge')).toBe(1);
    expect(keySimilarity('lounge', 'lounges')).toBeGreaterThanOrEqual(0.8);
    expect(keySimilarity('lounge', 'hotel')).toBeLessThan(0.3);
  });
});

describe('matchTopic', () => {
  it('finds an exact key match regardless of case and plural', () => {
    expect(matchTopic('lounges', TOPICS).exact?.name).toBe('Lounges');
    expect(matchTopic('HOTEL', TOPICS).exact?.name).toBe('Hotels');
  });

  it('treats the same loyalty program as an exact match', () => {
    expect(matchTopic('Hyatt', TOPICS).exact?.name).toBe('World of Hyatt');
  });

  it('does not apply program matching to ordinary words', () => {
    expect(matchTopic('Award', TOPICS).exact).toBeNull();
    expect(isProgramTopic('Award flights')).toBe(false);
    expect(isProgramTopic('Flying Blue')).toBe(true);
  });

  it('offers "Did you mean" for a strong near-match', () => {
    const r = matchTopic('Lounje', TOPICS);
    expect(r.exact).toBeNull();
    expect(r.suggestions.map((t) => t.name)).toContain('Lounges');
  });

  it('suggests topics that contain the draft', () => {
    expect(matchTopic('award', TOPICS).suggestions[0]?.name).toBe('Award flights');
  });

  it('returns nothing for an unrelated draft', () => {
    expect(matchTopic('Cruises', TOPICS)).toEqual({ exact: null, didYouMean: null, suggestions: [] });
  });

  it('caps suggestions at 5', () => {
    const many = Array.from({ length: 8 }, (_, i) => ({ name: `Lounge ${i}`, key: `lounge ${i}` }));
    expect(matchTopic('lounge', many).suggestions.length).toBeLessThanOrEqual(5);
  });
});

describe('suggestTopicForText', () => {
  it('suggests Award flights for an award-search tip', () => {
    expect(suggestTopicForText('Search awards one passenger at a time — the second seat is often in a different fare bucket', TOPICS)?.name).toBe('Award flights');
  });

  it('suggests Transfer bonuses for a transfer post', () => {
    expect(suggestTopicForText('Bilt 30% transfer bonus to Hyatt is live', TOPICS)?.name).toBe('Transfer bonuses');
  });

  it("uses a custom topic's own words", () => {
    expect(suggestTopicForText('Best lounge at JFK terminal 4?', TOPICS)?.name).toBe('Lounges');
  });

  it('returns null when nothing matches', () => {
    expect(suggestTopicForText('Who wins the election?', TOPICS)).toBeNull();
    expect(suggestTopicForText('', TOPICS)).toBeNull();
  });
});
