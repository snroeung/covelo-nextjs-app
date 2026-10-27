import { describe, expect, it } from 'vitest';
import { deriveMemberOfferColumns, draftChecks, draftError, effectiveRatio, draftToDetails, EMPTY_MEMBER_OFFER, memberOfferDetails, type MemberOfferDraft } from '@/lib/board/memberOffer';

const transfer: MemberOfferDraft = { ...EMPTY_MEMBER_OFFER, kind: 'transfer', issuer: 'chase', transfer_partner: 'Hyatt', bonus_pct: '30', start_date: '2026-11-01', end_date: '2026-12-31' };
const spending: MemberOfferDraft = { ...EMPTY_MEMBER_OFFER, kind: 'spending', issuer: 'amex', merchant_name: 'Dining', bonus_type: 'points_multiplier', bonus_multiplier: '5', start_date: '2026-11-01', end_date: '2026-12-31' };
const details = (d: MemberOfferDraft) => memberOfferDetails.parse(draftToDetails(d));

describe('draftError', () => {
  it('accepts a complete transfer and spending draft', () => {
    expect(draftError(transfer)).toBeNull();
    expect(draftError(spending)).toBeNull();
  });

  it.each([
    ['no issuer', { ...transfer, issuer: '' as const }, /issuer/i],
    ['no partner', { ...transfer, transfer_partner: '' }, /partner/i],
    ['no bonus % or min points', { ...transfer, bonus_pct: '' }, /bonus/i],
    ['zero bonus %', { ...transfer, bonus_pct: '0' }, /bonus/i],
    ['no start date', { ...transfer, start_date: '' }, /start date/i],
    ['no end date', { ...transfer, end_date: '' }, /end date/i],
    ['no merchant', { ...spending, merchant_name: ' ' }, /merchant/i],
    ['no amount', { ...spending, bonus_multiplier: '' }, /amount/i],
    ['end before start', { ...transfer, start_date: '2026-12-31', end_date: '2026-01-01' }, /end date/i],
    ['non-http link', { ...transfer, source_url: 'javascript:alert(1)' }, /http/i],
  ])('flags %s', (_name, draft, message) => {
    expect(draftError(draft as MemberOfferDraft)).toMatch(message);
  });
});

describe('draftToDetails', () => {
  it('turns blank optional strings into absent fields and numbers into numbers', () => {
    expect(details(transfer)).toEqual({
      kind: 'transfer', issuer: 'chase', transfer_partner: 'Hyatt', bonus_pct: 30, start_date: '2026-11-01', end_date: '2026-12-31',
      card_ids: [], tags: [], country: 'US', is_targeted: false, for_status_transfer: false,
    });
  });

  it('keeps specific cards and an empty list means all cards', () => {
    expect(details({ ...transfer, card_ids: ['chase_sapphire_reserve'] }).card_ids).toEqual(['chase_sapphire_reserve']);
    expect(details(transfer).card_ids).toEqual([]);
  });

  it('marks the offer targeted exactly when it is limited to specific cards', () => {
    expect(details(transfer).is_targeted).toBe(false);
    expect(details({ ...transfer, card_ids: ['chase_sapphire_reserve'] }).is_targeted).toBe(true);
  });

  it('accepts a status-match transfer with a minimum and no percentage', () => {
    const status = { ...transfer, bonus_pct: '', min_transfer_points: '5000' };
    expect(draftError(status)).toBeNull();
    expect(deriveMemberOfferColumns(details(status))).toMatchObject({ type: 'STATUS MATCH', value: '5,000+ pts' });
  });

  it('keeps tags, country and the status-transfer flag', () => {
    expect(details({ ...transfer, tags: ['Transfer bonus'], country: 'CA', for_status_transfer: true })).toMatchObject({ tags: ['Transfer bonus'], country: 'CA', for_status_transfer: true });
  });

  it('rejects an unknown tag or country', () => {
    expect(memberOfferDetails.safeParse({ ...(draftToDetails(transfer) as object), tags: ['Nope'] }).success).toBe(false);
    expect(memberOfferDetails.safeParse({ ...(draftToDetails(transfer) as object), country: 'ZZ' }).success).toBe(false);
  });

  it('drops the other kind\'s fields', () => {
    expect(details({ ...spending, transfer_partner: 'Hyatt', bonus_pct: '30' })).not.toHaveProperty('transfer_partner');
  });
});

describe('deriveMemberOfferColumns', () => {
  it('reads like the catalog row for a transfer bonus', () => {
    expect(deriveMemberOfferColumns(details(transfer))).toMatchObject({
      type: 'TRANSFER BONUS', value: '+30%', name: '30% transfer bonus · Chase → Hyatt', from: 'Chase', to: 'Hyatt', conditions: '1,000 pts → 1,300 pts',
    });
  });

  it.each([
    ['points_multiplier', '5', 'POINTS BONUS', '5×'],
    ['cash_back_pct', '3', 'CASH BACK', '3%'],
    ['dollar_amount', '75', 'STATEMENT CREDIT', '$75'],
  ] as const)('maps %s spending offers to %s', (bonus_type, amount, type, value) => {
    expect(deriveMemberOfferColumns(details({ ...spending, bonus_type, bonus_multiplier: amount }))).toMatchObject({ type, value, to: 'Dining' });
  });

  it('carries the minimum spend and nights into the conditions', () => {
    const cols = deriveMemberOfferColumns(details({ ...spending, spending_minimum: '300', minimum_nights: '2' }));
    expect(cols.conditions).toBe('min. spend $300 · 2 nights minimum');
  });

  it('stays inside the column limits', () => {
    const cols = deriveMemberOfferColumns(details({ ...spending, merchant_name: 'x'.repeat(80) }));
    expect(cols.name.length).toBeLessThanOrEqual(120);
    expect(cols.value.length).toBeLessThanOrEqual(24);
  });

  it('passes the source link through, or undefined when blank', () => {
    expect(deriveMemberOfferColumns(details({ ...transfer, source_url: 'https://example.com/p' })).url).toBe('https://example.com/p');
    expect(deriveMemberOfferColumns(details(transfer)).url).toBeUndefined();
  });
});

describe('draftChecks / effectiveRatio', () => {
  it('lists the editor checklist, all passing for a complete draft', () => {
    expect(draftChecks(transfer).every((c) => c.ok)).toBe(true);
    expect(draftChecks(transfer).map((c) => c.label)).toContain('Bonus % or min points set');
    expect(draftChecks(spending).map((c) => c.label)).toContain('Merchant name filled');
  });

  it('marks what is missing on an empty draft', () => {
    const failing = draftChecks(EMPTY_MEMBER_OFFER).filter((c) => !c.ok).map((c) => c.label);
    expect(failing).toEqual(expect.arrayContaining(['Issuer selected', 'Transfer partner selected', 'Start date set', 'End date set']));
  });

  it('computes the effective ratio like the editor', () => {
    expect(effectiveRatio('30')).toBe('1.3000');
    expect(effectiveRatio('')).toBe('—');
    expect(effectiveRatio('0')).toBe('—');
  });
});
