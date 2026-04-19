import { calcPoints } from '@/lib/points/calcPoints';
import { calcTransferAlternatives } from '@/lib/points/transferPartners';
import { PortalResult } from '@/lib/points/types';

// ---------------------------------------------------------------------------
// calcPoints()
// ---------------------------------------------------------------------------

describe('calcPoints()', () => {
  it('1. basic Chase Reserve hotel', () => {
    const result = calcPoints(620, 'hotel', ['chase_reserve']);
    expect(result.portalResults).toHaveLength(1);
    expect(result.portalResults[0].pointsNeeded).toBe(Math.ceil(620 / 0.015)); // 41,334
  });

  it('2. Chase Reserve beats Chase Preferred — deduplication', () => {
    const result = calcPoints(500, 'hotel', ['chase_reserve', 'chase_preferred']);
    expect(result.portalResults).toHaveLength(1);
    expect(result.portalResults[0].cardId).toBe('chase_reserve');
    expect(result.portalResults[0].pointsNeeded).toBe(Math.ceil(500 / 0.015)); // 33,334
  });

  it('3a. Amex hotel uses 0.7¢', () => {
    const result = calcPoints(400, 'hotel', ['amex_platinum']);
    expect(result.portalResults[0].pointsNeeded).toBe(Math.ceil(400 / 0.007)); // 57,143
  });

  it('3b. Amex flight uses 1.0¢', () => {
    const result = calcPoints(400, 'flight', ['amex_platinum']);
    expect(result.portalResults[0].pointsNeeded).toBe(Math.ceil(400 / 0.010)); // 40,000
  });

  it('4. all five portals, sorted ascending by pointsNeeded', () => {
    const result = calcPoints(
      300,
      'hotel',
      ['chase_reserve', 'amex_platinum', 'c1_venture_x', 'bilt', 'citi_strata_premier']
    );
    expect(result.portalResults).toHaveLength(5);
    expect(result.portalResults[0].portalId).toBe('chase'); // 1.5¢ = fewest points
    for (let i = 1; i < result.portalResults.length; i++) {
      expect(result.portalResults[i].pointsNeeded).toBeGreaterThanOrEqual(
        result.portalResults[i - 1].pointsNeeded
      );
    }
  });

  it('5. Citi both tiers — dedup keeps one portal result', () => {
    const result = calcPoints(200, 'hotel', ['citi_strata_premier', 'citi_strata_elite']);
    expect(result.portalResults).toHaveLength(1);
    expect(result.portalResults[0].portalId).toBe('citi');
  });

  it('6. Math.ceil enforcement — 100 / 0.015 = 6666.67 → 6667', () => {
    const result = calcPoints(100, 'hotel', ['chase_reserve']);
    expect(result.portalResults[0].pointsNeeded).toBe(6667);
  });

  it('7. guard: priceUsd = 0 throws', () => {
    expect(() => calcPoints(0, 'hotel', ['chase_reserve'])).toThrow('priceUsd must be greater than 0');
  });

  it('8. omitting userCards defaults to all available cards', () => {
    const result = calcPoints(500, 'hotel');
    // All 5 portals should be represented
    const portalIds = result.portalResults.map((r) => r.portalId);
    expect(portalIds).toContain('chase');
    expect(portalIds).toContain('amex');
    expect(portalIds).toContain('capital_one');
    expect(portalIds).toContain('bilt');
    expect(portalIds).toContain('citi');
  });

  it('9. guard: negative priceUsd throws', () => {
    expect(() => calcPoints(-50, 'hotel', ['chase_reserve'])).toThrow('priceUsd must be greater than 0');
  });

  it('10. estimated flag is always true on every PortalResult', () => {
    const result = calcPoints(500, 'hotel', ['chase_reserve', 'amex_platinum', 'bilt']);
    for (const r of result.portalResults) {
      expect(r.estimated).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// calcTransferAlternatives()
// ---------------------------------------------------------------------------

const mockBestPortalResult: PortalResult = {
  portalId: 'chase',
  portalName: 'Chase Travel',
  cardId: 'chase_reserve',
  cardName: 'Chase Sapphire Reserve',
  priceUsd: 620.01,
  pointsNeeded: 41_334,
  centsPerPoint: 1.5,
  estimated: true,
  bookingType: 'hotel',
  earnRate: 3,
  pointsEarned: 124_002,
};

describe('calcTransferAlternatives()', () => {
  it('1. Chase card + Hyatt hotel → Hyatt transfer with estimatedPointsNeeded = null', () => {
    const results = calcTransferAlternatives(620, 'hotel', ['chase_reserve'], mockBestPortalResult, 'Hyatt');
    const hyatt = results.find((r) => r.partnerProgram === 'World of Hyatt');
    expect(hyatt).toBeDefined();
    expect(hyatt?.estimatedPointsNeeded).toBeNull();
    expect(hyatt?.partnerType).toBe('hotel');
  });

  it('2. Chase card + no chain → returns all Chase hotel partners', () => {
    const results = calcTransferAlternatives(620, 'hotel', ['chase_reserve'], mockBestPortalResult, null);
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((r) => r.partnerType === 'hotel')).toBe(true);
  });

  it('3. Amex card + Hilton hotel → transferRatio = "1:2"', () => {
    const amexBest: PortalResult = { ...mockBestPortalResult, portalId: 'amex', cardId: 'amex_platinum', cardName: 'Amex Platinum' };
    const results = calcTransferAlternatives(620, 'hotel', ['amex_platinum'], amexBest, 'Hilton');
    const hilton = results.find((r) => r.partnerProgram === 'Hilton Honors');
    expect(hilton).toBeDefined();
    expect(hilton?.transferRatio).toBe('1:2');
  });

  it('4. flight bookingType → only airline partners returned', () => {
    const flightBest: PortalResult = { ...mockBestPortalResult, bookingType: 'flight' };
    const results = calcTransferAlternatives(400, 'flight', ['chase_reserve'], flightBest);
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((r) => r.partnerType === 'airline')).toBe(true);
  });

  it('5. invalid card → returns []', () => {
    // @ts-expect-error intentionally passing invalid card
    const results = calcTransferAlternatives(400, 'hotel', ['citi_savor'], mockBestPortalResult);
    expect(results).toEqual([]);
  });

  it('6. isBetterThanPortal = false when estimatedPointsNeeded is null', () => {
    const results = calcTransferAlternatives(620, 'hotel', ['chase_reserve'], mockBestPortalResult, 'Hyatt');
    const hyatt = results.find((r) => r.partnerProgram === 'World of Hyatt');
    expect(hyatt?.isBetterThanPortal).toBe(false);
  });

  it('7. isBetterThanPortal = true when transfer estimate < bestPortalResult.pointsNeeded', () => {
    // Portal costs 41,334 pts; flight transfer estimate is 20,000 → better
    const flightBest: PortalResult = { ...mockBestPortalResult, bookingType: 'flight', pointsNeeded: 41_334 };
    const results = calcTransferAlternatives(620, 'flight', ['chase_reserve'], flightBest, null, 'UA');
    const united = results.find((r) => r.partnerProgram === 'United MileagePlus');
    expect(united?.isBetterThanPortal).toBe(true);
    expect(united?.estimatedPointsNeeded).toBe(20_000);
  });
});
