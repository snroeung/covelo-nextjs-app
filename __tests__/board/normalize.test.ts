import { describe, it, expect } from 'vitest';
import { normalizeForLexicon } from '@/lib/board/moderation/normalize';

describe('normalizeForLexicon', () => {
  it('lowercases and strips accents', () => {
    expect(normalizeForLexicon('ÇAFÉ Ünïcode')).toBe('cafe unicode');
  });

  it('removes zero-width characters inside words', () => {
    expect(normalizeForLexicon('Hy​att')).toBe('hyatt');
  });

  it('keeps digits and expands &', () => {
    expect(normalizeForLexicon('Miles&Smiles 5/24')).toBe('miles and smiles 5 24');
  });

  it('turns punctuation into single spaces', () => {
    expect(normalizeForLexicon('Bilt → Hyatt, 30%!!')).toBe('bilt hyatt 30');
  });
});
