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
    partnerCpp: 1.5,
    sourceIssuers: [],
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

  // ── source chips ────────────────────────────────────────────────────────
  // Ownership lives on each chip: a wallet holding some but not all of a merged
  // partner's issuers has to render as exactly that.
  const card = (cardId: string, cardName: string, multiplier = 1, ratioLabel = '1:1') =>
    ({ cardId, cardName, multiplier, ratioLabel }) as never;
  const issuerOf = (
    portalId: string,
    owned: boolean,
    cards: ReturnType<typeof card>[],
    ratio = '1:1',
  ) => ({ portalId, owned, cards, best: cards[0], ratio }) as never;

  it('stays quiet about cards when a wallet card already reaches the partner', () => {
    const result = makePointsResult([makePortalGroup('chase', 1.0)], [makeTransferResult({
      sourceIssuers: [issuerOf('chase', true, [card('chase_reserve', 'Chase Sapphire Reserve')])],
    })]);
    const view = viewOf(result, r => r.kind === 'transfer');

    expect(view.unlockNote).toBeNull();
    expect(view.sourceCards.every(c => c.owned)).toBe(true);
  });

  it('names the issuer that would unlock a partner nothing in the wallet reaches', () => {
    const result = makePointsResult([makePortalGroup('chase', 1.0)], [makeTransferResult({
      sourceIssuers: [issuerOf('citi', false, [card('citi_strata_premier', 'Citi Strata Premier')])],
    })]);
    const view = viewOf(result, r => r.kind === 'transfer');

    expect(view.unlockNote).toBe('Not in your wallet — Citi would unlock it');
    expect(view.sourceCards.map(c => c.label)).toEqual(['Citi']);
    expect(view.sourceCards.every(c => !c.owned)).toBe(true);
  });

  it('collapses an unowned issuer to one chip at its best rate, breakdown behind it', () => {
    const result = makePointsResult([makePortalGroup('c1', 1.0)], [makeTransferResult({
      sourcePortalId: 'chase',
      sourceIssuers: [issuerOf('chase', false, [
        card('chase_reserve', 'Chase Sapphire Reserve'),
        card('chase_preferred', 'Chase Sapphire Preferred', 0.75, '4:3'),
      ], '1:1 (standard, Sapphire Reserve); 4:3 (Chase Sapphire Preferred)')],
    })]);
    const view = viewOf(result, r => r.kind === 'transfer');

    expect(view.sourceCards).toHaveLength(1);
    expect(view.sourceCards[0]).toMatchObject({ label: 'Chase', ratioLabel: '1:1', owned: false });
    expect(view.sourceCards[0].ratioDetail).toBe('Chase Sapphire Reserve 1:1 · Chase Sapphire Preferred 4:3');
  });

  it('marks each chip with its own ownership when the wallet holds only one issuer', () => {
    const result = makePointsResult([makePortalGroup('c1', 1.0)], [makeTransferResult({
      sourcePortalId: 'c1',
      sourceIssuers: [
        issuerOf('c1', true, [card('c1_venture_x', 'Capital One Venture X')]),
        issuerOf('chase', false, [card('chase_reserve', 'Chase Sapphire Reserve')]),
      ],
    })]);
    const view = viewOf(result, r => r.kind === 'transfer');

    expect(view.unlockNote).toBeNull();
    expect(view.displayName).toBe('Flying Blue via Capital One');
    expect(view.sourceCards.map(c => [c.label, c.owned])).toEqual([
      ['Capital One Venture X', true],
      ['Chase', false],
    ]);
  });

  it('chips owned cards individually so per-card ratios stay visible', () => {
    const result = makePointsResult([makePortalGroup('chase', 1.0)], [makeTransferResult({
      partnerProgram: 'World of Hyatt',
      sourcePortalId: 'chase',
      partnerCpp: 1.7,
      sourceIssuers: [issuerOf('chase', true, [
        card('chase_reserve', 'Chase Sapphire Reserve'),
        card('chase_preferred', 'Chase Sapphire Preferred', 0.75, '4:3'),
      ])],
    })]);
    const view = viewOf(result, r => r.kind === 'transfer');

    expect(view.sourceCards.map(c => [c.label, c.ratioLabel, c.cpp])).toEqual([
      ['Chase Sapphire Reserve', '1:1', 1.7],
      ['Chase Sapphire Preferred', '4:3', Math.round(1.7 * 0.75 * 100) / 100],
    ]);
    // The better card wins the recommendation, so the row is not a tie.
    expect(view.sourceNarrowing).toBe('ratio');
  });

  it('names no winner when the owned routes are interchangeable', () => {
    const result = makePointsResult([makePortalGroup('c1', 1.0)], [makeTransferResult({
      sourcePortalId: 'c1',
      sourceIssuers: [
        issuerOf('c1', true, [card('c1_venture_x', 'Capital One Venture X')]),
        issuerOf('chase', true, [card('chase_reserve', 'Chase Sapphire Reserve')]),
      ],
    })]);
    const view = viewOf(result, r => r.kind === 'transfer');

    expect(view.sourceNarrowing).toBeNull();
    expect(view.displayName).toBe('Flying Blue via 2 cards');
    expect(view.sourceCards.every(c => c.cpp === 1.5 && !c.hasBonus)).toBe(true);
  });

  it('recommends only the bonus issuer, and restates the rate with the promo', () => {
    const bonus: TransferBonus = {
      id: 'b1',
      issuer: 'chase',
      transfer_partner: 'Flying Blue',
      bonus_pct: 30,
      start_date: null,
      end_date: '2099-01-01',
    } as TransferBonus;
    const result = makePointsResult([makePortalGroup('c1', 1.0)], [makeTransferResult({
      sourcePortalId: 'c1',
      sourceIssuers: [
        issuerOf('c1', true, [card('c1_venture_x', 'Capital One Venture X')]),
        issuerOf('chase', true, [card('chase_reserve', 'Chase Sapphire Reserve')]),
      ],
    })]);
    const row = rankOptions(result).find(r => r.kind === 'transfer')!;
    const view = buildRowView(row, result, bonus, 'chase');

    expect(view.sourceNarrowing).toBe('bonus');
    expect(view.displayName).toBe('Flying Blue via Chase');
    expect(view.cpp).toBe(1.95);                       // 1.5 × 1.3
    expect(view.sourceCards.find(c => c.label.startsWith('Chase'))?.hasBonus).toBe(true);
    expect(view.sourceCards.find(c => c.label.startsWith('Capital'))?.hasBonus).toBe(false);
    // The promo lifts only the issuer running it.
    expect(view.sourceCards.find(c => c.label.startsWith('Capital'))?.cpp).toBe(1.5);
  });
});

// The two featured rows (one portal, one transfer) are shown side by side —
// isBestChoice is what tells the UI which one to highlight, since kind alone
// ("portal" vs "transfer") doesn't say which is the better deal.
describe('buildRowView — isBestChoice', () => {
  it('portal row is the best choice when no transfer beats it', () => {
    const result = makePointsResult(
      [makePortalGroup('chase', 1.5)],
      [makeTransferResult({ isBetterThanPortal: false })],
    );
    const portalView = viewOf(result, r => r.kind === 'portal');
    const transferView = viewOf(result, r => r.kind === 'transfer');

    expect(portalView.isBestChoice).toBe(true);
    expect(transferView.isBestChoice).toBe(false);
  });

  it('transfer row is the best choice when TransferResult.isBetterThanPortal is true', () => {
    const result = makePointsResult(
      [makePortalGroup('chase', 1.0)],
      [makeTransferResult({ isBetterThanPortal: true })],
    );
    const portalView = viewOf(result, r => r.kind === 'portal');
    const transferView = viewOf(result, r => r.kind === 'transfer');

    expect(transferView.isBestChoice).toBe(true);
    expect(portalView.isBestChoice).toBe(false);
  });

  it('portal row is the best choice by default when there are no transfer alternatives', () => {
    const result = makePointsResult([makePortalGroup('chase', 1.5)]);
    const portalView = viewOf(result, r => r.kind === 'portal');

    expect(portalView.isBestChoice).toBe(true);
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
