import { vi, beforeEach, describe, it, expect, type Mock } from 'vitest';

vi.mock('@/lib/points/calcPoints', () => ({
  calcPoints: vi.fn(),
}));

import { calcPoints } from '@/lib/points/calcPoints';
import { adaptFlightOffer, adaptStay } from '@/components/search/SearchBoard';

function mockCalcPoints(pointsNeeded: number, cpp: number) {
  (calcPoints as Mock).mockReturnValue({
    bestPortalResult: { pointsNeeded, centsPerPoint: cpp },
  });
}

describe('adaptFlightOffer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCalcPoints(21000, 1.2);
  });

  it('maps a valid nonstop offer with city names', () => {
    const offer = {
      id: 'off_1',
      total_amount: '210.00',
      owner: { name: 'United', iata_code: 'UA' },
      slices: [
        {
          segments: [
            { origin: { iata_code: 'PHL', city_name: 'Philadelphia' }, destination: { iata_code: 'SFO', city_name: 'San Francisco' }, marketing_carrier: { name: 'United', iata_code: 'UA' } },
          ],
        },
      ],
    };

    const card = adaptFlightOffer(offer);

    expect(card).not.toBeNull();
    expect(card!.priceUsd).toBe(210);
    expect(card!.title).toBe('Philadelphia → San Francisco');
    expect(card!.subtitle).toBe('PHL → SFO · Nonstop');
    expect(card!.eyebrow).toBe('United');
    expect(card!.pointsNeeded).toBe(21000);
    expect(card!.cpp).toBe(1.2);
  });

  it('falls back to IATA codes when city names are missing', () => {
    const offer = {
      id: 'off_2',
      total_amount: '150.00',
      owner: { name: 'American', iata_code: 'AA' },
      slices: [
        {
          segments: [
            { origin: { iata_code: 'PHL' }, destination: { iata_code: 'LAX' }, marketing_carrier: { name: 'American', iata_code: 'AA' } },
          ],
        },
      ],
    };

    const card = adaptFlightOffer(offer);

    expect(card!.title).toBe('PHL → LAX');
  });

  it('shows plural stops for multi-segment offers', () => {
    const offer = {
      id: 'off_3',
      total_amount: '450.00',
      owner: { name: 'Delta', iata_code: 'DL' },
      slices: [
        {
          segments: [
            { origin: { iata_code: 'PHL' }, destination: { iata_code: 'ATL' }, marketing_carrier: { name: 'Delta', iata_code: 'DL' } },
            { origin: { iata_code: 'ATL' }, destination: { iata_code: 'DFW' }, marketing_carrier: { name: 'Delta', iata_code: 'DL' } },
            { origin: { iata_code: 'DFW' }, destination: { iata_code: 'LAX' }, marketing_carrier: { name: 'Delta', iata_code: 'DL' } },
          ],
        },
      ],
    };

    const card = adaptFlightOffer(offer);

    expect(card!.subtitle).toBe('PHL → LAX · 2 stops');
  });

  it('shows singular stop for a two-segment offer', () => {
    const offer = {
      id: 'off_4',
      total_amount: '300.00',
      owner: { name: 'Delta', iata_code: 'DL' },
      slices: [
        {
          segments: [
            { origin: { iata_code: 'PHL' }, destination: { iata_code: 'ATL' }, marketing_carrier: { name: 'Delta', iata_code: 'DL' } },
            { origin: { iata_code: 'ATL' }, destination: { iata_code: 'LAX' }, marketing_carrier: { name: 'Delta', iata_code: 'DL' } },
          ],
        },
      ],
    };

    const card = adaptFlightOffer(offer);

    expect(card!.subtitle).toBe('PHL → LAX · 1 stop');
  });

  it('returns null when total_amount is missing', () => {
    expect(adaptFlightOffer({ id: 'off_5', slices: [] })).toBeNull();
  });

  it('returns null when total_amount is zero', () => {
    expect(adaptFlightOffer({ id: 'off_6', total_amount: '0', slices: [] })).toBeNull();
  });

  it('falls back to segment marketing_carrier name when owner is missing', () => {
    const offer = {
      id: 'off_7',
      total_amount: '199.00',
      slices: [
        {
          segments: [
            { origin: { iata_code: 'PHL' }, destination: { iata_code: 'BOS' }, marketing_carrier: { name: 'JetBlue', iata_code: 'B6' } },
          ],
        },
      ],
    };

    const card = adaptFlightOffer(offer);

    expect(card!.eyebrow).toBe('JetBlue');
  });

  it('falls back to "Flight" label and no route title when owner and segments are both missing', () => {
    const card = adaptFlightOffer({ id: 'off_8', total_amount: '99.00' });

    expect(card!.eyebrow).toBe('Flight');
    expect(card!.title).toBe('Flight');
    expect(card!.subtitle).toBe('Nonstop');
  });

  it('omits pointsNeeded/cpp without throwing when calcPoints throws', () => {
    (calcPoints as Mock).mockImplementation(() => { throw new Error('boom'); });

    const offer = {
      id: 'off_9',
      total_amount: '120.00',
      slices: [{ segments: [{ origin: { iata_code: 'PHL' }, destination: { iata_code: 'MIA' }, marketing_carrier: { name: 'Spirit', iata_code: 'NK' } }] }],
    };

    const card = adaptFlightOffer(offer);

    expect(card).not.toBeNull();
    expect(card!.pointsNeeded).toBeUndefined();
    expect(card!.cpp).toBeUndefined();
  });
});

describe('adaptStay', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCalcPoints(80000, 1.7);
  });

  it('maps a valid stay with default 3-night subtitle', () => {
    const stay = { id: 'sr_1', cheapest_rate_total_amount: '867.00', accommodation: { name: 'Kimpton Hotel Palomar Philadelphia', rating: 4.3 } };

    const card = adaptStay(stay);

    expect(card).not.toBeNull();
    expect(card!.priceUsd).toBe(867);
    expect(card!.subtitle).toBe('PHL · 3 nights');
    expect(card!.stars).toBe(4);
    expect(card!.pointsNeeded).toBe(80000);
    expect(card!.cpp).toBe(1.7);
  });

  it('uses singular "night" when nights is 1', () => {
    const stay = { id: 'sr_2', cheapest_rate_total_amount: '300.00', accommodation: { name: 'Some Hotel' } };

    const card = adaptStay(stay, 1);

    expect(card!.subtitle).toBe('PHL · 1 night');
  });

  it('sets eyebrow to the parent brand label when the name matches a keyword', () => {
    const stay = { id: 'sr_3', cheapest_rate_total_amount: '250.00', accommodation: { name: 'Hilton Garden Inn Philadelphia' } };

    const card = adaptStay(stay);

    expect(card!.eyebrow).toBe('Hilton');
  });

  it('falls back to "Stay" when the name matches no brand keyword', () => {
    const stay = { id: 'sr_4', cheapest_rate_total_amount: '250.00', accommodation: { name: 'Independent Boutique Inn' } };

    const card = adaptStay(stay);

    expect(card!.eyebrow).toBe('Stay');
  });

  it('returns null when cheapest_rate_total_amount is missing', () => {
    expect(adaptStay({ id: 'sr_5', accommodation: { name: 'Hotel' } })).toBeNull();
  });

  it('returns null when cheapest_rate_total_amount is zero', () => {
    expect(adaptStay({ id: 'sr_6', cheapest_rate_total_amount: '0', accommodation: { name: 'Hotel' } })).toBeNull();
  });

  it('passes portalPrices through unchanged', () => {
    const portalPrices = { chase: 900, amex: 950 };
    const stay = { id: 'sr_7', cheapest_rate_total_amount: '900.00', accommodation: { name: 'Marriott Downtown' }, portalPrices };

    const card = adaptStay(stay);

    expect(card!.portalPrices).toBe(portalPrices);
  });
});
