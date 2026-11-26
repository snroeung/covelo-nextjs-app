import { describe, it, expect } from 'vitest';
import { pickBestSuggestion } from '@/lib/bestSuggestion';

const PARIS_FR = { placeId: 'p1', description: 'Paris, France' };
const PARIS_TX = { placeId: 'p2', description: 'Paris, TX, USA' };
const PHL = { placeId: 'iata:PHL', description: 'Philadelphia International Airport (PHL), Philadelphia, PA' };
const PNE = { placeId: 'iata:PNE', description: 'Northeast Philadelphia Airport (PNE), Philadelphia, PA' };

describe('pickBestSuggestion', () => {
  it('returns null when there are no suggestions or no text', () => {
    expect(pickBestSuggestion('Paris', [])).toBeNull();
    expect(pickBestSuggestion('   ', [PARIS_FR])).toBeNull();
  });

  it('picks the closest (top-ranked) suggestion when nothing matches exactly', () => {
    expect(pickBestSuggestion('Pari', [PARIS_FR, PARIS_TX])).toBe(PARIS_FR);
  });

  it('prefers an exact full-description match over the top suggestion', () => {
    expect(pickBestSuggestion('paris, tx, usa', [PARIS_FR, PARIS_TX])).toBe(PARIS_TX);
  });

  it('treats the primary name as an exact match ("Paris" ↔ "Paris, France")', () => {
    expect(pickBestSuggestion('Paris', [PARIS_FR, PARIS_TX])).toBe(PARIS_FR);
  });

  it('ignores case and extra whitespace', () => {
    expect(pickBestSuggestion('  PARIS,   tx,  usa ', [PARIS_FR, PARIS_TX])).toBe(PARIS_TX);
  });

  it('matches an airport by its IATA code', () => {
    expect(pickBestSuggestion('pne', [PHL, PNE], true)).toBe(PNE);
  });

  it('matches an airport by its name without the code suffix', () => {
    expect(pickBestSuggestion('Northeast Philadelphia Airport', [PHL, PNE], true)).toBe(PNE);
  });

  it('does not match IATA codes outside airport mode', () => {
    expect(pickBestSuggestion('pne', [PHL, PNE])).toBe(PHL);
  });
});
