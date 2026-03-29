/**
 * __tests__/deepLink.test.ts
 *
 * Snapshot + unit tests for lib/deepLink.ts.
 *
 * Snapshot tests lock in the exact URL produced by every portal and partner builder.
 * If a portal changes its URL scheme, the snapshot will fail — run the probe first
 * to confirm the site is still up, then update the URL builder AND snapshots together:
 *
 *   npm test -- --testPathPattern=deepLink --updateSnapshot
 */

import {
  buildPortalDeepLink,
  buildPartnerDeepLink,
  allPortalDeepLinks,
  SUPPORTED_AIRLINE_PARTNERS,
  SUPPORTED_HOTEL_PARTNERS,
  type FlightDeepLinkParams,
  type HotelDeepLinkParams,
} from '@/lib/deepLink';

// ---------------------------------------------------------------------------
// Fixtures — deterministic inputs so snapshots never drift due to dates
// ---------------------------------------------------------------------------

const FLIGHT_RT: FlightDeepLinkParams = {
  origin:        'LAX',
  destination:   'JFK',
  departureDate: '2025-12-01',
  returnDate:    '2025-12-10',
  passengers:    1,
  cabin:         'economy',
};

const FLIGHT_OW_BIZ: FlightDeepLinkParams = {
  origin:        'SFO',
  destination:   'LHR',
  departureDate: '2025-11-15',
  // no returnDate → one-way
  passengers:    2,
  cabin:         'business',
};

const HOTEL: HotelDeepLinkParams = {
  destination:  'New York, NY',
  checkInDate:  '2025-12-01',
  checkOutDate: '2025-12-05',
  rooms:        1,
  adults:       2,
};

// ---------------------------------------------------------------------------
// Portal snapshots — flights
// ---------------------------------------------------------------------------

describe('buildPortalDeepLink › flight snapshots', () => {
  const portals = ['chase', 'amex', 'capital_one', 'citi', 'bilt'] as const;

  for (const portal of portals) {
    it(`${portal} — round-trip economy`, () => {
      expect(buildPortalDeepLink(portal, 'flight', FLIGHT_RT)).toMatchSnapshot();
    });

    it(`${portal} — one-way business`, () => {
      expect(buildPortalDeepLink(portal, 'flight', FLIGHT_OW_BIZ)).toMatchSnapshot();
    });
  }
});

// ---------------------------------------------------------------------------
// Portal snapshots — hotels
// ---------------------------------------------------------------------------

describe('buildPortalDeepLink › hotel snapshots', () => {
  const portals = ['chase', 'amex', 'capital_one', 'citi', 'bilt'] as const;

  for (const portal of portals) {
    it(portal, () => {
      expect(buildPortalDeepLink(portal, 'hotel', HOTEL)).toMatchSnapshot();
    });
  }
});

// ---------------------------------------------------------------------------
// Partner snapshots — airlines
// ---------------------------------------------------------------------------

describe('buildPartnerDeepLink › airline snapshots', () => {
  const airlines = [
    'UA', 'DL', 'AA', 'WN', 'B6',
    'BA', 'AF', 'KL', 'SQ', 'VS',
    'AC', 'AS', 'EK', 'EY', 'NH',
    'AV', 'TK', 'CX', 'QF', 'HA',
    'IB', 'EI', 'TP', 'BR',
  ];

  for (const iata of airlines) {
    it(`${iata} — round-trip economy`, () => {
      expect(buildPartnerDeepLink(iata, 'flight', FLIGHT_RT)).toMatchSnapshot();
    });
  }

  it('BA — one-way business (cabin code C)', () => {
    expect(buildPartnerDeepLink('BA', 'flight', FLIGHT_OW_BIZ)).toMatchSnapshot();
  });

  it('SQ — one-way business (cabin code J)', () => {
    expect(buildPartnerDeepLink('SQ', 'flight', FLIGHT_OW_BIZ)).toMatchSnapshot();
  });
});

// ---------------------------------------------------------------------------
// Partner snapshots — hotels
// ---------------------------------------------------------------------------

describe('buildPartnerDeepLink › hotel snapshots', () => {
  const chains = ['hyatt', 'marriott', 'hilton', 'ihg', 'wyndham', 'choice'];

  for (const chain of chains) {
    it(chain, () => {
      expect(buildPartnerDeepLink(chain, 'hotel', HOTEL)).toMatchSnapshot();
    });
  }
});

// ---------------------------------------------------------------------------
// allPortalDeepLinks snapshot
// ---------------------------------------------------------------------------

describe('allPortalDeepLinks › snapshots', () => {
  it('flight — all 5 portals', () => {
    expect(allPortalDeepLinks('flight', FLIGHT_RT)).toMatchSnapshot();
  });

  it('hotel — all 5 portals', () => {
    expect(allPortalDeepLinks('hotel', HOTEL)).toMatchSnapshot();
  });
});

// ---------------------------------------------------------------------------
// URL structure — portal contracts
// ---------------------------------------------------------------------------

describe('URL structure › portal contracts', () => {
  it('all portal URLs start with https://', () => {
    const portals = ['chase', 'amex', 'capital_one', 'citi', 'bilt'] as const;
    for (const p of portals) {
      expect(buildPortalDeepLink(p, 'flight', FLIGHT_RT)).toMatch(/^https:\/\//);
      expect(buildPortalDeepLink(p, 'hotel', HOTEL)).toMatch(/^https:\/\//);
    }
  });

  it('IATA codes are normalised to uppercase regardless of input case', () => {
    const lower = buildPortalDeepLink('chase', 'flight', { ...FLIGHT_RT, origin: 'lax', destination: 'jfk' });
    expect(lower).toContain('origin=LAX');
    expect(lower).toContain('destination=JFK');
  });

  it('Chase round-trip → tripType=ROUNDTRIP', () => {
    expect(buildPortalDeepLink('chase', 'flight', FLIGHT_RT)).toContain('tripType=ROUNDTRIP');
  });

  it('Chase one-way → tripType=ONEWAY, no returnDate param', () => {
    const url = buildPortalDeepLink('chase', 'flight', { ...FLIGHT_RT, returnDate: undefined });
    expect(url).toContain('tripType=ONEWAY');
    expect(url).not.toContain('returnDate');
  });

  it('Amex round-trip → tripType=roundtrip', () => {
    expect(buildPortalDeepLink('amex', 'flight', FLIGHT_RT)).toContain('tripType=roundtrip');
  });

  it('Capital One round-trip → tripType=roundTrip', () => {
    expect(buildPortalDeepLink('capital_one', 'flight', FLIGHT_RT)).toContain('tripType=roundTrip');
  });

  it('Capital One one-way → tripType=oneWay', () => {
    const url = buildPortalDeepLink('capital_one', 'flight', { ...FLIGHT_RT, returnDate: undefined });
    expect(url).toContain('tripType=oneWay');
  });

  it('Citi round-trip → tripType=roundtrip', () => {
    expect(buildPortalDeepLink('citi', 'flight', FLIGHT_RT)).toContain('tripType=roundtrip');
  });

  it('Bilt round-trip → tripType=round_trip', () => {
    expect(buildPortalDeepLink('bilt', 'flight', FLIGHT_RT)).toContain('tripType=round_trip');
  });

  it('Bilt one-way → tripType=one_way', () => {
    const url = buildPortalDeepLink('bilt', 'flight', { ...FLIGHT_RT, returnDate: undefined });
    expect(url).toContain('tripType=one_way');
  });

  it('allPortalDeepLinks(flight) returns an entry for all 5 portals', () => {
    const links = allPortalDeepLinks('flight', FLIGHT_RT);
    expect(Object.keys(links).sort()).toEqual(['amex', 'bilt', 'capital_one', 'chase', 'citi']);
  });

  it('allPortalDeepLinks(hotel) returns an entry for all 5 portals', () => {
    const links = allPortalDeepLinks('hotel', HOTEL);
    expect(Object.keys(links).sort()).toEqual(['amex', 'bilt', 'capital_one', 'chase', 'citi']);
  });
});

// ---------------------------------------------------------------------------
// URL structure — partner contracts
// ---------------------------------------------------------------------------

describe('URL structure › partner contracts', () => {
  it('buildPartnerDeepLink returns null for an unknown airline IATA code', () => {
    expect(buildPartnerDeepLink('XX', 'flight', FLIGHT_RT)).toBeNull();
  });

  it('buildPartnerDeepLink returns null for an unknown hotel chain key', () => {
    expect(buildPartnerDeepLink('unknownchain', 'hotel', HOTEL)).toBeNull();
  });

  it('IATA code lookup is case-insensitive (ua === UA)', () => {
    expect(buildPartnerDeepLink('ua', 'flight', FLIGHT_RT)).toBe(
      buildPartnerDeepLink('UA', 'flight', FLIGHT_RT)
    );
  });

  it('Hotel chain key lookup is case-insensitive (HYATT === hyatt)', () => {
    expect(buildPartnerDeepLink('HYATT', 'hotel', HOTEL)).toBe(
      buildPartnerDeepLink('hyatt', 'hotel', HOTEL)
    );
  });

  it('United uses compact YYYYMMDD date format in d param', () => {
    const url = buildPartnerDeepLink('UA', 'flight', FLIGHT_RT)!;
    expect(url).toContain('d=20251201');
  });

  it('United sets sc=7 (award search)', () => {
    const url = buildPartnerDeepLink('UA', 'flight', FLIGHT_RT)!;
    expect(url).toContain('sc=7');
  });

  it('United round-trip → tt=2', () => {
    expect(buildPartnerDeepLink('UA', 'flight', FLIGHT_RT)).toContain('tt=2');
  });

  it('United one-way → tt=1', () => {
    const url = buildPartnerDeepLink('UA', 'flight', { ...FLIGHT_RT, returnDate: undefined })!;
    expect(url).toContain('tt=1');
  });

  it('Delta converts departure date to MM/DD/YYYY (URL-encoded)', () => {
    const url = buildPartnerDeepLink('DL', 'flight', FLIGHT_RT)!;
    // '12/01/2025' encoded is '12%2F01%2F2025'
    expect(url).toContain('departureDate=12%2F01%2F2025');
  });

  it('Southwest sets fareType=POINTS', () => {
    const url = buildPartnerDeepLink('WN', 'flight', FLIGHT_RT)!;
    expect(url).toContain('fareType=POINTS');
  });

  it('JetBlue sets usePoints=true', () => {
    const url = buildPartnerDeepLink('B6', 'flight', FLIGHT_RT)!;
    expect(url).toContain('usePoints=true');
  });

  it('Air France sets tripType=RT for round-trip', () => {
    expect(buildPartnerDeepLink('AF', 'flight', FLIGHT_RT)).toContain('tripType=RT');
  });

  it('Air France sets tripType=OW for one-way', () => {
    const url = buildPartnerDeepLink('AF', 'flight', { ...FLIGHT_RT, returnDate: undefined })!;
    expect(url).toContain('tripType=OW');
  });

  it('British Airways maps economy cabin to code M', () => {
    expect(buildPartnerDeepLink('BA', 'flight', FLIGHT_RT)).toContain('cabin=M');
  });

  it('British Airways maps business cabin to code C', () => {
    expect(buildPartnerDeepLink('BA', 'flight', FLIGHT_OW_BIZ)).toContain('cabin=C');
  });

  it('Singapore KrisFlyer maps economy to cabin=Y', () => {
    expect(buildPartnerDeepLink('SQ', 'flight', FLIGHT_RT)).toContain('cabin=Y');
  });

  it('Singapore KrisFlyer maps business to cabin=J', () => {
    expect(buildPartnerDeepLink('SQ', 'flight', FLIGHT_OW_BIZ)).toContain('cabin=J');
  });

  it('Hyatt sets usePoints=true', () => {
    const url = buildPartnerDeepLink('hyatt', 'hotel', HOTEL)!;
    expect(url).toContain('usePoints=true');
  });

  it('Marriott sets clusterCode=points', () => {
    const url = buildPartnerDeepLink('marriott', 'hotel', HOTEL)!;
    expect(url).toContain('clusterCode=points');
  });

  it('Marriott converts check-in date to MM/DD/YYYY', () => {
    const url = buildPartnerDeepLink('marriott', 'hotel', HOTEL)!;
    expect(url).toContain('fromDate=12%2F01%2F2025');
  });

  it('Hilton sets redeemPts=true', () => {
    const url = buildPartnerDeepLink('hilton', 'hotel', HOTEL)!;
    expect(url).toContain('redeemPts=true');
  });

  it('IHG builds qCiMy in MMYYYY format', () => {
    const url = buildPartnerDeepLink('ihg', 'hotel', HOTEL)!;
    // December 2025 → '122025'
    expect(url).toContain('qCiMy=122025');
  });

  it('IHG sets reward nights rate code qRtP=6CBARC', () => {
    const url = buildPartnerDeepLink('ihg', 'hotel', HOTEL)!;
    expect(url).toContain('qRtP=6CBARC');
  });

  it('Wyndham sets useWRPoints=true', () => {
    const url = buildPartnerDeepLink('wyndham', 'hotel', HOTEL)!;
    expect(url).toContain('useWRPoints=true');
  });

  it('Choice sets usePoints=true', () => {
    const url = buildPartnerDeepLink('choice', 'hotel', HOTEL)!;
    expect(url).toContain('usePoints=true');
  });
});

// ---------------------------------------------------------------------------
// SUPPORTED_* catalogue completeness
// ---------------------------------------------------------------------------

describe('SUPPORTED partner catalogues', () => {
  it('SUPPORTED_AIRLINE_PARTNERS includes all transferPartners.ts IATA codes', () => {
    // Every IATA code referenced in transferPartners.ts must have a deep-link builder
    const expectedIata = [
      'UA', 'WN', 'BA', 'AF', 'KL', 'SQ', 'VS', 'IB', 'EI', 'AC', 'EK', 'B6', // Chase
      'DL', 'NH', 'AV', 'QF', 'HA',                                               // Amex extras
      'TK', 'TP',                                                                  // C1/Bilt extras
      'AA', 'AS', 'CX',                                                            // Bilt extras
      'EY', 'BR',                                                                  // Citi extras
    ];
    for (const iata of expectedIata) {
      expect(SUPPORTED_AIRLINE_PARTNERS).toContain(iata);
    }
  });

  it('SUPPORTED_HOTEL_PARTNERS includes all transferPartners.ts chain keys', () => {
    const expectedChains = ['hyatt', 'ihg', 'marriott', 'hilton', 'wyndham', 'choice'];
    for (const chain of expectedChains) {
      expect(SUPPORTED_HOTEL_PARTNERS).toContain(chain);
    }
  });
});
