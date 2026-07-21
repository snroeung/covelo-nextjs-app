import {
  CardId,
  PortalId,
  BookingType,
  PortalResult,
  TransferResult,
  EligibleTransferCard,
  RouteType,
  Cabin,
  FlightContext,
  CARD_PORTAL_MAP,
  CARD_NAMES,
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

type TransferValueCpp = Partial<Record<Cabin, number>>;

/**
 * Typical redemption value (cents per point) for each airline program's saver
 * awards. The `economy` figure approximates The Points Guy's blended monthly
 * valuation (thepointsguy.com/guide/monthly-valuations/) as of 2025 — TPG
 * publishes one number per program, not a cabin breakdown. `business`/`first`
 * are NOT sourced from TPG: they're an unverified estimate (~1.2-1.6x economy,
 * reflecting that premium-cabin awards are typically better value) and should
 * be replaced with real award-chart data before this is treated as accurate.
 * Unlike a flat miles chart, this scales with the flight's actual price the
 * same way PORTAL_CPP drives PortalResult.pointsNeeded in calcPoints.ts —
 * estimatedPointsNeeded = priceUsd / (cpp / 100), so two flights on the same
 * program never coincidentally land on the same points figure.
 */
const TRANSFER_CPP: Record<string, TransferValueCpp> = {
  UA: { economy: 1.3, business: 1.5, first: 1.7 },
  WN: { economy: 1.4 },
  BA: { economy: 1.3, business: 1.6, first: 1.8 },
  AF: { economy: 1.3, business: 1.6, first: 1.9 },
  KL: { economy: 1.3, business: 1.6, first: 1.9 },
  SQ: { economy: 1.7, business: 2.3, first: 3.0 },
  NH: { economy: 1.5, business: 2.0, first: 2.6 },
  VS: { economy: 1.5, business: 2.0, first: 2.4 },
  AC: { economy: 1.3, business: 1.6, first: 1.9 },
  EK: { economy: 1.0, business: 1.6, first: 2.2 },
  EY: { economy: 1.2, business: 1.6, first: 2.0 },
  HA: { economy: 1.0, business: 1.3 },
  IB: { economy: 1.4, business: 1.7 },
  EI: { economy: 1.4, business: 1.7 },
  B6: { economy: 1.3 },
  QF: { economy: 1.4, business: 1.8, first: 2.2 },
  DL: { economy: 1.1, business: 1.3, first: 1.5 },
  AA: { economy: 1.5, business: 1.8, first: 2.1 },
  AS: { economy: 1.6, business: 2.0 },
  AV: { economy: 1.4, business: 1.7 },
  TK: { economy: 1.5, business: 2.0 },
  CX: { economy: 1.5, business: 2.2, first: 2.8 },
  TP: { economy: 1.3, business: 1.6 },
  BR: { economy: 1.4, business: 1.8, first: 2.2 },
};

function lookupTransferCpp(iataCodes: string[], cabin: Cabin): number | null {
  for (const code of iataCodes) {
    const rates = TRANSFER_CPP[code.toUpperCase()];
    if (!rates) continue;
    // Fall back from first → business → economy if the specific cabin isn't listed
    if (cabin === 'first' && rates.first) return rates.first;
    if ((cabin === 'first' || cabin === 'business') && rates.business) return rates.business;
    if (rates.economy) return rates.economy;
  }
  return null;
}

/**
 * Typical redemption value (cents per point) for each hotel chain's standard
 * award pricing. Same role as TRANSFER_CPP for airlines: approximates TPG's
 * monthly hotel-points valuations (thepointsguy.com/guide/monthly-valuations/)
 * as of 2025. Hotels have no cabin tiers, so this is a single flat rate per
 * chain rather than economy/business/first — real award cost still varies by
 * property category, which the accompanying note callout communicates.
 */
const HOTEL_CPP: Record<string, number> = {
  hyatt:    1.7,
  wyndham:  0.9,
  marriott: 0.8,
  choice:   0.6,
  ihg:      0.5,
  hilton:   0.5,
};

function lookupHotelCpp(chainKey: string | undefined): number | null {
  if (!chainKey) return null;
  return HOTEL_CPP[chainKey] ?? null;
}

// ---------------------------------------------------------------------------
// Transfer partner configs
// ---------------------------------------------------------------------------

export interface TransferPartnerConfig {
  program: string;
  type: 'hotel' | 'airline';
  ratio: string;
  /** Lowercase key for hotel chain matching, e.g. 'hyatt', 'marriott' */
  chainKey?: string;
  /** IATA codes this airline partner maps to, e.g. ['UA'] */
  iataCodes?: string[];
}

/**
 * Bundled fallback set, used when no DB-backed transferPartners map is passed
 * in (tests, pre-fetch render) and as the seed source for the
 * transfer_partners table (see supabase/migrations/015_transfer_partners_seed.sql).
 * The live app reads from Supabase via trpc.portalData.listTransferPartners —
 * see hooks/usePointsCalc.ts.
 */
export const STATIC_TRANSFER_PARTNERS: Record<PortalId, TransferPartnerConfig[]> = {
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

const UNMATCHED_CHAIN = '__unmatched_chain__';

function resolveChainKey(hotelChain: string): string | null {
  const lower = hotelChain.toLowerCase();
  for (const key of Object.keys(HOTEL_CHAIN_NOTES)) {
    if (lower.includes(key)) return key;
  }
  return null;
}

/** Every one of the user's cards whose portal reaches this partner program (dedupe by card). */
function findEligibleCards(
  partnerProgram: string,
  expectedPartnerType: 'hotel' | 'airline',
  chainKey: string | null,
  filterIata: string | null,
  userCards: CardId[],
  partnersMap: Record<PortalId, TransferPartnerConfig[]>,
): EligibleTransferCard[] {
  const seen = new Set<CardId>();
  const eligible: EligibleTransferCard[] = [];
  for (const cardId of userCards) {
    if (seen.has(cardId)) continue;
    const portalId = CARD_PORTAL_MAP[cardId];
    if (!portalId) continue;
    const partner = partnersMap[portalId].find(p => {
      if (p.type !== expectedPartnerType || p.program !== partnerProgram) return false;
      if (expectedPartnerType === 'hotel' && chainKey !== null && p.chainKey !== chainKey) return false;
      if (expectedPartnerType === 'airline' && filterIata != null && !p.iataCodes?.includes(filterIata.toUpperCase())) return false;
      return true;
    });
    if (partner) {
      seen.add(cardId);
      eligible.push({ cardId, cardName: CARD_NAMES[cardId], portalId, ratio: partner.ratio });
    }
  }
  return eligible;
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
  /** User's actually-selected cards (owned) — defaults to userCards when omitted */
  selectedCards?: CardId[],
  /** DB-backed partner map (trpc.portalData.listTransferPartners) — falls back to the bundled static set when omitted (tests, pre-fetch render). */
  transferPartners: Record<PortalId, TransferPartnerConfig[]> = STATIC_TRANSFER_PARTNERS,
): TransferResult[] {
  const ownedCards = selectedCards ?? userCards;
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

  // hotelChain given but not part of any known transferable chain (e.g. an
  // independent property) → sentinel that matches no partner.chainKey, so
  // every hotel transfer partner is filtered out instead of all showing.
  const chainKey = hotelChain ? resolveChainKey(hotelChain) ?? UNMATCHED_CHAIN : null;
  const expectedPartnerType = bookingType === 'flight' ? 'airline' : 'hotel';
  const filterIata = airlineIata ?? flightCtx?.airlineIata ?? null;
  const results: TransferResult[] = [];

  for (const [portalId, sourceCardId] of portalCardMap.entries()) {
    const partners = transferPartners[portalId];

    for (const partner of partners) {
      if (partner.type !== expectedPartnerType) continue;

      // For hotels: if chain provided, only include matching partner
      if (bookingType === 'hotel' && chainKey !== null) {
        if (partner.chainKey !== chainKey) continue;
      }

      // For flights: if airline IATA provided, only include matching partner
      if (bookingType === 'flight' && filterIata != null) {
        if (!partner.iataCodes?.includes(filterIata.toUpperCase())) continue;
      }

      let estimatedPointsNeeded: number | null = null;
      let estimatedCentsPerPoint: number | null = null;
      let transferCpp: number | null = null;
      let note: string;

      if (bookingType === 'hotel') {
        // Typical redemption value for this chain, applied to the actual stay
        // price — same price/cpp formula as the airline branch below.
        const cpp = lookupHotelCpp(partner.chainKey);
        const chainNote = HOTEL_CHAIN_NOTES[partner.chainKey ?? ''] ?? 'Award pricing varies — check program award chart';

        if (cpp !== null) {
          transferCpp = cpp;
          estimatedCentsPerPoint = cpp;
          estimatedPointsNeeded = Math.ceil((priceUsd / cpp) * 100);
          note = `Est. using ${partner.program}'s typical ${cpp}¢/pt award value — ${chainNote.charAt(0).toLowerCase()}${chainNote.slice(1)}`;
        } else {
          note = chainNote;
        }
      } else {
        // Typical redemption value for this partner + cabin, applied to the
        // actual flight price — same price/cpp formula as PortalResult.
        const cpp = partner.iataCodes
          ? lookupTransferCpp(partner.iataCodes, cabin)
          : null;

        if (cpp !== null) {
          transferCpp = cpp;
          estimatedCentsPerPoint = cpp;
          estimatedPointsNeeded = Math.ceil((priceUsd / cpp) * 100);
          note = `Est. using ${partner.program}'s typical ${cpp}¢/pt ${cabin} value — actual award pricing varies`;
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
        eligibleCards: [],
        recommendedCards: [],
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

  // Attach the user's owned cards that can reach this partner for the chip UI;
  // when none are owned, surface cards (from the full pool) that would unlock it.
  for (const r of deduped.values()) {
    const owned = findEligibleCards(r.partnerProgram, expectedPartnerType, chainKey, filterIata, ownedCards, transferPartners);
    r.eligibleCards = owned;
    r.recommendedCards = owned.length === 0
      ? findEligibleCards(r.partnerProgram, expectedPartnerType, chainKey, filterIata, userCards, transferPartners)
      : [];
  }

  // isBetterThanPortal: true results first
  return Array.from(deduped.values()).sort(
    (a, b) => Number(b.isBetterThanPortal) - Number(a.isBetterThanPortal),
  );
}
