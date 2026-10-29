import { describe, expect, it } from 'vitest';
import { prefillFromMemberOffer, deriveMemberOfferColumns, draftChecks, draftError, effectiveRatio, draftToDetails, EMPTY_MEMBER_OFFER, memberOfferDetails, type MemberOfferDraft } from '@/lib/board/memberOffer';

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
    ['impossible end date', { ...transfer, start_date: '2026-01-01', end_date: '2026-02-31' }, /exist/i],
    ['impossible month', { ...transfer, start_date: '2026-00-10' }, /exist/i],
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

describe('prefillFromMemberOffer — offers created before structured details', () => {
  // A real one: posted from the old free-text form
  const legacy = {
    id: 'mo', type: 'STATEMENT CREDIT', value: '$25', name: '$25 credit when spending $100 at Banana', from_program: 'Chase Sapphire Reserve',
    to_program: null, conditions: null, ends_label: 'Nov 1, 2026', source_url: 'https://chase.com', details: null,
  };

  it('reads the merchant, credit, minimum spend, card and end date out of the text the member wrote', () => {
    const out = prefillFromMemberOffer(legacy);
    expect(out.type).toBe('spending');
    expect(out.offer).toMatchObject({
      issuer: 'chase', card_ids: ['chase_reserve'], is_targeted: true, merchant_name: 'Banana',
      bonus_type: 'dollar_amount', bonus_multiplier: 25, spending_minimum: 100, end_date: '2026-11-01', source_url: 'https://chase.com',
    });
  });

  it('knows cash back and points multipliers from the value', () => {
    expect(prefillFromMemberOffer({ ...legacy, type: 'CASH BACK', value: '3%' }).offer).toMatchObject({ bonus_type: 'cash_back_pct', bonus_multiplier: 3 });
    expect(prefillFromMemberOffer({ ...legacy, type: 'POINTS BONUS', value: '5×' }).offer).toMatchObject({ bonus_type: 'points_multiplier', bonus_multiplier: 5 });
  });

  it('reads an issuer when from_program names one, and no card when it does not name a card', () => {
    const out = prefillFromMemberOffer({ ...legacy, from_program: 'Amex Platinum perks' });
    expect(out.offer).toMatchObject({ issuer: 'amex', card_ids: [], is_targeted: false });
    expect(prefillFromMemberOffer({ ...legacy, from_program: 'Some program' }).offer.issuer).toBeUndefined();
  });

  it('prefers the partner the member named, and a transfer bonus keeps its percentage', () => {
    const out = prefillFromMemberOffer({ ...legacy, type: 'TRANSFER BONUS', value: '+25%', from_program: 'Amex', to_program: 'Virgin Atlantic', name: '25% transfer bonus' });
    expect(out).toMatchObject({ type: 'transfer', offer: { issuer: 'amex', transfer_partner: 'Virgin Atlantic', bonus_pct: 25 } });
  });

  it('leaves what it cannot place empty: an end date with no year, no amount', () => {
    const out = prefillFromMemberOffer({ ...legacy, ends_label: 'Jun 30', value: 'Free', type: 'FREE NIGHT' });
    expect(out.offer.end_date).toBeUndefined();
    expect((out.offer as { bonus_multiplier?: number }).bonus_multiplier).toBeUndefined();
  });

  it('reads end-date labels as calendar parts, whatever the server time zone', () => {
    const end = (ends_label: string) => prefillFromMemberOffer({ ...legacy, ends_label }).offer.end_date;
    expect(end('2026-12-31')).toBe('2026-12-31');
    expect(end('Nov 1, 2026')).toBe('2026-11-01');
    expect(end('December 5th, 2026')).toBe('2026-12-05');
    expect(end('Feb 31, 2026')).toBeUndefined();
    expect(end('2026-13-45')).toBeUndefined();
  });

  it('uses the structured details when there are some', () => {
    const details = { kind: 'transfer', issuer: 'bilt', transfer_partner: 'American AAdvantage', bonus_pct: 30, start_date: '2026-11-01', end_date: '2026-12-31' };
    expect(prefillFromMemberOffer({ ...legacy, details }).offer).toMatchObject({ issuer: 'bilt', transfer_partner: 'American AAdvantage', bonus_pct: 30 });
  });
});
