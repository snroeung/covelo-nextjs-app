import { describe, it, expect } from 'vitest';
import { parseTransferRatio, bestRatioFor, ratioMultiplier } from '@/lib/points/transferRatio';

// Every distinct ratio string in the live transfer_partners table, captured via
// trpc.portalData.listTransferPartners. Kept as a literal so the suite pins the
// shapes the parser must survive even as inventory changes.
const LIVE_RATIO_SHAPES = [
  '1:1',
  '1:2',
  '2:1',
  '3:2',
  '4:3',
  '5:3',
  '1:1 (standard, Sapphire Reserve); 4:3 (Chase Sapphire Preferred and Ink Business Preferred, effective 2026)',
  '1,000:1,000 (Strata Elite/Premier/Prestige) or 1,000:700 (other Citi ThankYou cards)',
  '1,000:1,200 (Strata Elite/Premier/Prestige) or 1,000:840 or 700 (other Citi ThankYou cards)',
  '1,000:1,500 (Strata Elite/Premier/Prestige) or 1,000:1,050 (other Citi ThankYou cards)',
  '1,000:2,000 (Strata Elite/Premier/Prestige) or 1,000:1,400 (other Citi ThankYou cards)',
  '1,000:200 (Strata Elite/Premier/Prestige) or 1,000:140 (other Citi ThankYou cards)',
  '1,000:500 (Strata Elite/Premier/Prestige) or 1,000:350 (other Citi ThankYou cards)',
  '1,000:800 (Strata Elite/Premier/Prestige) or 1,000:560 (other Citi ThankYou cards)',
];

describe('parseTransferRatio() — every shape in the live table', () => {
  it.each(LIVE_RATIO_SHAPES)('reads %s into a finite rate and a short label', (raw) => {
    const parsed = parseTransferRatio(raw);
    expect(Number.isFinite(parsed.multiplier)).toBe(true);
    expect(parsed.multiplier).toBeGreaterThan(0);
    // Chips render this inline — anything longer wraps the row.
    expect(parsed.label.length).toBeLessThanOrEqual(12);
    expect(parsed.detail).toBe(raw);
  });

  it('never falls back to 1.0 for a string that states a rate', () => {
    const nonUnity = LIVE_RATIO_SHAPES.filter(r => !r.startsWith('1:1'));
    for (const raw of nonUnity) {
      expect(parseTransferRatio(raw).multiplier).not.toBe(1);
    }
  });
});

describe('parseTransferRatio() — plain pairs', () => {
  // N:M is source:partner — "4:3" hands over four points to receive three, so it
  // is worth 0.75 per source point, not 1.33.
  it('keeps a clean pair as its own label and reads it source-first', () => {
    expect(parseTransferRatio('4:3')).toMatchObject({ multiplier: 0.75, label: '4:3' });
    expect(parseTransferRatio('1:2')).toMatchObject({ multiplier: 2, label: '1:2' });
    expect(parseTransferRatio('2:1')).toMatchObject({ multiplier: 0.5, label: '2:1' });
  });

  it('reads thousands separators', () => {
    expect(parseTransferRatio('1,000:1,200').multiplier).toBeCloseTo(1.2);
  });

  it('restates large pairs against one source point', () => {
    expect(parseTransferRatio('1,000:1,200').label).toBe('1:1.2');
    expect(parseTransferRatio('1,000:140').label).toBe('1:0.14');
  });

  it('reads decimals', () => {
    expect(parseTransferRatio('1:1.5').multiplier).toBeCloseTo(1.5);
  });
});

describe('parseTransferRatio() — per-card variants', () => {
  const HYATT = '1:1 (standard, Sapphire Reserve); 4:3 (Chase Sapphire Preferred and Ink Business Preferred, effective 2026)';

  it('gives each Chase card the rate written for it', () => {
    expect(parseTransferRatio(HYATT, 'Chase Sapphire Reserve')).toMatchObject({ multiplier: 1, label: '1:1' });
    // The 2026 Preferred rate is a devaluation: 4 UR in, 3 Hyatt points out.
    expect(parseTransferRatio(HYATT, 'Chase Sapphire Preferred').multiplier).toBeCloseTo(0.75);
    expect(parseTransferRatio(HYATT, 'Chase Sapphire Preferred').label).toBe('4:3');
  });

  it('falls back to the standard variant for a card no variant names', () => {
    expect(parseTransferRatio(HYATT, 'Chase Freedom Unlimited').multiplier).toBe(1);
  });

  const CITI = '1,000:1,200 (Strata Elite/Premier/Prestige) or 1,000:840 or 700 (other Citi ThankYou cards)';

  it('matches a tier qualifier that lists several cards', () => {
    expect(parseTransferRatio(CITI, 'Citi Strata Premier').multiplier).toBeCloseTo(1.2);
    expect(parseTransferRatio(CITI, 'Citi Strata Elite').multiplier).toBeCloseTo(1.2);
  });

  it('hands a trailing qualifier back to the rate it belongs to', () => {
    // "or 700 (other Citi ThankYou cards)" states no pair; its qualifier scopes
    // the 1,000:840 before it, which is the rate for every non-Strata Citi card.
    expect(parseTransferRatio(CITI, 'Citi Rewards Plus').multiplier).toBeCloseTo(0.84);
  });

  it('ignores issuer words so a catch-all does not match a named card', () => {
    // "other Citi ThankYou cards" shares "Citi" with every Citi card name.
    expect(parseTransferRatio(CITI, 'Citi Strata Premier').multiplier).not.toBeCloseTo(0.84);
  });

  it('uses the issuer default when no card is supplied', () => {
    expect(parseTransferRatio(HYATT).multiplier).toBe(1);
  });
});

describe('parseTransferRatio() — unreadable input', () => {
  it.each(['', 'ask the program', 'varies by route', 'N/A'])('degrades to 1:1 for %p', (raw) => {
    const parsed = parseTransferRatio(raw);
    expect(parsed.multiplier).toBe(1);
    expect(parsed.detail).toBe(raw.trim());
  });

  it('labels a long unreadable string rather than printing it', () => {
    expect(parseTransferRatio('depends entirely on the promotion running that month').label)
      .toBe('ratio varies');
  });
});

describe('bestRatioFor()', () => {
  const HYATT = '1:1 (standard, Sapphire Reserve); 4:3 (Chase Sapphire Preferred and Ink Business Preferred, effective 2026)';

  it('advertises the best rate available across an issuer\'s cards', () => {
    // Reserve's 1:1 beats Preferred's 4:3, so an unowned Chase chip advertises 1:1.
    const best = bestRatioFor(HYATT, ['Chase Sapphire Reserve', 'Chase Sapphire Preferred', 'Chase Freedom Unlimited']);
    expect(best.multiplier).toBe(1);
    expect(best.label).toBe('1:1');
  });

  it('falls back to the issuer default with no cards', () => {
    expect(bestRatioFor(HYATT, []).multiplier).toBe(1);
  });
});

describe('ratioMultiplier() shim', () => {
  it('resolves by card id', () => {
    const HYATT = '1:1 (standard, Sapphire Reserve); 4:3 (Chase Sapphire Preferred and Ink Business Preferred, effective 2026)';
    expect(ratioMultiplier(HYATT, 'chase_preferred')).toBeCloseTo(0.75);
    expect(ratioMultiplier('1:2')).toBe(2);
  });
});
