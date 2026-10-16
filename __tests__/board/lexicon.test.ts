import { describe, it, expect } from 'vitest';
import { lexiconScore } from '@/lib/board/moderation/lexicon';

describe('lexiconScore', () => {
  it('scores points/travel posts', () => {
    const r = lexiconScore('Transferred 40k Bilt points to Hyatt — posted instantly');
    expect(r.score).toBeGreaterThanOrEqual(3);
    expect(r.hits).toEqual(expect.arrayContaining(['bilt', 'points', 'hyatt']));
  });

  it('knows transfer partner brands from the seed list', () => {
    expect(lexiconScore('Turkish has saver space to Istanbul').hits).toContain('turkish');
    expect(lexiconScore('Aeroplan just repriced').hits).toContain('aeroplan');
  });

  it('matches plurals', () => {
    expect(lexiconScore('three lounges and two flights').hits).toEqual(expect.arrayContaining(['lounge', 'flight']));
  });

  it('scores 0 for unrelated text', () => {
    expect(lexiconScore('Who do you think wins the election this fall?').score).toBe(0);
    expect(lexiconScore('').score).toBe(0);
  });

  it('does not count generic words inside program names on their own', () => {
    // "world", "one", "plus" come from World of Hyatt / IHG One / United MileagePlus
    expect(lexiconScore('one world plus').score).toBe(0);
  });
});
