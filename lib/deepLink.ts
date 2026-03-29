/**
 * lib/deepLink.ts
 *
 * Centralized deep-link URL builder for all five credit card travel portals
 * and their airline / hotel transfer partners.
 *
 * URL patterns reverse-engineered from live portals (2025-03):
 *  • Chase Travel    — cxLoyalty platform (travel.chase.com)
 *  • Amex Travel     — Internova platform (amextravel.com)
 *  • Capital One     — Hopper platform    (travel.capitalone.com)
 *  • Citi Travel     — Rocket Travel / Booking.com (search.travel.citi.com)
 *  • Bilt Travel     — Points Travel      (bilt.com/rewards/travel)
 *
 * IMPORTANT: These portals do not publish stable deep-link specs.
 * Run the portal-monitoring GitHub Actions workflow (`/.github/workflows/portal-monitoring.yml`)
 * to detect if any base URLs or query-parameter contracts change.
 */

import type { PortalId, BookingType } from './points/types';

// ---------------------------------------------------------------------------
// Input types
// ---------------------------------------------------------------------------

export interface FlightDeepLinkParams {
  /** IATA airport code, e.g. 'LAX' (case-insensitive — normalised to uppercase) */
  origin: string;
  /** IATA airport code, e.g. 'JFK' */
  destination: string;
  /** ISO 8601 date, YYYY-MM-DD */
  departureDate: string;
  /** ISO 8601 date — omit for one-way */
  returnDate?: string;
  /** Adult passengers, default 1 */
  passengers?: number;
  /** Cabin preference, default 'economy' */
  cabin?: 'economy' | 'premium_economy' | 'business' | 'first';
}

export interface HotelDeepLinkParams {
  /** City name, region, or property search query */
  destination: string;
  /** ISO 8601 date, YYYY-MM-DD */
  checkInDate: string;
  /** ISO 8601 date, YYYY-MM-DD */
  checkOutDate: string;
  /** Number of rooms, default 1 */
  rooms?: number;
  /** Number of adults, default 1 */
  adults?: number;
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

/** Build a query string, skipping undefined values. */
function qs(params: Record<string, string | number | boolean | undefined>): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined) p.set(k, String(v));
  }
  return p.toString();
}

/** YYYY-MM-DD → YYYYMMDD (used by United) */
function toCompact(date: string): string {
  return date.replace(/-/g, '');
}

/** YYYY-MM-DD → MM/DD/YYYY (used by Delta, Marriott) */
function toUsDate(date: string): string {
  const [y, m, d] = date.split('-');
  return `${m}/${d}/${y}`;
}

// ---------------------------------------------------------------------------
// Portal — Chase Travel
// Base URL:  https://ultimaterewards.chase.com
// Platform:  cxLoyalty (migrated from Expedia, late 2024)
// Auth:      Requires Chase login — link lands on the portal; search is not pre-filled
//            through the auth wall. Params are appended speculatively in case a logged-in
//            session resolves the search.
// ---------------------------------------------------------------------------

const CHASE_CABIN: Record<string, string> = {
  economy: 'ECONOMY', premium_economy: 'PREMIUM_ECONOMY', business: 'BUSINESS', first: 'FIRST',
};

function chaseFlightUrl(p: FlightDeepLinkParams): string {
  return `https://ultimaterewards.chase.com/travel/flights/search?${qs({
    tripType:      p.returnDate ? 'ROUNDTRIP' : 'ONEWAY',
    origin:        p.origin.toUpperCase(),
    destination:   p.destination.toUpperCase(),
    departureDate: p.departureDate,
    returnDate:    p.returnDate,
    numPassengers: p.passengers ?? 1,
    cabin:         CHASE_CABIN[p.cabin ?? 'economy'],
  })}`;
}

function chaseHotelUrl(p: HotelDeepLinkParams): string {
  return `https://ultimaterewards.chase.com/travel/hotels/search?${qs({
    destination:  p.destination,
    checkInDate:  p.checkInDate,
    checkOutDate: p.checkOutDate,
    numRooms:     p.rooms ?? 1,
    numGuests:    p.adults ?? 1,
  })}`;
}

// ---------------------------------------------------------------------------
// Portal — Amex Travel
// Base URL:  https://www.amextravel.com
// Platform:  Orbitz (Expedia Group white-label) — confirmed publicly searchable
//            without login.
// Deep-link: Orbitz's /Flights-Search path does not exist on amextravel.com.
//            The frontend URL structure is not publicly documented. Links land
//            on the Amex Travel home so the user can search from there.
// TODO: If you discover the correct path (e.g. via browser DevTools on a real
//       search), replace the base URL below with the full deep-link.
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function amexFlightUrl(_p: FlightDeepLinkParams): string {
  return 'https://www.amextravel.com';
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function amexHotelUrl(_p: HotelDeepLinkParams): string {
  return 'https://www.amextravel.com';
}

// ---------------------------------------------------------------------------
// Portal — Capital One Travel
// Base URL:  https://travel.capitalone.com
// Platform:  Hopper (partnership since 2021)
// Patterns:  /flights/search  — Hopper web uses `type`, `depart`, `return`, `adults`
//            (not the camelCase names common in other portals)
// ---------------------------------------------------------------------------

const C1_CABIN: Record<string, string> = {
  economy: 'economy', premium_economy: 'premium', business: 'business', first: 'first',
};

function c1FlightUrl(p: FlightDeepLinkParams): string {
  return `https://travel.capitalone.com/flights/search?${qs({
    type:   p.returnDate ? 'round-trip' : 'one-way',
    from:   p.origin.toUpperCase(),
    to:     p.destination.toUpperCase(),
    depart: p.departureDate,
    return: p.returnDate,
    adults: p.passengers ?? 1,
    cabin:  C1_CABIN[p.cabin ?? 'economy'],
  })}`;
}

function c1HotelUrl(p: HotelDeepLinkParams): string {
  return `https://travel.capitalone.com/hotels?${qs({
    destination: p.destination,
    checkIn:     p.checkInDate,
    checkOut:    p.checkOutDate,
    rooms:       p.rooms ?? 1,
    adults:      p.adults ?? 1,
  })}`;
}

// ---------------------------------------------------------------------------
// Portal — Citi Travel (ThankYou)
// Base URL:  https://search.travel.citi.com
// Platform:  Rocket Travel by Agoda / Booking.com backend
// Patterns:  /flights   /hotels
// ---------------------------------------------------------------------------

const CITI_CABIN: Record<string, string> = {
  economy: 'economy', premium_economy: 'premium_economy', business: 'business', first: 'first',
};

function citiFlightUrl(p: FlightDeepLinkParams): string {
  return `https://search.travel.citi.com/flights?${qs({
    tripType:      p.returnDate ? 'roundtrip' : 'oneway',
    origin:        p.origin.toUpperCase(),
    destination:   p.destination.toUpperCase(),
    departureDate: p.departureDate,
    returnDate:    p.returnDate,
    adults:        p.passengers ?? 1,
    cabinClass:    CITI_CABIN[p.cabin ?? 'economy'],
  })}`;
}

function citiHotelUrl(p: HotelDeepLinkParams): string {
  return `https://search.travel.citi.com/hotels?${qs({
    destination: p.destination,
    checkIn:     p.checkInDate,
    checkOut:    p.checkOutDate,
    rooms:       p.rooms ?? 1,
    adults:      p.adults ?? 1,
  })}`;
}

// ---------------------------------------------------------------------------
// Portal — Bilt Travel
// Base URL:  https://travel.biltrewards.com  (301s → www.bilt.com/rewards/travel)
// Platform:  Expedia white-label, client-side SPA — no publicly documented
//            deep-link URL format. Link lands on the travel portal home.
// Auth:      Requires Bilt login.
// ---------------------------------------------------------------------------

function biltFlightUrl(_p: FlightDeepLinkParams): string {
  return 'https://travel.biltrewards.com';
}

function biltHotelUrl(_p: HotelDeepLinkParams): string {
  return 'https://travel.biltrewards.com';
}

// ---------------------------------------------------------------------------
// Transfer partner — Airline deep links
// Keys match IATA airline codes used in transferPartners.ts
// ---------------------------------------------------------------------------

const AIRLINE_BUILDERS: Record<string, (p: FlightDeepLinkParams) => string> = {

  // United MileagePlus — f/t/d (YYYYMMDD)/tt/sc=7 (award)/px
  UA: (p) => `https://www.united.com/en/us/flifo/flightsearch?${qs({
    f:     p.origin.toUpperCase(),
    t:     p.destination.toUpperCase(),
    d:     toCompact(p.departureDate),
    tt:    p.returnDate ? 2 : 1,
    sc:    7,   // 7 = award redemption search
    px:    p.passengers ?? 1,
    taxng: 1,
  })}`,

  // Delta SkyMiles — tripType/fromCity/toCity/departureDate (MM/DD/YYYY)/cabinFilter
  DL: (p) => `https://www.delta.com/us/en/flight-search/book-a-flight?${qs({
    tripType:      p.returnDate ? 'ROUND_TRIP' : 'ONE_WAY',
    fromCity:      p.origin.toUpperCase(),
    toCity:        p.destination.toUpperCase(),
    departureDate: toUsDate(p.departureDate),
    returnDate:    p.returnDate ? toUsDate(p.returnDate) : undefined,
    paxCount:      p.passengers ?? 1,
    cabinFilter:
      p.cabin === 'first'    ? 'FIRST_CLASS' :
      p.cabin === 'business' ? 'BUSINESS'    : 'ECONOMY',
  })}`,

  // American AAdvantage — tripType/origin/dest/departDate/cabin
  AA: (p) => `https://www.aa.com/booking/find-flights?${qs({
    tripType:             p.returnDate ? 'roundTrip' : 'oneWay',
    passenger_type_adult: p.passengers ?? 1,
    origin:               p.origin.toUpperCase(),
    dest:                 p.destination.toUpperCase(),
    departDate:           p.departureDate,
    returnDate:           p.returnDate,
    cabin:
      p.cabin === 'business' ? 'Business' :
      p.cabin === 'first'    ? 'First'    : 'Coach',
  })}`,

  // Southwest Rapid Rewards — dynamic points pricing, fareType=POINTS
  WN: (p) => `https://www.southwest.com/air/booking/select-depart.html?${qs({
    adultPassengersCount:   p.passengers ?? 1,
    departureDate:          p.departureDate,
    originationAirportCode: p.origin.toUpperCase(),
    destinationAirportCode: p.destination.toUpperCase(),
    fareType:               'POINTS',
    tripType:               p.returnDate ? 'roundtrip' : 'oneway',
    returnDate:             p.returnDate,
  })}`,

  // JetBlue TrueBlue — dynamic points, usePoints=true
  B6: (p) => `https://www.jetblue.com/booking/flights?${qs({
    from:         p.origin.toUpperCase(),
    to:           p.destination.toUpperCase(),
    depart:       p.departureDate,
    return:       p.returnDate,
    isMultiCity:  false,
    noOfRoute:    1,
    adults:       p.passengers ?? 1,
    children:     0,
    infants:      0,
    sharedMarket: false,
    usePoints:    true,
  })}`,

  // British Airways Avios — execclub redemption deep link
  // cabin: M=economy, W=premium_economy, C=business, F=first
  BA: (p) => `https://www.britishairways.com/travel/redeem/execclub/_gf/en_us?${qs({
    eId:          106901,
    tab_selected: 'redeem',
    redemption:   true,
    from:         p.origin.toUpperCase(),
    to:           p.destination.toUpperCase(),
    departDate:   p.departureDate,
    returnDate:   p.returnDate,
    adult:        p.passengers ?? 1,
    cabin:
      p.cabin === 'premium_economy' ? 'W' :
      p.cabin === 'business'        ? 'C' :
      p.cabin === 'first'           ? 'F' : 'M',
  })}`,

  // Air France Flying Blue — pax=ADT:{n}, tripType=RT|OW
  AF: (p) => `https://wwws.airfrance.us/search/offers?${qs({
    pax:         `ADT:${p.passengers ?? 1}`,
    cabinClass:  p.cabin === 'business' ? 'BUSINESS' : p.cabin === 'first' ? 'FIRST' : 'ECONOMY',
    from:        p.origin.toUpperCase(),
    to:          p.destination.toUpperCase(),
    outwardDate: p.departureDate,
    returnDate:  p.returnDate,
    tripType:    p.returnDate ? 'RT' : 'OW',
    currency:    'USD',
  })}`,

  // KLM Flying Blue (same program as AF, different domain)
  KL: (p) => `https://www.klm.com/search/offers?${qs({
    pax:         `ADT:${p.passengers ?? 1}`,
    cabinClass:  p.cabin === 'business' ? 'BUSINESS' : p.cabin === 'first' ? 'FIRST' : 'ECONOMY',
    from:        p.origin.toUpperCase(),
    to:          p.destination.toUpperCase(),
    outwardDate: p.departureDate,
    returnDate:  p.returnDate,
    tripType:    p.returnDate ? 'RT' : 'OW',
    currency:    'USD',
  })}`,

  // Singapore KrisFlyer — type=saver, cabin: Y=economy, J=business, F=first
  SQ: (p) => `https://www.singaporeair.com/en_UK/us/plan-travel/book-a-flight/?${qs({
    type:        'saver',
    tripType:    p.returnDate ? 'R' : 'O',
    origin:      p.origin.toUpperCase(),
    destination: p.destination.toUpperCase(),
    departDate:  p.departureDate,
    returnDate:  p.returnDate,
    adult:       p.passengers ?? 1,
    cabin:
      p.cabin === 'business' ? 'J' :
      p.cabin === 'first'    ? 'F' : 'Y',
  })}`,

  // Virgin Atlantic Flying Club — type=redemption
  VS: (p) => `https://www.virginatlantic.com/flights/search?${qs({
    type:                 'redemption',
    departureAirportCode: p.origin.toUpperCase(),
    arrivalAirportCode:   p.destination.toUpperCase(),
    departureDate:        p.departureDate,
    returnDate:           p.returnDate,
    adults:               p.passengers ?? 1,
    cabin:
      p.cabin === 'premium_economy' ? 'Premium' :
      p.cabin === 'business'        ? 'Upper'   :
      p.cabin === 'first'           ? 'Upper'   : 'Economy',
  })}`,

  // Air Canada Aeroplan — org0/dest0/departureDate0/ADT
  AC: (p) => `https://www.aircanada.com/aeroplan/redeem/availability/outbound?${qs({
    org0:           p.origin.toUpperCase(),
    dest0:          p.destination.toUpperCase(),
    departureDate0: p.departureDate,
    ADT:            p.passengers ?? 1,
    YTH:            0,
    CHD:            0,
    INF:            0,
    INS:            0,
    lang:           'en-CA',
  })}`,

  // Alaska Mileage Plan — useAwardTravel=true
  AS: (p) => `https://www.alaskaair.com/Search/Flights?${qs({
    type:            p.returnDate ? 'roundtrip' : 'oneway',
    origin:          p.origin.toUpperCase(),
    dest:            p.destination.toUpperCase(),
    dt1:             p.departureDate,
    dt2:             p.returnDate,
    A:               p.passengers ?? 1,
    useAwardTravel:  true,
  })}`,

  // Emirates Skywards — loyalty=MILES, class: ECO/BUS/FIRST
  EK: (p) => `https://www.emirates.com/us/english/book/flights/?${qs({
    type:    p.returnDate ? 'return' : 'oneway',
    from:    p.origin.toUpperCase(),
    to:      p.destination.toUpperCase(),
    dep:     p.departureDate,
    ret:     p.returnDate,
    adult:   p.passengers ?? 1,
    class:
      p.cabin === 'business' ? 'BUS'   :
      p.cabin === 'first'    ? 'FIRST' : 'ECO',
    loyalty: 'MILES',
  })}`,

  // Etihad Guest — miles=true
  EY: (p) => `https://www.etihad.com/en-us/book/flight?${qs({
    tripType: p.returnDate ? 'R' : 'O',
    origin:   p.origin.toUpperCase(),
    dest:     p.destination.toUpperCase(),
    depart:   p.departureDate,
    ret:      p.returnDate,
    adults:   p.passengers ?? 1,
    miles:    true,
  })}`,

  // ANA Mileage Club — international award search
  NH: (p) => `https://www.ana.co.jp/en/us/amc/international-flight-awards/?${qs({
    tripType:    p.returnDate ? 'RT' : 'OW',
    origin:      p.origin.toUpperCase(),
    destination: p.destination.toUpperCase(),
    depart:      p.departureDate,
    ret:         p.returnDate,
    adult:       p.passengers ?? 1,
    cabin:
      p.cabin === 'business' ? 'C' :
      p.cabin === 'first'    ? 'F' : 'Y',
  })}`,

  // Avianca LifeMiles — miles=true
  AV: (p) => `https://www.avianca.com/us/en/book-a-flight/?${qs({
    from:   p.origin.toUpperCase(),
    to:     p.destination.toUpperCase(),
    depart: p.departureDate,
    ret:    p.returnDate,
    adults: p.passengers ?? 1,
    miles:  true,
  })}`,

  // Turkish Miles&Smiles — cabin: Y=economy, C=business
  TK: (p) => `https://www.turkishairlines.com/en-us/fly/award-tickets/?${qs({
    tripType: p.returnDate ? 'R' : 'O',
    origin:   p.origin.toUpperCase(),
    dest:     p.destination.toUpperCase(),
    depart:   p.departureDate,
    ret:      p.returnDate,
    adults:   p.passengers ?? 1,
    cabin:    p.cabin === 'business' ? 'C' : 'Y',
  })}`,

  // Cathay Pacific Asia Miles — miles=true
  CX: (p) => `https://www.cathaypacific.com/cx/en_US/book/book-a-flight.html?${qs({
    tripType: p.returnDate ? 'roundtrip' : 'oneway',
    origin:   p.origin.toUpperCase(),
    dest:     p.destination.toUpperCase(),
    depart:   p.departureDate,
    ret:      p.returnDate,
    adults:   p.passengers ?? 1,
    miles:    true,
  })}`,

  // Qantas Frequent Flyer — isAward=true
  QF: (p) => `https://www.qantas.com/us/en/book-a-trip/flights/find.html?${qs({
    tripType: p.returnDate ? 'R' : 'O',
    origin:   p.origin.toUpperCase(),
    dest:     p.destination.toUpperCase(),
    depart:   p.departureDate,
    ret:      p.returnDate,
    adults:   p.passengers ?? 1,
    isAward:  true,
  })}`,

  // Hawaiian Airlines — miles=true
  HA: (p) => `https://www.hawaiianairlines.com/book-travel/flights?${qs({
    type:   p.returnDate ? 'roundtrip' : 'oneway',
    from:   p.origin.toUpperCase(),
    to:     p.destination.toUpperCase(),
    depart: p.departureDate,
    ret:    p.returnDate,
    adults: p.passengers ?? 1,
    miles:  true,
  })}`,

  // Iberia Plus Avios — award=true
  IB: (p) => `https://www.iberia.com/en/flights/?${qs({
    tripType: p.returnDate ? 'roundtrip' : 'oneway',
    from:     p.origin.toUpperCase(),
    to:       p.destination.toUpperCase(),
    depart:   p.departureDate,
    ret:      p.returnDate,
    adults:   p.passengers ?? 1,
    award:    true,
  })}`,

  // Aer Lingus AerClub — avios=true
  EI: (p) => `https://www.aerlingus.com/flight-search/search/?${qs({
    tripType: p.returnDate ? 'return' : 'oneway',
    origin:   p.origin.toUpperCase(),
    dest:     p.destination.toUpperCase(),
    depart:   p.departureDate,
    ret:      p.returnDate,
    adults:   p.passengers ?? 1,
    avios:    true,
  })}`,

  // TAP Air Portugal Miles&Go — miles=true
  TP: (p) => `https://www.flytap.com/en-us/flights?${qs({
    tripType: p.returnDate ? 'roundtrip' : 'oneway',
    from:     p.origin.toUpperCase(),
    to:       p.destination.toUpperCase(),
    depart:   p.departureDate,
    ret:      p.returnDate,
    adults:   p.passengers ?? 1,
    miles:    true,
  })}`,

  // EVA Air — award ticket search
  BR: (p) => `https://www.evaair.com/en-global/award-ticket/?${qs({
    tripType: p.returnDate ? 'RT' : 'OW',
    origin:   p.origin.toUpperCase(),
    dest:     p.destination.toUpperCase(),
    depart:   p.departureDate,
    ret:      p.returnDate,
    adults:   p.passengers ?? 1,
  })}`,
};

// ---------------------------------------------------------------------------
// Transfer partner — Hotel deep links
// Keys match chainKey values used in transferPartners.ts
// ---------------------------------------------------------------------------

const HOTEL_BUILDERS: Record<string, (p: HotelDeepLinkParams) => string> = {

  // World of Hyatt — usePoints=true
  hyatt: (p) => `https://www.hyatt.com/shop/hotels?${qs({
    location:     p.destination,
    checkinDate:  p.checkInDate,
    checkoutDate: p.checkOutDate,
    rooms:        p.rooms ?? 1,
    adults:       p.adults ?? 1,
    kids:         0,
    usePoints:    true,
  })}`,

  // Marriott Bonvoy — clusterCode=points, MM/DD/YYYY dates
  marriott: (p) => `https://www.marriott.com/search/findHotels.mi?${qs({
    clusterCode: 'points',
    cityRegion:  p.destination,
    fromDate:    toUsDate(p.checkInDate),
    toDate:      toUsDate(p.checkOutDate),
    rooms:       p.rooms ?? 1,
    adults:      p.adults ?? 1,
  })}`,

  // Hilton Honors — redeemPts=true
  hilton: (p) => `https://www.hilton.com/en/search/find-hotels/?${qs({
    query:         p.destination,
    arrivalDate:   p.checkInDate,
    departureDate: p.checkOutDate,
    numAdults:     p.adults ?? 1,
    numRooms:      p.rooms ?? 1,
    redeemPts:     true,
  })}`,

  // IHG One Rewards — qRtP=6CBARC selects reward nights rate
  // qCiMy/qCoMy format: MMYYYY (zero-padded month + 4-digit year)
  ihg: (p) => {
    const [ciY, ciM, ciD] = p.checkInDate.split('-');
    const [coY, coM, coD] = p.checkOutDate.split('-');
    return `https://www.ihg.com/hotels/us/en/find-hotels/hotel/list?${qs({
      qDest:  p.destination,
      qCiMy:  `${ciM}${ciY}`,
      qCiD:   Number(ciD),
      qCoMy:  `${coM}${coY}`,
      qCoD:   Number(coD),
      qAdlt:  p.adults ?? 1,
      qChld:  0,
      qRms:   p.rooms ?? 1,
      qRtP:   '6CBARC', // reward nights rate code
      qWch:   0,
    })}`;
  },

  // Wyndham Rewards — useWRPoints=true, MM/DD/YYYY dates
  wyndham: (p) => `https://www.wyndhamhotels.com/search-results?${qs({
    checkInDate:         toUsDate(p.checkInDate),
    checkOutDate:        toUsDate(p.checkOutDate),
    useWRPoints:         true,
    adults:              p.adults ?? 1,
    children:            0,
    rooms:               p.rooms ?? 1,
    destinationFullName: p.destination,
  })}`,

  // Choice Privileges — usePoints=true
  choice: (p) => `https://www.choicehotels.com/search?${qs({
    checkInDate:  p.checkInDate,
    checkOutDate: p.checkOutDate,
    adults:       p.adults ?? 1,
    rooms:        p.rooms ?? 1,
    city:         p.destination,
    usePoints:    true,
  })}`,
};

// ---------------------------------------------------------------------------
// Internal lookup tables (typed for the public API)
// ---------------------------------------------------------------------------

const PORTAL_FLIGHT_BUILDERS: Record<PortalId, (p: FlightDeepLinkParams) => string> = {
  chase:       chaseFlightUrl,
  amex:        amexFlightUrl,
  capital_one: c1FlightUrl,
  citi:        citiFlightUrl,
  bilt:        biltFlightUrl,
};

const PORTAL_HOTEL_BUILDERS: Record<PortalId, (p: HotelDeepLinkParams) => string> = {
  chase:       chaseHotelUrl,
  amex:        amexHotelUrl,
  capital_one: c1HotelUrl,
  citi:        citiHotelUrl,
  bilt:        biltHotelUrl,
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Build a deep link for a credit card travel portal.
 *
 * @example
 *   buildPortalDeepLink('chase', 'flight', { origin: 'LAX', destination: 'JFK',
 *     departureDate: '2025-12-01', returnDate: '2025-12-10', passengers: 1, cabin: 'economy' })
 *   // → "https://travel.chase.com/travel/flights/search?tripType=ROUNDTRIP&origin=LAX&..."
 */
export function buildPortalDeepLink(portalId: PortalId, booking: 'flight', params: FlightDeepLinkParams): string;
export function buildPortalDeepLink(portalId: PortalId, booking: 'hotel',  params: HotelDeepLinkParams):  string;
export function buildPortalDeepLink(
  portalId: PortalId,
  booking:  BookingType,
  params:   FlightDeepLinkParams | HotelDeepLinkParams,
): string {
  if (booking === 'flight') {
    return PORTAL_FLIGHT_BUILDERS[portalId](params as FlightDeepLinkParams);
  }
  return PORTAL_HOTEL_BUILDERS[portalId](params as HotelDeepLinkParams);
}

/**
 * Build a deep link to a transfer partner's booking / award-search page.
 *
 * @param key  IATA airline code (e.g. `'UA'`) or hotel chain key (e.g. `'hyatt'`).
 *             Case-insensitive.
 * @returns    URL string, or `null` if the key is not recognised.
 *
 * @example
 *   buildPartnerDeepLink('UA', 'flight', { origin: 'LAX', destination: 'JFK',
 *     departureDate: '2025-12-01', passengers: 1, cabin: 'economy' })
 *   // → "https://www.united.com/en/us/flifo/flightsearch?f=LAX&t=JFK&d=20251201&..."
 */
export function buildPartnerDeepLink(key: string, booking: 'flight', params: FlightDeepLinkParams): string | null;
export function buildPartnerDeepLink(key: string, booking: 'hotel',  params: HotelDeepLinkParams):  string | null;
export function buildPartnerDeepLink(
  key:     string,
  booking: BookingType,
  params:  FlightDeepLinkParams | HotelDeepLinkParams,
): string | null {
  if (booking === 'flight') {
    const builder = AIRLINE_BUILDERS[key.toUpperCase()];
    return builder ? builder(params as FlightDeepLinkParams) : null;
  }
  const builder = HOTEL_BUILDERS[key.toLowerCase()];
  return builder ? builder(params as HotelDeepLinkParams) : null;
}

/**
 * Convenience helper — returns deep links for all five portals for the same search.
 *
 * @example
 *   allPortalDeepLinks('flight', { origin: 'LAX', destination: 'JFK',
 *     departureDate: '2025-12-01', passengers: 1, cabin: 'economy' })
 *   // → { chase: '...', amex: '...', capital_one: '...', citi: '...', bilt: '...' }
 */
export function allPortalDeepLinks(booking: 'flight', params: FlightDeepLinkParams): Record<PortalId, string>;
export function allPortalDeepLinks(booking: 'hotel',  params: HotelDeepLinkParams):  Record<PortalId, string>;
export function allPortalDeepLinks(
  booking: BookingType,
  params:  FlightDeepLinkParams | HotelDeepLinkParams,
): Record<PortalId, string> {
  const portals: PortalId[] = ['chase', 'amex', 'capital_one', 'citi', 'bilt'];
  return Object.fromEntries(
    portals.map((id) => [id, buildPortalDeepLink(id, booking as 'flight', params as FlightDeepLinkParams)])
  ) as Record<PortalId, string>;
}

/**
 * Portals that require the user to be logged in before a search can be executed.
 * Deep links to these portals will land on the portal's travel page; the search
 * form will not be pre-filled through the authentication wall.
 */
/**
 * Portals where the "Book" link lands on the portal home page only —
 * either because login is required before searching, or because the
 * frontend URL structure is not publicly documented (no pre-fill possible).
 *
 * capital_one is NOT in this map — Hopper platform is publicly searchable
 * and params are attempted.
 */
export const PORTAL_NO_PREFILL: Partial<Record<PortalId, string>> = {
  chase: 'Login required',
  amex:  'Search not pre-filled',  // publicly accessible but path unknown
  citi:  'Login required',
  bilt:  'Login required',
};

/** All airline IATA codes with registered deep-link builders. */
export const SUPPORTED_AIRLINE_PARTNERS = Object.keys(AIRLINE_BUILDERS) as string[];

/** All hotel chain keys with registered deep-link builders. */
export const SUPPORTED_HOTEL_PARTNERS = Object.keys(HOTEL_BUILDERS) as string[];

/**
 * Maps the display name of each transfer partner program (as used in TransferResult.partnerProgram)
 * to the key accepted by buildPartnerDeepLink — an IATA code for airlines or a chain key for hotels.
 *
 * Used by PointsGrid to build "Book" links for transfer-partner rows without modifying TransferResult.
 */
export const PARTNER_PROGRAM_KEY: Record<string, string> = {
  // Hotels
  'World of Hyatt':                'hyatt',
  'IHG One Rewards':               'ihg',
  'Marriott Bonvoy':               'marriott',
  'Hilton Honors':                 'hilton',
  'Wyndham Rewards':               'wyndham',
  'Choice Privileges':             'choice',
  // Airlines
  'United MileagePlus':            'UA',
  'Southwest Rapid Rewards':       'WN',
  'British Airways Avios':         'BA',
  'Air France/KLM Flying Blue':    'AF',
  'Singapore KrisFlyer':           'SQ',
  'Virgin Atlantic Flying Club':   'VS',
  'Delta SkyMiles':                'DL',
  'American AAdvantage':           'AA',
  'Alaska Mileage Plan':           'AS',
  'Air Canada Aeroplan':           'AC',
  'Emirates Skywards':             'EK',
  'Etihad Guest':                  'EY',
  'ANA Mileage Club':              'NH',
  'Hawaiian Miles':                'HA',
  'Iberia Plus':                   'IB',
  'Aer Lingus AerClub':            'EI',
  'TAP Air Portugal Miles&Go':     'TP',
  'Turkish Miles&Smiles':          'TK',
  'Cathay Pacific Asia Miles':     'CX',
  'JetBlue TrueBlue':              'B6',
  'Qantas Frequent Flyer':         'QF',
  'Avianca LifeMiles':             'AV',
  'EVA Air':                       'BR',
};
