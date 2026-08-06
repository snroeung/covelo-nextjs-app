import { describe, it, expect } from 'vitest';
import { calcPoints } from '@/lib/points/calcPoints';
import { calcTransferAlternatives, SEED_TRANSFER_PARTNERS, TransferPartnerConfig } from '@/lib/points/transferPartners';
import { normalizeProgramName } from '@/lib/points/programNames';
import { PortalResult, PortalId } from '@/lib/points/types';
import { PORTAL_FLIGHT_MARKUP, PORTAL_HOTEL_MARKUP } from '@/lib/points/portalMarkup';

// ---------------------------------------------------------------------------
// calcPoints()
// ---------------------------------------------------------------------------

describe('calcPoints()', () => {
  it('1. basic Chase Reserve hotel — portal price = base × 1.06 hotel markup', () => {
    const result = calcPoints(620, 'hotel', ['chase_reserve']);
    expect(result.portalResults).toHaveLength(1);
    expect(result.portalResults[0].pointsNeeded).toBe(Math.ceil((620 * 1.06) / 0.015)); // 43,814
    expect(result.portalResults[0].priceUsd).toBeCloseTo(620 * 1.06);
  });

  it('2. Chase Reserve beats Chase Preferred — deduplication', () => {
    const result = calcPoints(500, 'hotel', ['chase_reserve', 'chase_preferred']);
    expect(result.portalResults).toHaveLength(1);
    expect(result.portalResults[0].cardId).toBe('chase_reserve');
    expect(result.portalResults[0].pointsNeeded).toBe(Math.ceil((500 * 1.06) / 0.015)); // 35,334
  });

  it('3a. Amex hotel uses 0.7¢ and 1.10 hotel markup', () => {
    const result = calcPoints(400, 'hotel', ['amex_platinum']);
    expect(result.portalResults[0].pointsNeeded).toBe(Math.ceil((400 * 1.1) / 0.007)); // 62,858
  });

  it('3b. Amex flight uses 1.0¢ and 1.1032 flight markup', () => {
    const result = calcPoints(400, 'flight', ['amex_platinum']);
    expect(result.portalResults[0].pointsNeeded).toBe(Math.ceil((400 * 1.1032) / 0.01)); // 44,128
  });

  it('4. all five portals, sorted ascending by pointsNeeded', () => {
    const result = calcPoints(
      300,
      'hotel',
      ['chase_reserve', 'amex_platinum', 'c1_venture_x', 'bilt_blue', 'citi_strata_premier']
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

  it('6. Math.ceil enforcement — 100 × 1.06 / 0.015 = 7066.67 → 7067', () => {
    const result = calcPoints(100, 'hotel', ['chase_reserve']);
    expect(result.portalResults[0].pointsNeeded).toBe(7067);
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
    expect(portalIds).toContain('c1');
    expect(portalIds).toContain('bilt');
    expect(portalIds).toContain('citi');
  });

  it('9. guard: negative priceUsd throws', () => {
    expect(() => calcPoints(-50, 'hotel', ['chase_reserve'])).toThrow('priceUsd must be greater than 0');
  });

  it('10. estimated flag is always true on every PortalResult', () => {
    const result = calcPoints(500, 'hotel', ['chase_reserve', 'amex_platinum', 'bilt_blue']);
    for (const r of result.portalResults) {
      expect(r.estimated).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// calcPoints() — portal markup
// ---------------------------------------------------------------------------

describe('calcPoints() portal markup', () => {
  it('11. flight markup ranks Capital One over Citi at the same 1.0¢ rate', () => {
    const result = calcPoints(500, 'flight', ['c1_venture_x', 'citi_strata_premier']);
    const c1   = result.portalResults.find((r) => r.portalId === 'c1')!;
    const citi = result.portalResults.find((r) => r.portalId === 'citi')!;
    expect(c1.pointsNeeded).toBe(Math.ceil((500 * PORTAL_FLIGHT_MARKUP.c1) / 0.01)); // 50,380
    expect(citi.pointsNeeded).toBe(Math.ceil((500 * PORTAL_FLIGHT_MARKUP.citi) / 0.01)); // 57,295
    expect(result.portalResults[0].portalId).toBe('c1');
  });

  it('12. centsPerPoint is effective value (rate / markup), rounded to 2dp', () => {
    const hotel = calcPoints(620, 'hotel', ['chase_reserve']);
    expect(hotel.portalResults[0].centsPerPoint).toBe(Math.round((1.5 / PORTAL_HOTEL_MARKUP.chase) * 100) / 100); // 1.42
    const c1 = calcPoints(620, 'hotel', ['c1_venture_x']);
    expect(c1.portalResults[0].centsPerPoint).toBe(0.99); // 1.0 / 1.008
  });

  it('13. portalPrices override is treated as a real portal quote — no re-markup', () => {
    const result = calcPoints(500, 'hotel', ['chase_reserve'], undefined, { chase: 550 });
    expect(result.portalResults[0].priceUsd).toBe(550);
    expect(result.portalResults[0].pointsNeeded).toBe(Math.ceil(550 / 0.015)); // 36,667
    // effective cpp derives from the real quote, not the calibrated constant
    expect(result.portalResults[0].centsPerPoint).toBe(Math.round(1.5 * (500 / 550) * 100) / 100); // 1.36
  });

  it('14. pointsEarned accrues on the marked-up portal price', () => {
    const result = calcPoints(100, 'hotel', ['chase_reserve']); // 10x hotels
    expect(result.portalResults[0].pointsEarned).toBe(Math.floor(100 * 1.06 * 10)); // 1,060
  });
});

// ---------------------------------------------------------------------------
// calcPoints() — Chase Points Boost dual-rate rows
// ---------------------------------------------------------------------------

describe('calcPoints() Chase Points Boost dual-rate', () => {
  it('15. chase_reserve alone yields both a legacy and a new-rate row in portalGroups', () => {
    const result = calcPoints(620, 'hotel', ['chase_reserve']);
    const chaseGroup = result.portalGroups.find((g) => g.portalId === 'chase')!;
    expect(chaseGroup.results).toHaveLength(2);

    const legacy = chaseGroup.results.find((r) => r.chaseRateVariant === 'legacy')!;
    const newRate = chaseGroup.results.find((r) => r.chaseRateVariant === 'new')!;
    expect(legacy).toBeDefined();
    expect(newRate).toBeDefined();
    expect(legacy.pointsNeeded).toBe(Math.ceil((620 * 1.06) / 0.015));
    expect(newRate.pointsNeeded).toBe(Math.ceil((620 * 1.06) / 0.01));

    // top-level portalResults still surfaces the legacy (higher-cpp) row as the headline pick
    expect(result.portalResults[0].chaseRateVariant).toBe('legacy');
  });

  it('16. chase_reserve + chase_preferred → three distinct cpp tiers (two legacy + one shared new-rate row)', () => {
    const result = calcPoints(500, 'hotel', ['chase_reserve', 'chase_preferred']);
    const chaseGroup = result.portalGroups.find((g) => g.portalId === 'chase')!;
    expect(chaseGroup.results).toHaveLength(3);

    expect(chaseGroup.results.filter((r) => r.chaseRateVariant === 'legacy')).toHaveLength(2);
    expect(chaseGroup.results.filter((r) => r.chaseRateVariant === 'new')).toHaveLength(1);

    // new-rate tie between reserve (10x hotel) and preferred (5x hotel) goes to reserve's higher earn rate
    const newRow = chaseGroup.results.find((r) => r.chaseRateVariant === 'new')!;
    expect(newRow.cardId).toBe('chase_reserve');
  });

  it("17. cards outside Chase are unaffected — no chaseRateVariant tag", () => {
    const result = calcPoints(400, 'hotel', ['amex_platinum']);
    expect(result.portalGroups.find((g) => g.portalId === 'amex')!.results[0].chaseRateVariant).toBeUndefined();
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
  priceUsd: 620,
  pointsNeeded: 41_334,
  centsPerPoint: 1.5,
  earnRate: 3,
  pointsEarned: 124_002,
  estimated: true,
  bookingType: 'hotel',
};

describe('calcTransferAlternatives()', () => {
  it('1. Chase card + Hyatt hotel → Hyatt transfer computes real cpp/points estimate', () => {
    const results = calcTransferAlternatives(620, 'hotel', ['chase_reserve'], mockBestPortalResult, 'Hyatt', undefined, undefined, undefined, SEED_TRANSFER_PARTNERS);
    const hyatt = results.find((r) => r.partnerProgram === 'World of Hyatt');
    expect(hyatt).toBeDefined();
    expect(hyatt?.transferCpp).toBe(1.7);
    expect(hyatt?.estimatedPointsNeeded).toBe(Math.ceil((620 / 1.7) * 100));
    expect(hyatt?.partnerType).toBe('hotel');
  });

  it('2. Chase card + no chain → returns all Chase hotel partners', () => {
    const results = calcTransferAlternatives(620, 'hotel', ['chase_reserve'], mockBestPortalResult, null, undefined, undefined, undefined, SEED_TRANSFER_PARTNERS);
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((r) => r.partnerType === 'hotel')).toBe(true);
  });

  it('3. Amex card + Hilton hotel → transferRatio = "1:2"', () => {
    const amexBest: PortalResult = { ...mockBestPortalResult, portalId: 'amex', cardId: 'amex_platinum', cardName: 'Amex Platinum' };
    const results = calcTransferAlternatives(620, 'hotel', ['amex_platinum'], amexBest, 'Hilton', undefined, undefined, undefined, SEED_TRANSFER_PARTNERS);
    const hilton = results.find((r) => r.partnerProgram === 'Hilton Honors');
    expect(hilton).toBeDefined();
    expect(hilton?.transferRatio).toBe('1:2');
  });

  it('4. flight bookingType → only airline partners returned', () => {
    const flightBest: PortalResult = { ...mockBestPortalResult, bookingType: 'flight' };
    const results = calcTransferAlternatives(400, 'flight', ['chase_reserve'], flightBest, undefined, undefined, undefined, undefined, SEED_TRANSFER_PARTNERS);
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((r) => r.partnerType === 'airline')).toBe(true);
  });

  it('5. invalid card → returns []', () => {
    // @ts-expect-error intentionally passing invalid card
    const results = calcTransferAlternatives(400, 'hotel', ['citi_savor'], mockBestPortalResult);
    expect(results).toEqual([]);
  });

  it('6. isBetterThanPortal = true when hotel transfer cpp beats portal cpp', () => {
    const results = calcTransferAlternatives(620, 'hotel', ['chase_reserve'], mockBestPortalResult, 'Hyatt', undefined, undefined, undefined, SEED_TRANSFER_PARTNERS);
    const hyatt = results.find((r) => r.partnerProgram === 'World of Hyatt');
    expect(hyatt?.estimatedPointsNeeded).toBeLessThan(mockBestPortalResult.pointsNeeded);
    expect(hyatt?.isBetterThanPortal).toBe(true);
  });

  it('6b. calcPoints() with hotelChain filters transferAlternatives to only that chain', () => {
    const result = calcPoints(620, 'hotel', ['chase_reserve'], undefined, undefined, 'Hyatt Regency Chicago', SEED_TRANSFER_PARTNERS);
    expect(result.transferAlternatives.length).toBeGreaterThan(0);
    for (const t of result.transferAlternatives) {
      expect(t.partnerProgram).toBe('World of Hyatt');
    }
  });

  it('6a2. calcPoints() with hotelChain matching no known chain returns zero transfer alternatives', () => {
    const result = calcPoints(620, 'hotel', ['chase_reserve'], undefined, undefined, 'The Local Inn Philadelphia', SEED_TRANSFER_PARTNERS);
    expect(result.transferAlternatives).toHaveLength(0);
  });

  it('6c. calcPoints() without hotelChain returns transfer partners across all chains', () => {
    const result = calcPoints(620, 'hotel', ['chase_reserve'], undefined, undefined, undefined, SEED_TRANSFER_PARTNERS);
    const programs = new Set(result.transferAlternatives.map((t) => t.partnerProgram));
    expect(programs.size).toBeGreaterThan(1);
  });

  it('7. isBetterThanPortal = true when transfer estimate < bestPortalResult.pointsNeeded', () => {
    // Portal costs 41,334 pts; UA economy value (1.3¢/pt) on a $400 fare needs fewer points
    const flightBest: PortalResult = { ...mockBestPortalResult, bookingType: 'flight', pointsNeeded: 41_334 };
    const results = calcTransferAlternatives(400, 'flight', ['chase_reserve'], flightBest, null, 'UA', undefined, undefined, SEED_TRANSFER_PARTNERS);
    const united = results.find((r) => r.partnerProgram === 'United MileagePlus');
    expect(united?.isBetterThanPortal).toBe(true);
    expect(united?.transferCpp).toBe(1.3);
    expect(united?.estimatedPointsNeeded).toBe(30_770);
  });

  it('8. estimatedPointsNeeded scales with price (regression: transfer rows must not share one fixed value)', () => {
    const flightBest: PortalResult = { ...mockBestPortalResult, bookingType: 'flight', pointsNeeded: 41_334 };
    const cheap = calcTransferAlternatives(200, 'flight', ['chase_reserve'], flightBest, null, 'UA', undefined, undefined, SEED_TRANSFER_PARTNERS);
    const expensive = calcTransferAlternatives(800, 'flight', ['chase_reserve'], flightBest, null, 'UA', undefined, undefined, SEED_TRANSFER_PARTNERS);
    const cheapUnited = cheap.find((r) => r.partnerProgram === 'United MileagePlus');
    const expensiveUnited = expensive.find((r) => r.partnerProgram === 'United MileagePlus');
    expect(cheapUnited?.estimatedPointsNeeded).not.toBe(expensiveUnited?.estimatedPointsNeeded);
    expect(expensiveUnited!.estimatedPointsNeeded!).toBeGreaterThan(cheapUnited!.estimatedPointsNeeded!);
  });

  it('9. different airline programs at the same price get different points (no coincidental clustering)', () => {
    const flightBest: PortalResult = { ...mockBestPortalResult, bookingType: 'flight', pointsNeeded: 41_334 };
    const results = calcTransferAlternatives(400, 'flight', ['chase_reserve', 'amex_platinum'], flightBest, undefined, undefined, undefined, undefined, SEED_TRANSFER_PARTNERS);
    const united = results.find((r) => r.partnerProgram === 'United MileagePlus');
    const delta = results.find((r) => r.partnerProgram === 'Delta SkyMiles');
    expect(united?.estimatedPointsNeeded).not.toBeNull();
    expect(delta?.estimatedPointsNeeded).not.toBeNull();
    expect(united?.estimatedPointsNeeded).not.toBe(delta?.estimatedPointsNeeded);
  });
});

// Regression tests for the "duplicate transfer row" bug: DB-approved rows for
// the same real-world loyalty program are sometimes named differently across
// portals (source page wording varies). calcTransferAlternatives must merge
// them into a single row when given a DB-backed partnersMap, not just the
// bundled STATIC_TRANSFER_PARTNERS set.
describe('calcTransferAlternatives() cross-portal dedup (DB-backed partner map)', () => {
  const flightBest: PortalResult = { ...mockBestPortalResult, bookingType: 'flight', pointsNeeded: 41_334 };

  it('merges "TAP Air Portugal Miles&Go" (Capital One) and "TAP Miles&Go" (Bilt) into one row', () => {
    const partnersMap: Record<PortalId, TransferPartnerConfig[]> = {
      ...SEED_TRANSFER_PARTNERS,
      bilt: [
        ...SEED_TRANSFER_PARTNERS.bilt,
        { program: 'TAP Miles&Go', type: 'airline', ratio: '1:1', iataCodes: ['TP'] },
      ],
    };
    const results = calcTransferAlternatives(
      400, 'flight', ['c1_venture_x', 'bilt_blue'], flightBest, null, 'TP', undefined, undefined, partnersMap,
    );
    const tapRows = results.filter((r) => normalizeProgramName(r.partnerProgram) === normalizeProgramName('TAP Air Portugal Miles&Go'));
    expect(tapRows).toHaveLength(1);
    expect(tapRows[0].eligibleCards.map((c) => c.cardId).sort()).toEqual(['bilt_blue', 'c1_venture_x']);
  });

  it('merges "American AAdvantage" (Bilt) and "AAdvantage Program" (Citi) into one row', () => {
    const partnersMap: Record<PortalId, TransferPartnerConfig[]> = {
      ...SEED_TRANSFER_PARTNERS,
      citi: [
        ...SEED_TRANSFER_PARTNERS.citi,
        { program: 'AAdvantage Program', type: 'airline', ratio: '1:1', iataCodes: ['AA'] },
      ],
    };
    const results = calcTransferAlternatives(
      400, 'flight', ['bilt_blue', 'citi_strata_premier'], flightBest, null, 'AA', undefined, undefined, partnersMap,
    );
    const aaRows = results.filter((r) => normalizeProgramName(r.partnerProgram) === normalizeProgramName('American AAdvantage'));
    expect(aaRows).toHaveLength(1);
    expect(aaRows[0].eligibleCards.map((c) => c.cardId).sort()).toEqual(['bilt_blue', 'citi_strata_premier']);
  });
});

describe('normalizeProgramName()', () => {
  it('merges "TAP Miles&Go" and "TAP Air Portugal Miles&Go" to the same key', () => {
    expect(normalizeProgramName('TAP Miles&Go')).toBe(normalizeProgramName('TAP Air Portugal Miles&Go'));
  });

  it('merges "AAdvantage Program" and "American AAdvantage" to the same key', () => {
    expect(normalizeProgramName('AAdvantage Program')).toBe(normalizeProgramName('American AAdvantage'));
  });

  it('merges "British Airways Avios" and "British Airways Executive Club" to the same key', () => {
    expect(normalizeProgramName('British Airways Avios')).toBe(normalizeProgramName('British Airways Executive Club'));
  });

  it('does not merge unrelated programs', () => {
    expect(normalizeProgramName('United MileagePlus')).not.toBe(normalizeProgramName('Delta SkyMiles'));
  });

  it('is case- and punctuation-insensitive for non-aliased names', () => {
    expect(normalizeProgramName('Air France-KLM Flying Blue')).toBe(normalizeProgramName('Air France/KLM Flying Blue'));
  });
});
