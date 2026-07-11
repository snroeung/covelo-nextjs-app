import { describe, it, expect } from 'vitest';
import { rankOptions, getBestOption } from '@/lib/points/rankOptions';
import type { PortalGroup, PortalResult, TransferResult, PointsResult } from '@/lib/points/types';

function makePortalResult(overrides: Partial<PortalResult> = {}): PortalResult {
  return {
    portalId: 'chase',
    portalName: 'Chase Travel',
    cardId: 'chase_reserve',
    cardName: 'Chase Sapphire Reserve',
    priceUsd: 300,
    pointsNeeded: 30000,
    centsPerPoint: 1.0,
    earnRate: 5,
    pointsEarned: 1500,
    estimated: true,
    bookingType: 'flight',
    ...overrides,
  };
}

function makePortalGroup(portalId: PortalGroup['portalId'], cpp: number, resultsOverride?: PortalResult[]): PortalGroup {
  return {
    portalId,
    portalName: `${portalId} Travel`,
    priceUsd: 300,
    results: resultsOverride ?? [makePortalResult({ portalId, centsPerPoint: cpp })],
  };
}

function makeTransferResult(overrides: Partial<TransferResult> = {}): TransferResult {
  return {
    partnerProgram: 'Hyatt',
    partnerType: 'hotel',
    sourceCardId: 'chase_reserve',
    sourcePortalId: 'chase',
    transferRatio: '1:1',
    estimatedPointsNeeded: 20000,
    estimatedCentsPerPoint: 1.5,
    transferCpp: 1.5,
    note: '',
    isBetterThanPortal: true,
    estimated: true,
    eligibleCards: [],
    recommendedCards: [],
    ...overrides,
  };
}

function makePointsResult(portalGroups: PortalGroup[], transferAlternatives: TransferResult[]): PointsResult {
  const portalResults = portalGroups.flatMap(g => g.results);
  return {
    priceUsd: 300,
    bookingType: 'flight',
    portalGroups,
    portalResults,
    bestPortalResult: portalResults[0] ?? makePortalResult(),
    transferAlternatives,
    bestTransferResult: transferAlternatives[0] ?? null,
  };
}

describe('rankOptions', () => {
  it('merges portal groups and transfer alternatives, sorted by cpp descending', () => {
    const result = makePointsResult(
      [makePortalGroup('chase', 1.0), makePortalGroup('amex', 2.0)],
      [makeTransferResult({ partnerProgram: 'Hyatt', transferCpp: 1.5 })],
    );

    const ranked = rankOptions(result);

    expect(ranked.map(r => r.cpp)).toEqual([2.0, 1.5, 1.0]);
    expect(ranked[0].kind).toBe('portal');
    expect(ranked[1].kind).toBe('transfer');
  });

  it('transfer row with transferCpp null sorts last', () => {
    const result = makePointsResult(
      [makePortalGroup('chase', 1.0)],
      [makeTransferResult({ partnerProgram: 'United', transferCpp: null })],
    );

    const ranked = rankOptions(result);

    expect(ranked[0].kind).toBe('portal');
    expect(ranked[1].kind).toBe('transfer');
    expect(ranked[1].cpp).toBe(-Infinity);
  });

  it('filters out portal groups with an empty results array', () => {
    const result = makePointsResult(
      [makePortalGroup('chase', 1.0), makePortalGroup('amex', 2.0, [])],
      [],
    );

    const ranked = rankOptions(result);

    expect(ranked).toHaveLength(1);
    expect(ranked[0].kind).toBe('portal');
    expect((ranked[0] as any).group.portalId).toBe('chase');
  });

  it('gives each transfer row a unique key when two transfers share a partner program', () => {
    const result = makePointsResult(
      [],
      [
        makeTransferResult({ partnerProgram: 'Hyatt', sourcePortalId: 'chase', transferCpp: 1.5 }),
        makeTransferResult({ partnerProgram: 'Hyatt', sourcePortalId: 'amex', transferCpp: 1.2 }),
      ],
    );

    const ranked = rankOptions(result);

    const keys = ranked.map(r => r.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('returns an empty array when portalGroups and transferAlternatives are both empty', () => {
    const result = makePointsResult([], []);
    expect(rankOptions(result)).toEqual([]);
  });
});

describe('getBestOption', () => {
  it('returns the top-ranked entry matching rankOptions()[0]', () => {
    const result = makePointsResult(
      [makePortalGroup('chase', 1.0), makePortalGroup('amex', 2.0)],
      [makeTransferResult({ transferCpp: 1.5 })],
    );

    expect(getBestOption(result)).toEqual(rankOptions(result)[0]);
  });

  it('returns null for null input', () => {
    expect(getBestOption(null)).toBeNull();
  });

  it('returns null for undefined input', () => {
    expect(getBestOption(undefined)).toBeNull();
  });

  it('returns null when portalGroups and transferAlternatives are both empty', () => {
    const result = makePointsResult([], []);
    expect(getBestOption(result)).toBeNull();
  });
});
