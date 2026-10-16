import { describe, it, expect } from 'vitest';
import { extractLinks, isReferralLink, scanLinks } from '@/lib/board/moderation/links';

describe('extractLinks', () => {
  it('finds full, www and bare-domain links', () => {
    const links = extractLinks('See https://www.hyatt.com/promo and www.bilt.com or chase.com/travel today.');
    expect(links).toEqual(expect.arrayContaining(['https://www.hyatt.com/promo', 'www.bilt.com', 'chase.com/travel']));
  });

  it('returns each link once', () => {
    expect(extractLinks('hyatt.com hyatt.com')).toHaveLength(1);
  });

  it('ignores prices and ratios', () => {
    expect(extractLinks('1,000 pts → 1,300 pts at 2.4¢ for $75')).toEqual([]);
  });
});

describe('isReferralLink', () => {
  it('allows official issuer and program pages', () => {
    expect(isReferralLink('https://www.biltrewards.com/promos')).toBe(false);
    expect(isReferralLink('https://global.americanexpress.com/rewards/transfer')).toBe(false);
    expect(isReferralLink('https://www.hyatt.com/en-US/promo?utm_source=newsletter')).toBe(false);
  });

  it('blocks referral query params', () => {
    expect(isReferralLink('https://example.com/card?ref=abc123')).toBe(true);
    expect(isReferralLink('https://example.com/card?aff_id=9')).toBe(true);
    expect(isReferralLink('https://example.com/x?utm_source=affiliate_net')).toBe(true);
  });

  it('blocks referral paths', () => {
    expect(isReferralLink('https://americanexpress.com/en-us/referral/abc')).toBe(true);
    expect(isReferralLink('https://example.com/r/xyz')).toBe(true);
  });

  it('blocks shorteners and affiliate networks, incl. subdomains', () => {
    expect(isReferralLink('https://bit.ly/3abc')).toBe(true);
    expect(isReferralLink('https://www.referyourchasecard.com/19a/X')).toBe(true);
    expect(isReferralLink('https://chase.sjv.io/abc')).toBe(true);
  });

  it('ignores trailing punctuation', () => {
    expect(isReferralLink('https://bit.ly/3abc.')).toBe(true);
    expect(isReferralLink('https://hyatt.com/offers.')).toBe(false);
  });
});

describe('scanLinks', () => {
  it('flags more than 3 links', () => {
    expect(scanLinks('a.com b.com c.com').tooMany).toBe(false);
    expect(scanLinks('a.com b.com c.com d.com').tooMany).toBe(true);
  });

  it('lists only the referral links', () => {
    const r = scanLinks('Terms at hyatt.com, my link bit.ly/x');
    expect(r.referral).toEqual(['bit.ly/x']);
  });
});
