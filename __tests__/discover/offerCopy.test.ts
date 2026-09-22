import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  buildLeadCopy, buildStoryCopy, buildModalCopy, formatDate, formatDateShort,
  daysUntil, relativeTime, todayPill,
} from '@/lib/discover/offerCopy';
import type { TransferBonus, SpendingBonus } from '@/lib/types/offers';

function mkTransfer(overrides: Partial<TransferBonus> = {}): TransferBonus {
  return {
    id: 'tb-1',
    issuer: 'bilt',
    transfer_partner: 'World of Hyatt',
    bonus_pct: 30,
    min_transfer_points: null,
    effective_ratio: 1.3,
    description: null,
    tags: [],
    start_date: null,
    end_date: '2026-05-31',
    is_targeted: false,
    for_status_transfer: false,
    limited_time_offer: true,
    card_ids: [],
    source: 'admin',
    status: 'admin',
    source_url: null,
    country: 'US',
    submitted_by: null,
    upvotes: 12,
    active: true,
    created_at: '2026-04-01T00:00:00Z',
    updated_at: '2026-04-24T10:00:00Z',
    ...overrides,
  };
}

function mkSpending(overrides: Partial<SpendingBonus> = {}): SpendingBonus {
  return {
    id: 'sb-1',
    issuer: 'chase',
    merchant_name: 'Delta',
    bonus_multiplier: 75,
    bonus_type: 'dollar_amount',
    spending_minimum: 300,
    minimum_nights: null,
    description: null,
    tags: [],
    card_ids: [],
    start_date: null,
    end_date: '2026-04-30',
    is_targeted: false,
    limited_time_offer: false,
    source: 'admin',
    status: 'admin',
    source_url: null,
    country: 'US',
    submitted_by: null,
    upvotes: 4,
    active: true,
    created_at: '2026-04-01T00:00:00Z',
    updated_at: '2026-04-24T05:00:00Z',
    ...overrides,
  };
}

afterEach(() => {
  vi.useRealTimers();
});

describe('formatDate / formatDateShort / daysUntil', () => {
  it('formats a bare YYYY-MM-DD as a local calendar date, not UTC', () => {
    expect(formatDate('2026-05-31')).toBe('May 31, 2026');
    expect(formatDateShort('2026-05-31')).toBe('May 31');
  });

  it('computes days remaining relative to now', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-24T00:00:00'));
    expect(daysUntil('2026-05-31')).toBe(7);
  });
});

describe('relativeTime', () => {
  it('renders hours ago under a day', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-24T12:00:00Z'));
    expect(relativeTime('2026-04-24T10:00:00Z')).toBe('2H AGO');
  });

  it('renders days ago at or beyond 24 hours', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-27T10:00:00Z'));
    expect(relativeTime('2026-04-24T10:00:00Z')).toBe('3D AGO');
  });
});

describe('todayPill', () => {
  it('formats as "DOW D MON YYYY" for a given date', () => {
    expect(todayPill(new Date('2026-04-24T12:00:00'))).toBe('FRI 24 APR 2026');
  });
});

describe('buildLeadCopy — transfer bonus', () => {
  it('builds bonus-pct copy with the effective ratio spelled out', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-24T12:00:00Z'));
    const copy = buildLeadCopy(mkTransfer());
    expect(copy.kicker).toBe('TRANSFER BONUS · BILT → WORLD OF HYATT');
    expect(copy.value).toBe('+30%');
    expect(copy.valueDetail).toBe('expires May 31');
    expect(copy.headline).toContain('30%');
    expect(copy.standfirst).toContain('1,300');
    expect(copy.time).toBe('2H AGO');
  });

  it('flags targeted offers in the standfirst', () => {
    const copy = buildLeadCopy(mkTransfer({ is_targeted: true }));
    expect(copy.standfirst).toContain('targeted');
  });

  it('falls back to a status-match sentence when bonus_pct is null', () => {
    const copy = buildLeadCopy(mkTransfer({ bonus_pct: null, effective_ratio: null, min_transfer_points: 20000 }));
    expect(copy.value).toBe('20,000+ pts');
    expect(copy.headline).toContain('status match');
    expect(copy.standfirst).toContain('20,000');
  });
});

describe('buildStoryCopy — spending bonus', () => {
  it('formats a dollar_amount bonus as a credit', () => {
    const copy = buildStoryCopy(mkSpending());
    expect(copy.cat).toBe('CREDIT');
    expect(copy.value).toBe('$75');
    expect(copy.dek).toContain('$300 minimum spend');
    expect(copy.headline).toContain('Delta');
  });

  it('formats a cash_back_pct bonus as a percentage', () => {
    const copy = buildStoryCopy(mkSpending({ bonus_type: 'cash_back_pct', bonus_multiplier: 5 }));
    expect(copy.value).toBe('5%');
    expect(copy.headline).toContain('cash back');
  });

  it('formats a points_multiplier bonus with the × sign', () => {
    const copy = buildStoryCopy(mkSpending({ bonus_type: 'points_multiplier', bonus_multiplier: 3, minimum_nights: 2, spending_minimum: null }));
    expect(copy.value).toBe('3×');
    expect(copy.dek).toContain('2 nights minimum');
  });

  it('handles a spending bonus with no end date', () => {
    const copy = buildStoryCopy(mkSpending({ end_date: null }));
    expect(copy.dek).toContain('no expiration listed');
  });
});

describe('buildModalCopy', () => {
  it('produces terms and a 3-step how-it-works for a transfer bonus', () => {
    const copy = buildModalCopy(mkTransfer());
    expect(copy.howItWorks).toHaveLength(3);
    expect(copy.terms.map((t) => t.label)).toEqual(['Window', 'Eligibility', 'Country']);
  });

  it('produces terms and a 3-step how-it-works for a spending bonus', () => {
    const copy = buildModalCopy(mkSpending());
    expect(copy.howItWorks).toHaveLength(3);
    expect(copy.minimum).toBe('$300 minimum spend');
  });
});
