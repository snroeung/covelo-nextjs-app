import { describe, expect, it } from 'vitest';
import { allPartnerOptions, issuersForPartner, partnerLabel, partnersForIssuer, soleIssuer, type PartnerMap } from '@/lib/points/partnerOptions';

const map: PartnerMap = {
  chase: [{ program: 'World of Hyatt', type: 'hotel', ratio: '1:1' }, { program: 'United MileagePlus', type: 'airline', ratio: '1:1' }],
  amex: [{ program: 'United MileagePlus', type: 'airline', ratio: '1:1' }],
  bilt: [{ program: 'American AAdvantage', type: 'airline', ratio: '1:1' }, { program: 'World of Hyatt', type: 'hotel', ratio: '1:1' }],
};
const ALL = ['chase', 'amex', 'c1', 'bilt', 'citi'] as const;

describe('allPartnerOptions', () => {
  it('lists each program once with every issuer that reaches it, sorted', () => {
    const all = allPartnerOptions(map);
    expect(all.map((p) => p.program)).toEqual(['American AAdvantage', 'United MileagePlus', 'World of Hyatt']);
    expect(all.find((p) => p.program === 'World of Hyatt')!.issuers).toEqual(['chase', 'bilt']);
  });
  it('handles a missing map', () => {
    expect(allPartnerOptions(undefined)).toEqual([]);
  });
});

describe('partnersForIssuer', () => {
  it('returns everything with no issuer, so a partner can be picked first', () => {
    expect(partnersForIssuer(map, '').map((p) => p.program)).toContain('American AAdvantage');
  });
  it('narrows to one issuer', () => {
    expect(partnersForIssuer(map, 'chase').map((p) => p.program)).toEqual(['United MileagePlus', 'World of Hyatt']);
    expect(partnersForIssuer(map, 'citi')).toEqual([]);
  });
});

describe('issuersForPartner / soleIssuer', () => {
  it('limits issuers to the ones that reach the partner', () => {
    expect(issuersForPartner(map, 'United MileagePlus', ALL)).toEqual(['chase', 'amex']);
    expect(issuersForPartner(map, '', ALL)).toEqual([...ALL]);
  });
  it('fills the issuer only when exactly one reaches the partner', () => {
    expect(soleIssuer(map, 'American AAdvantage')).toBe('bilt');
    expect(soleIssuer(map, 'United MileagePlus')).toBe('');
    expect(soleIssuer(map, 'Nope')).toBe('');
  });
});

describe('partnerLabel', () => {
  const name = (i: string) => i.toUpperCase();
  it('shows the ratio for one issuer and the issuers otherwise', () => {
    const p = allPartnerOptions(map).find((x) => x.program === 'World of Hyatt')!;
    expect(partnerLabel(p, 'chase', name)).toBe('[Hotel] World of Hyatt (1:1)');
    expect(partnerLabel(p, '', name)).toBe('[Hotel] World of Hyatt · CHASE, BILT');
  });
});
