import {
  CardId,
  PortalId,
  BookingType,
  PortalResult,
  TransferResult,
  RouteType,
  Cabin,
  FlightContext,
  CARD_PORTAL_MAP,
  PORTAL_CPP,
} from './types';

// ---------------------------------------------------------------------------
// Route classification helpers
// ---------------------------------------------------------------------------

const US_AIRPORTS = new Set([
  'ATL','LAX','ORD','DFW','DEN','JFK','SFO','SEA','LAS','MCO',
  'EWR','CLT','PHX','IAH','MIA','BOS','MSP','DTW','FLL','PHL',
  'LGA','BWI','SLC','DCA','MDW','HNL','SAN','TPA','PDX','STL',
  'BNA','AUS','MSY','OAK','SMF','DAL','HOU','SJC','RSW','RDU',
  'OGG','CLE','IND','CMH','MCI','PIT','SAT','JAX','MEM','SNA',
  'OMA','BUF','BDL','CHS','ABQ','RIC','BHM','TUS','ELP','LGB',
  'GUM','PPT', // US territories
]);

/** Canada, Mexico, Caribbean, Central America — short-haul from US */
const SHORT_HAUL_INTL_AIRPORTS = new Set([
  'YYZ','YVR','YUL','YYC','YOW','YEG','YHZ','YWG',             // Canada
  'MEX','CUN','GDL','MTY','TIJ','SJD','PVR','MID','VER','ZIH', // Mexico
  'SJU','NAS','KIN','BGI','STT','STX','PLS','AUA','CUR','POP',  // Caribbean
  'GUA','SAL','SJO','PTY','MGA','TGU','BZE',                    // Central America
  'BDA',                                                          // Bermuda
]);

export function classifyRoute(originIata?: string | null, destIata?: string | null): RouteType {
  if (!originIata || !destIata) return 'long_haul';
  const o = originIata.toUpperCase();
  const d = destIata.toUpperCase();
  const oUs = US_AIRPORTS.has(o);
  const dUs = US_AIRPORTS.has(d);
  if (oUs && dUs) return 'domestic';
  if ((oUs && SHORT_HAUL_INTL_AIRPORTS.has(d)) || (dUs && SHORT_HAUL_INTL_AIRPORTS.has(o))) {
    return 'short_haul';
  }
  return 'long_haul';
}

// ---------------------------------------------------------------------------
// Award rate tables  (one-way, saver/economy-level rates, approximate)
// ---------------------------------------------------------------------------

type AwardRates = Partial<Record<RouteType, Partial<Record<Cabin, number>>>>;

/**
 * Flat award estimates in miles/points (one-way, saver rates).
 * Sources: published partner award charts as of 2025.
 * These are approximate mid-range saver rates — actual availability varies.
 */
const AWARD_RATES: Record<string, AwardRates> = {
  // United MileagePlus
  UA: {
    domestic:   { economy: 12500, business: 25000, first: 40000 },
    short_haul: { economy: 15000, business: 25000, first: 40000 },
    long_haul:  { economy: 30000, business: 70000, first: 110000 },
  },
  // Southwest Rapid Rewards (dynamic / cash-based, estimate ~1.5cpp)
  WN: {
    domestic:   { economy: 10000 },
    short_haul: { economy: 12000 },
  },
  // British Airways Avios (distance-based; using Avios zone estimates)
  BA: {
    domestic:   { economy: 7500,  business: 15000 },
    short_haul: { economy: 9000,  business: 18000 },
    long_haul:  { economy: 30000, business: 68000, first: 85000 },
  },
  // Air France / KLM Flying Blue
  AF: {
    domestic:   { economy: 10000, business: 20000 },
    short_haul: { economy: 12000, business: 25000 },
    long_haul:  { economy: 30000, business: 75000, first: 110000 },
  },
  KL: {
    domestic:   { economy: 10000, business: 20000 },
    short_haul: { economy: 12000, business: 25000 },
    long_haul:  { economy: 30000, business: 75000, first: 110000 },
  },
  // Singapore KrisFlyer
  SQ: {
    short_haul: { economy: 20000, business: 40000 },
    long_haul:  { economy: 45000, business: 97500, first: 145000 },
  },
  // ANA Mileage Club
  NH: {
    short_haul: { economy: 20000, business: 40000 },
    long_haul:  { economy: 55000, business: 88000, first: 120000 },
  },
  // Virgin Atlantic Flying Club
  VS: {
    domestic:   { economy: 10000, business: 20000 },
    short_haul: { economy: 13000, business: 28000 },
    long_haul:  { economy: 30000, business: 60000, first: 95000 },
  },
  // Air Canada Aeroplan
  AC: {
    domestic:   { economy: 12500, business: 25000 },
    short_haul: { economy: 15000, business: 35000 },
    long_haul:  { economy: 35000, business: 65000, first: 110000 },
  },
  // Emirates Skywards
  EK: {
    short_haul: { economy: 20000, business: 42000 },
    long_haul:  { economy: 58500, business: 148500, first: 250000 },
  },
  // Etihad Guest
  EY: {
    short_haul: { economy: 18000, business: 40000 },
    long_haul:  { economy: 40000, business: 80000, first: 120000 },
  },
  // Hawaiian Miles
  HA: {
    domestic:   { economy: 12500, business: 25000 },
    short_haul: { economy: 15000, business: 30000 },
    long_haul:  { economy: 40000, business: 60000 },
  },
  // Iberia Plus Avios
  IB: {
    domestic:   { economy: 7500,  business: 15000 },
    short_haul: { economy: 9000,  business: 18000 },
    long_haul:  { economy: 34000, business: 68000 },
  },
  // Aer Lingus AerClub Avios
  EI: {
    domestic:   { economy: 7500,  business: 15000 },
    short_haul: { economy: 9500,  business: 19000 },
    long_haul:  { economy: 26500, business: 60000 },
  },
  // JetBlue TrueBlue (dynamic)
  B6: {
    domestic:   { economy: 15000 },
    short_haul: { economy: 17500 },
    long_haul:  { economy: 35000, business: 50000 },
  },
  // Qantas Frequent Flyer
  QF: {
    short_haul: { economy: 18000, business: 36000 },
    long_haul:  { economy: 36000, business: 72000, first: 110000 },
  },
  // Delta SkyMiles (dynamic; rough estimates)
  DL: {
    domestic:   { economy: 15000, business: 30000 },
    short_haul: { economy: 18000, business: 35000 },
    long_haul:  { economy: 35000, business: 75000, first: 120000 },
  },
  // American AAdvantage
  AA: {
    domestic:   { economy: 12500, business: 25000, first: 50000 },
    short_haul: { economy: 15000, business: 25000 },
    long_haul:  { economy: 30000, business: 57500, first: 115000 },
  },
  // Alaska Mileage Plan
  AS: {
    domestic:   { economy: 12500, business: 25000 },
    short_haul: { economy: 15000, business: 30000 },
    long_haul:  { economy: 40000, business: 80000 },
  },
  // Avianca LifeMiles
  AV: {
    domestic:   { economy: 12500, business: 25000 },
    short_haul: { economy: 15000, business: 30000 },
    long_haul:  { economy: 30000, business: 63000 },
  },
  // Turkish Miles&Smiles
  TK: {
    short_haul: { economy: 15000, business: 30000 },
    long_haul:  { economy: 45000, business: 90000 },
  },
  // Cathay Pacific Asia Miles
  CX: {
    short_haul: { economy: 20000, business: 40000 },
    long_haul:  { economy: 50000, business: 95000, first: 150000 },
  },
  // TAP Miles&Go
  TP: {
    short_haul: { economy: 10000, business: 20000 },
    long_haul:  { economy: 30000, business: 60000 },
  },
  // EVA Air
  BR: {
    short_haul: { economy: 20000, business: 40000 },
    long_haul:  { economy: 35000, business: 70000, first: 110000 },
  },
};

function lookupAwardEstimate(iataCodes: string[], routeType: RouteType, cabin: Cabin): number | null {
  for (const code of iataCodes) {
    const rates = AWARD_RATES[code.toUpperCase()];
    if (!rates) continue;
    const routeRates = rates[routeType];
    if (!routeRates) continue;
    // Fall back from first → business → economy if the specific cabin isn't listed
    if (cabin === 'first' && routeRates.first) return routeRates.first;
    if (cabin === 'business' && routeRates.business) return routeRates.business;
    if (cabin === 'first' && routeRates.business) return routeRates.business; // no first data, use biz
    if (routeRates.economy) return routeRates.economy;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Transfer partner configs
// ---------------------------------------------------------------------------

interface TransferPartnerConfig {
  program: string;
  type: 'hotel' | 'airline';
  ratio: string;
  /** Lowercase key for hotel chain matching, e.g. 'hyatt', 'marriott' */
  chainKey?: string;
  /** IATA codes this airline partner maps to, e.g. ['UA'] */
  iataCodes?: string[];
}

const TRANSFER_PARTNERS: Record<PortalId, TransferPartnerConfig[]> = {
  chase: [
    { program: 'World of Hyatt',                type: 'hotel',   ratio: '1:1', chainKey: 'hyatt' },
    { program: 'IHG One Rewards',               type: 'hotel',   ratio: '1:1', chainKey: 'ihg' },
    { program: 'Marriott Bonvoy',               type: 'hotel',   ratio: '1:1', chainKey: 'marriott' },
    { program: 'United MileagePlus',            type: 'airline', ratio: '1:1', iataCodes: ['UA'] },
    { program: 'Southwest Rapid Rewards',       type: 'airline', ratio: '1:1', iataCodes: ['WN'] },
    { program: 'British Airways Avios',         type: 'airline', ratio: '1:1', iataCodes: ['BA'] },
    { program: 'Air France/KLM Flying Blue',    type: 'airline', ratio: '1:1', iataCodes: ['AF', 'KL'] },
    { program: 'Singapore KrisFlyer',           type: 'airline', ratio: '1:1', iataCodes: ['SQ'] },
    { program: 'Virgin Atlantic Flying Club',   type: 'airline', ratio: '1:1', iataCodes: ['VS'] },
    { program: 'Iberia Plus',                   type: 'airline', ratio: '1:1', iataCodes: ['IB'] },
    { program: 'Aer Lingus AerClub',            type: 'airline', ratio: '1:1', iataCodes: ['EI'] },
    { program: 'Air Canada Aeroplan',           type: 'airline', ratio: '1:1', iataCodes: ['AC'] },
    { program: 'Emirates Skywards',             type: 'airline', ratio: '1:1', iataCodes: ['EK'] },
    { program: 'JetBlue TrueBlue',              type: 'airline', ratio: '1:1', iataCodes: ['B6'] },
  ],
  amex: [
    { program: 'Hilton Honors',                 type: 'hotel',   ratio: '1:2', chainKey: 'hilton' },
    { program: 'Marriott Bonvoy',               type: 'hotel',   ratio: '1:1', chainKey: 'marriott' },
    { program: 'Delta SkyMiles',                type: 'airline', ratio: '1:1', iataCodes: ['DL'] },
    { program: 'British Airways Avios',         type: 'airline', ratio: '1:1', iataCodes: ['BA'] },
    { program: 'Air France/KLM Flying Blue',    type: 'airline', ratio: '1:1', iataCodes: ['AF', 'KL'] },
    { program: 'Singapore KrisFlyer',           type: 'airline', ratio: '1:1', iataCodes: ['SQ'] },
    { program: 'ANA Mileage Club',              type: 'airline', ratio: '1:1', iataCodes: ['NH'] },
    { program: 'Virgin Atlantic Flying Club',   type: 'airline', ratio: '1:1', iataCodes: ['VS'] },
    { program: 'Air Canada Aeroplan',           type: 'airline', ratio: '1:1', iataCodes: ['AC'] },
    { program: 'Emirates Skywards',             type: 'airline', ratio: '1:1', iataCodes: ['EK'] },
    { program: 'Etihad Guest',                  type: 'airline', ratio: '1:1', iataCodes: ['EY'] },
    { program: 'Hawaiian Miles',                type: 'airline', ratio: '1:1', iataCodes: ['HA'] },
    { program: 'Iberia Plus',                   type: 'airline', ratio: '1:1', iataCodes: ['IB'] },
    { program: 'JetBlue TrueBlue',              type: 'airline', ratio: '1:1', iataCodes: ['B6'] },
    { program: 'Qantas Frequent Flyer',         type: 'airline', ratio: '1:1', iataCodes: ['QF'] },
  ],
  capital_one: [
    { program: 'Wyndham Rewards',               type: 'hotel',   ratio: '1:1', chainKey: 'wyndham' },
    { program: 'Choice Privileges',             type: 'hotel',   ratio: '1:1', chainKey: 'choice' },
    { program: 'Air Canada Aeroplan',           type: 'airline', ratio: '1:1', iataCodes: ['AC'] },
    { program: 'Air France/KLM Flying Blue',    type: 'airline', ratio: '1:1', iataCodes: ['AF', 'KL'] },
    { program: 'Avianca LifeMiles',             type: 'airline', ratio: '1:1', iataCodes: ['AV'] },
    { program: 'British Airways Avios',         type: 'airline', ratio: '1:1', iataCodes: ['BA'] },
    { program: 'Emirates Skywards',             type: 'airline', ratio: '1:1', iataCodes: ['EK'] },
    { program: 'Etihad Guest',                  type: 'airline', ratio: '1:1', iataCodes: ['EY'] },
    { program: 'Singapore KrisFlyer',           type: 'airline', ratio: '1:1', iataCodes: ['SQ'] },
    { program: 'Turkish Miles&Smiles',          type: 'airline', ratio: '1:1', iataCodes: ['TK'] },
    { program: 'Virgin Atlantic Flying Club',   type: 'airline', ratio: '1:1', iataCodes: ['VS'] },
    { program: 'TAP Air Portugal Miles&Go',     type: 'airline', ratio: '1:1', iataCodes: ['TP'] },
  ],
  bilt: [
    { program: 'World of Hyatt',                type: 'hotel',   ratio: '1:1', chainKey: 'hyatt' },
    { program: 'IHG One Rewards',               type: 'hotel',   ratio: '1:1', chainKey: 'ihg' },
    { program: 'Marriott Bonvoy',               type: 'hotel',   ratio: '1:1', chainKey: 'marriott' },
    { program: 'American AAdvantage',           type: 'airline', ratio: '1:1', iataCodes: ['AA'] },
    { program: 'United MileagePlus',            type: 'airline', ratio: '1:1', iataCodes: ['UA'] },
    { program: 'Alaska Mileage Plan',           type: 'airline', ratio: '1:1', iataCodes: ['AS'] },
    { program: 'Air France/KLM Flying Blue',    type: 'airline', ratio: '1:1', iataCodes: ['AF', 'KL'] },
    { program: 'British Airways Avios',         type: 'airline', ratio: '1:1', iataCodes: ['BA'] },
    { program: 'Virgin Atlantic Flying Club',   type: 'airline', ratio: '1:1', iataCodes: ['VS'] },
    { program: 'Cathay Pacific Asia Miles',     type: 'airline', ratio: '1:1', iataCodes: ['CX'] },
    { program: 'Emirates Skywards',             type: 'airline', ratio: '1:1', iataCodes: ['EK'] },
    { program: 'Turkish Miles&Smiles',          type: 'airline', ratio: '1:1', iataCodes: ['TK'] },
  ],
  citi: [
    { program: 'Air France/KLM Flying Blue',    type: 'airline', ratio: '1:1', iataCodes: ['AF', 'KL'] },
    { program: 'Avianca LifeMiles',             type: 'airline', ratio: '1:1', iataCodes: ['AV'] },
    { program: 'Turkish Miles&Smiles',          type: 'airline', ratio: '1:1', iataCodes: ['TK'] },
    { program: 'Virgin Atlantic Flying Club',   type: 'airline', ratio: '1:1', iataCodes: ['VS'] },
    { program: 'Cathay Pacific Asia Miles',     type: 'airline', ratio: '1:1', iataCodes: ['CX'] },
    { program: 'Singapore KrisFlyer',           type: 'airline', ratio: '1:1', iataCodes: ['SQ'] },
    { program: 'Air Canada Aeroplan',           type: 'airline', ratio: '1:1', iataCodes: ['AC'] },
    { program: 'EVA Air',                       type: 'airline', ratio: '1:1', iataCodes: ['BR'] },
  ],
};

const HOTEL_CHAIN_NOTES: Record<string, string> = {
  hyatt:    'Award pricing varies by property category — check World of Hyatt award chart',
  ihg:      'Award pricing varies by property category — check IHG One Rewards award chart',
  marriott: 'Award pricing varies by property category — check Marriott Bonvoy award chart',
  hilton:   'Award pricing varies by property category — check Hilton Honors award chart',
  wyndham:  'Award pricing varies by property category — check Wyndham Rewards award chart',
  choice:   'Award pricing varies by property category — check Choice Privileges award chart',
};

function resolveChainKey(hotelChain: string): string | null {
  const lower = hotelChain.toLowerCase();
  for (const key of Object.keys(HOTEL_CHAIN_NOTES)) {
    if (lower.includes(key)) return key;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export function calcTransferAlternatives(
  priceUsd: number,
  bookingType: BookingType,
  userCards: CardId[],
  bestPortalResult: PortalResult,
  hotelChain?: string | null,
  airlineIata?: string | null,
  flightCtx?: FlightContext,
): TransferResult[] {
  // Collect unique portals the user has access to, mapped to their best card per portal
  const portalCardMap = new Map<PortalId, CardId>();
  for (const cardId of userCards) {
    const portalId = CARD_PORTAL_MAP[cardId];
    if (portalId && !portalCardMap.has(portalId)) {
      portalCardMap.set(portalId, cardId);
    }
  }

  // Resolve route context for flight transfers
  const routeType: RouteType =
    flightCtx?.routeType ??
    classifyRoute(flightCtx?.originIata, flightCtx?.destIata);
  const cabin: Cabin = flightCtx?.cabin ?? 'economy';

  const chainKey = hotelChain ? resolveChainKey(hotelChain) : null;
  const results: TransferResult[] = [];

  for (const [portalId, sourceCardId] of portalCardMap.entries()) {
    const partners = TRANSFER_PARTNERS[portalId];

    const expectedPartnerType = bookingType === 'flight' ? 'airline' : 'hotel';
    for (const partner of partners) {
      if (partner.type !== expectedPartnerType) continue;

      // For hotels: if chain provided, only include matching partner
      if (bookingType === 'hotel' && chainKey !== null) {
        if (partner.chainKey !== chainKey) continue;
      }

      // For flights: if airline IATA provided, only include matching partner
      const filterIata = airlineIata ?? flightCtx?.airlineIata;
      if (bookingType === 'flight' && filterIata != null) {
        if (!partner.iataCodes?.includes(filterIata.toUpperCase())) continue;
      }

      let estimatedPointsNeeded: number | null = null;
      let estimatedCentsPerPoint: number | null = null;
      let transferCpp: number | null = null;
      let note: string;

      if (bookingType === 'hotel') {
        note = HOTEL_CHAIN_NOTES[partner.chainKey ?? ''] ?? 'Award pricing varies — check program award chart';
      } else {
        // Look up flat award estimate for this partner, route type, and cabin
        const awardMiles = partner.iataCodes
          ? lookupAwardEstimate(partner.iataCodes, routeType, cabin)
          : null;

        if (awardMiles !== null) {
          // All partners are 1:1 ratio, so card points needed = award miles needed
          estimatedPointsNeeded = awardMiles;
          // Effective CPP: how many cents of flight value each transferred point buys
          transferCpp = parseFloat(((priceUsd / awardMiles) * 100).toFixed(2));
          estimatedCentsPerPoint = transferCpp;
          const routeLabel = routeType === 'domestic' ? 'domestic' : routeType === 'short_haul' ? 'short-haul' : 'long-haul';
          note = `Approx. ${cabin} saver rate for ${routeLabel} — award availability varies`;
        } else {
          note = 'Award pricing varies by route and availability — check the partner program\'s award chart';
        }
      }

      const isBetterThanPortal =
        estimatedPointsNeeded !== null &&
        estimatedPointsNeeded < bestPortalResult.pointsNeeded;

      results.push({
        partnerProgram: partner.program,
        partnerType: partner.type,
        sourceCardId,
        sourcePortalId: portalId,
        transferRatio: partner.ratio,
        estimatedPointsNeeded,
        estimatedCentsPerPoint,
        transferCpp,
        note,
        isBetterThanPortal,
        estimated: true,
        routeType: bookingType === 'flight' ? routeType : undefined,
        cabin: bookingType === 'flight' ? cabin : undefined,
      });
    }
  }

  // Deduplicate by partnerProgram — same airline program appears in multiple portals
  // (e.g. BA Avios is a Chase, Amex, Capital One, and Bilt partner).
  // Keep the entry whose source card has the highest CPP so the user knows the best card to transfer from.
  const deduped = new Map<string, TransferResult>();
  for (const r of results) {
    const existing = deduped.get(r.partnerProgram);
    if (!existing) {
      deduped.set(r.partnerProgram, r);
    } else {
      const newCpp  = typeof PORTAL_CPP[r.sourceCardId] === 'number'
        ? (PORTAL_CPP[r.sourceCardId] as number)
        : (PORTAL_CPP[r.sourceCardId] as { hotel: number; flight: number })[bookingType];
      const prevCpp = typeof PORTAL_CPP[existing.sourceCardId] === 'number'
        ? (PORTAL_CPP[existing.sourceCardId] as number)
        : (PORTAL_CPP[existing.sourceCardId] as { hotel: number; flight: number })[bookingType];
      if (newCpp > prevCpp) deduped.set(r.partnerProgram, r);
    }
  }

  // isBetterThanPortal: true results first
  return Array.from(deduped.values()).sort(
    (a, b) => Number(b.isBetterThanPortal) - Number(a.isBetterThanPortal),
  );
}
