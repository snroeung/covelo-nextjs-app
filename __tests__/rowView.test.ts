import { describe, it, expect } from 'vitest';
import {
  buildRowView,
  cashEarnLine,
  pointCurrency,
  splitFeatured,
  type OptionRowView,
} from '@/lib/points/rowView';
import { rankOptions, type RankedOption } from '@/lib/points/rankOptions';
import type { PortalGroup, PortalResult, TransferResult, PointsResult } from '@/lib/points/types';
import type { TransferBonus } from '@/lib/types/offers';

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

function makePortalGroup(
  portalId: PortalGroup['portalId'],
  cpp: number,
  resultsOverride?: PortalResult[],
): PortalGroup {
  return {
    portalId,
    portalName: `${portalId} Travel`,
    priceUsd: 300,
    results: resultsOverride ?? [makePortalResult({ portalId, centsPerPoint: cpp })],
  };
}

function makeTransferResult(overrides: Partial<TransferResult> = {}): TransferResult {
  return {
    partnerProgram: 'Flying Blue',
    partnerType: 'airline',
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

function makePointsResult(
  portalGroups: PortalGroup[],
  transferAlternatives: TransferResult[] = [],
): PointsResult {
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

function makeBonus(overrides: Partial<TransferBonus> = {}): TransferBonus {
  return {
    id: 'b1',
    issuer: 'chase',
    transfer_partner: 'Flying Blue',
    bonus_pct: 40,
    min_transfer_points: null,
    effective_ratio: null,
    description: null,
    tags: [],
    start_date: null,
    end_date: '2026-08-31',
    is_targeted: false,
    for_status_transfer: false,
    limited_time_offer: true,
    card_ids: [],
    source: 'manual' as TransferBonus['source'],
    status: 'approved' as TransferBonus['status'],
    source_url: null,
    country: 'US',
    submitted_by: null,
    upvotes: 0,
    active: true,
    created_at: '2026-08-01',
    updated_at: '2026-08-01',
    ...overrides,
  };
}

/** Grabs the ranked row matching a predicate, then builds its view. */
function viewOf(result: PointsResult, pick: (r: RankedOption) => boolean, bonus?: TransferBonus): OptionRowView {
  const row = rankOptions(result).find(pick)!;
  return buildRowView(row, result, bonus);
}

describe('pointCurrency', () => {
  it('denominates Capital One in miles and everyone else in points', () => {
    expect(pointCurrency('c1')).toBe('mi');
    expect(pointCurrency('chase')).toBe('pts');
    expect(pointCurrency('amex')).toBe('pts');
  });
});

describe('buildRowView — portal rows', () => {
  it('exposes the portal price as a cash alternative and names the loyalty currency', () => {
    const result = makePointsResult([makePortalGroup('chase', 1.5)]);
    const view = viewOf(result, r => r.kind === 'portal');

    expect(view.kind).toBe('portal');
    expect(view.cpp).toBe(1.5);
    expect(view.points).toBe(30000);
    expect(view.cashUsd).toBe(300);
    expect(view.earn).toEqual({ rate: 5, points: 1500, program: 'Chase Ultimate Rewards', cashUsd: 300 });
  });

  it('carries no context line — the portal name already says how it books', () => {
    const result = makePointsResult([makePortalGroup('chase', 1.5)]);
    const view = viewOf(result, r => r.kind === 'portal');

    expect(view.context).toBeNull();
    expect(view.unlockNote).toBeNull();
  });

  it('drops the cash-earn line when the portal earns nothing on the booking', () => {
    const result = makePointsResult([
      makePortalGroup('amex', 0.7, [makePortalResult({ portalId: 'amex', pointsEarned: 0 })]),
    ]);
    const view = viewOf(result, r => r.kind === 'portal');

    expect(view.earn).toBeNull();
    expect(cashEarnLine(view)).toBeNull();
  });
});

describe('buildRowView — transfer rows', () => {
  it('treats a transfer as award-only, with no cash price on the partner side', () => {
    const result = makePointsResult([makePortalGroup('chase', 1.0)], [makeTransferResult()]);
    const view = viewOf(result, r => r.kind === 'transfer');

    expect(view.cashUsd).toBeNull();
    expect(view.cpp).toBe(1.5);
    expect(view.points).toBe(20000);
  });

  it('folds a percentage bonus into cpp up and points down', () => {
    const result = makePointsResult([makePortalGroup('chase', 1.0)], [makeTransferResult()]);
    const view = viewOf(result, r => r.kind === 'transfer', makeBonus({ bonus_pct: 40 }));

    expect(view.cpp).toBe(2.1);            // 1.5 × 1.4
    expect(view.points).toBe(14286);       // 20,000 ÷ 1.4
    expect(view.context).toBe('1:1 transfer · 40% bonus applied');
  });

  it('names the originating card ecosystem in the row headline', () => {
    const result = makePointsResult(
      [makePortalGroup('amex', 0.7, [makePortalResult({ portalId: 'amex' })])],
      [makeTransferResult({ sourcePortalId: 'amex' })],
    );
    const view = viewOf(result, r => r.kind === 'transfer');

    expect(view.displayName).toBe('Flying Blue via American Express');
    expect(view.sourceName).toBe('Flying Blue');
  });

  it('leaves the rate untouched for a status-match bonus with no percentage', () => {
    const result = makePointsResult([makePortalGroup('chase', 1.0)], [makeTransferResult()]);
    const view = viewOf(result, r => r.kind === 'transfer', makeBonus({ bonus_pct: null }));

    expect(view.cpp).toBe(1.5);
    expect(view.points).toBe(20000);
    expect(view.context).toContain('status match applied');
  });

  it('keeps null rates null rather than coercing them to zero', () => {
    const result = makePointsResult(
      [makePortalGroup('chase', 1.0)],
      [makeTransferResult({ transferCpp: null, estimatedPointsNeeded: null })],
    );
    const view = viewOf(result, r => r.kind === 'transfer', makeBonus());

    expect(view.cpp).toBeNull();
    expect(view.points).toBeNull();
  });

  it('offers no pay-cash alternative — an award booking has no earn-back', () => {
    const result = makePointsResult([makePortalGroup('chase', 1.0)], [makeTransferResult()]);
    const view = viewOf(result, r => r.kind === 'transfer');

    expect(view.earn).toBeNull();
    expect(cashEarnLine(view)).toBeNull();
  });

  it('stays quiet about cards when a wallet card already reaches the partner', () => {
    const result = makePointsResult([makePortalGroup('chase', 1.0)], [makeTransferResult({
      eligibleCards: [
        { cardId: 'chase_reserve', cardName: 'Chase Sapphire Reserve', portalId: 'chase', ratio: '1:1' },
      ],
    })]);
    const view = viewOf(result, r => r.kind === 'transfer');

    expect(view.unlockNote).toBeNull();
  });

  it('names the card that would unlock a partner nothing in the wallet reaches', () => {
    const result = makePointsResult([makePortalGroup('chase', 1.0)], [makeTransferResult({
      recommendedCards: [
        { cardId: 'citi_strata_premier', cardName: 'Citi Strata Premier', portalId: 'citi', ratio: '1:1' },
      ],
    })]);
    const view = viewOf(result, r => r.kind === 'transfer');

    expect(view.unlockNote).toBe('Not in your wallet — Citi Strata Premier would unlock it');
  });
});

describe('splitFeatured', () => {
  function views(result: PointsResult): OptionRowView[] {
    return rankOptions(result)
      .map(row => buildRowView(row, result))
      .sort((a, b) => (b.cpp ?? -Infinity) - (a.cpp ?? -Infinity));
  }

  it('features the best portal and the best transfer, not the top two by cpp', () => {
    const result = makePointsResult(
      [makePortalGroup('chase', 2.4), makePortalGroup('amex', 2.2)],
      [makeTransferResult({ transferCpp: 1.1 })],
    );

    const { featured, alternatives } = splitFeatured(views(result));

    expect(featured.map(v => v.kind)).toEqual(['portal', 'transfer']);
    expect(featured[0].sourceName).toBe('chase Travel');
    expect(alternatives.map(v => v.sourceName)).toEqual(['amex Travel']);
  });

  it('keeps the pair in ranked order when the transfer beats every portal', () => {
    const result = makePointsResult(
      [makePortalGroup('chase', 1.0)],
      [makeTransferResult({ transferCpp: 2.4 })],
    );

    const { featured } = splitFeatured(views(result));

    expect(featured.map(v => v.kind)).toEqual(['transfer', 'portal']);
  });

  it('features a single row when there are no transfer partners at all', () => {
    const result = makePointsResult([makePortalGroup('chase', 1.5), makePortalGroup('amex', 1.2)]);

    const { featured, alternatives } = splitFeatured(views(result));

    expect(featured).toHaveLength(1);
    expect(alternatives).toHaveLength(1);
  });

  it('returns nothing to feature for an empty result', () => {
    expect(splitFeatured([])).toEqual({ featured: [], alternatives: [] });
  });
});

describe('cashEarnLine', () => {
  it('reads as a direct portal earn for a portal row', () => {
    const result = makePointsResult([makePortalGroup('chase', 1.5)]);
    const view = viewOf(result, r => r.kind === 'portal');

    expect(cashEarnLine(view)).toBe(
      'Pay $300 cash: earn 5× Chase Ultimate Rewards · est. 1,500 pts',
    );
  });

  it('uses miles as the unit for a Capital One row', () => {
    const result = makePointsResult([
      makePortalGroup('c1', 1.0, [makePortalResult({ portalId: 'c1', cardName: 'Venture X', pointsEarned: 3000 })]),
    ]);
    const view = viewOf(result, r => r.kind === 'portal');

    expect(cashEarnLine(view)).toContain('est. 3,000 mi');
  });
});
