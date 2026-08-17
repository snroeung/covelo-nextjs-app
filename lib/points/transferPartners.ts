import {
  CardId,
  PortalId,
  BookingType,
  PortalResult,
  TransferResult,
  TransferSourceCard,
  TransferSourceIssuer,
  RouteType,
  Cabin,
  FlightContext,
  CARD_PORTAL_MAP,
  CARD_NAMES,
  ISSUER_CARDS,
  PORTAL_CPP,
} from './types';
import { clusterProgramNames, normalizeProgramName, sameProgram } from './programNames';
import { parseTransferRatio } from './transferRatio';

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

type PartnerCppEntry = { type: 'airline' | 'hotel'; cpp: number };

/**
 * Typical redemption value (cents per point) for each transfer partner
 * program — airlines keyed by IATA code, hotels by chain key. Single merged
 * table (was two: TRANSFER_CPP + HOTEL_CPP) so a new source (e.g. a scraped
 * TPG monthly-valuations feed) has one place to write into.
 *
 * One flat figure per program, for every cabin — approximates The Points
 * Guy's blended monthly valuation (thepointsguy.com/guide/monthly-valuations/)
 * as of 2025. TPG publishes a single number per program, not a cabin
 * breakdown, and there is no other real-award-chart source behind this
 * table, so a cabin split here would just be a fabricated multiplier.
 * Hotel entries have no cabin tiers either — real award cost still varies by
 * property category, which the accompanying note callout communicates.
 *
 * Unlike a flat miles chart, this scales with the trip's actual price the
 * same way PORTAL_CPP drives PortalResult.pointsNeeded in calcPoints.ts —
 * partnerPointsNeeded = priceUsd / (cpp / 100), so two trips on the same
 * program never coincidentally land on the same points figure.
 */
const PARTNER_CPP: Record<string, PartnerCppEntry> = {
  UA: { type: 'airline', cpp: 1.3 },
  WN: { type: 'airline', cpp: 1.4 },
  BA: { type: 'airline', cpp: 1.3 },
  AF: { type: 'airline', cpp: 1.3 },
  KL: { type: 'airline', cpp: 1.3 },
  SQ: { type: 'airline', cpp: 1.7 },
  NH: { type: 'airline', cpp: 1.5 },
  VS: { type: 'airline', cpp: 1.5 },
  AC: { type: 'airline', cpp: 1.3 },
  EK: { type: 'airline', cpp: 1.0 },
  EY: { type: 'airline', cpp: 1.2 },
  HA: { type: 'airline', cpp: 1.0 },
  IB: { type: 'airline', cpp: 1.4 },
  EI: { type: 'airline', cpp: 1.4 },
  B6: { type: 'airline', cpp: 1.3 },
  QF: { type: 'airline', cpp: 1.4 },
  DL: { type: 'airline', cpp: 1.1 },
  AA: { type: 'airline', cpp: 1.5 },
  AS: { type: 'airline', cpp: 1.6 },
  AV: { type: 'airline', cpp: 1.4 },
  TK: { type: 'airline', cpp: 1.5 },
  CX: { type: 'airline', cpp: 1.5 },
  TP: { type: 'airline', cpp: 1.3 },
  BR: { type: 'airline', cpp: 1.4 },
  hyatt:    { type: 'hotel', cpp: 1.7 },
  wyndham:  { type: 'hotel', cpp: 0.9 },
  marriott: { type: 'hotel', cpp: 0.8 },
  choice:   { type: 'hotel', cpp: 0.6 },
  ihg:      { type: 'hotel', cpp: 0.5 },
  hilton:   { type: 'hotel', cpp: 0.5 },
};

/** Hardcoded PARTNER_CPP fallback — one flat figure per program, no cabin split. */
function lookupHardcodedCpp(partner: TransferPartnerConfig, bookingType: BookingType): number | null {
  if (bookingType === 'hotel') {
    const entry = partner.chainKey ? PARTNER_CPP[partner.chainKey] : undefined;
    return entry?.type === 'hotel' ? entry.cpp : null;
  }
  for (const code of partner.iataCodes ?? []) {
    const entry = PARTNER_CPP[code.toUpperCase()];
    if (entry?.type === 'airline') return entry.cpp;
  }
  return null;
}

/**
 * Admin-approved TPG monthly-valuations rows (trpc.portalData.listPointsValuations),
 * matched by program identity like everything else in this file. Overrides the
 * hardcoded PARTNER_CPP figure when present — see resolvePartnerCpp.
 */
export interface PointsValuationConfig {
  program: string;
  cpp: number;
}

function lookupPartnerValuationCpp(program: string, valuations: PointsValuationConfig[]): number | null {
  return valuations.find(v => sameProgram(v.program, program))?.cpp ?? null;
}

/** DB-approved valuation wins when present; hardcoded PARTNER_CPP is the fallback. Neither is cabin-specific, so this applies to every cabin uniformly. */
function resolvePartnerCpp(
  partner: TransferPartnerConfig,
  bookingType: BookingType,
  valuations: PointsValuationConfig[],
): number | null {
  return lookupPartnerValuationCpp(partner.program, valuations) ?? lookupHardcodedCpp(partner, bookingType);
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

/** Empty grouped map — the default when no DB-backed transferPartners is passed in. No static fallback: an omitted map yields zero transfer alternatives rather than leaking unapproved/hardcoded programs. */
export const EMPTY_TRANSFER_PARTNERS: Record<PortalId, TransferPartnerConfig[]> = {
  chase: [], amex: [], c1: [], bilt: [], citi: [],
};

/**
 * Seed source for the transfer_partners table only (see
 * supabase/migrations/015_transfer_partners_seed.sql). Not used at runtime —
 * the live app reads DB-approved partners via trpc.portalData.listTransferPartners,
 * see hooks/usePointsCalc.ts.
 */
export const SEED_TRANSFER_PARTNERS: Record<PortalId, TransferPartnerConfig[]> = {
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
  c1: [
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

function portalCppFor(cardId: CardId, bookingType: BookingType): number {
  const { cpp } = PORTAL_CPP[cardId];
  return typeof cpp === 'number' ? cpp : cpp[bookingType];
}

/** Best card first: better rate wins, then the card whose portal redeems highest. */
function byCardQuality(bookingType: BookingType) {
  return (a: TransferSourceCard, b: TransferSourceCard) =>
    b.multiplier - a.multiplier ||
    portalCppFor(b.cardId, bookingType) - portalCppFor(a.cardId, bookingType);
}

/** Owned issuers first, then by the best rate behind them, then by portal value. */
function byIssuerQuality(bookingType: BookingType) {
  return (a: TransferSourceIssuer, b: TransferSourceIssuer) =>
    Number(b.owned) - Number(a.owned) ||
    b.best.multiplier - a.best.multiplier ||
    portalCppFor(b.best.cardId, bookingType) - portalCppFor(a.best.cardId, bookingType);
}

/** The config on `portalId` that reaches this exact program, if any. */
function partnerConfigFor(
  portalId: PortalId,
  partnerProgram: string,
  expectedPartnerType: 'hotel' | 'airline',
  chainKey: string | null,
  filterIata: string | null,
  partnersMap: Record<PortalId, TransferPartnerConfig[]>,
): TransferPartnerConfig | undefined {
  return (partnersMap[portalId] ?? []).find(p => {
    // Matched on program identity, not on an exact string: each issuer spells
    // the same program its own way.
    if (p.type !== expectedPartnerType || !sameProgram(p.program, partnerProgram)) return false;
    if (expectedPartnerType === 'hotel' && chainKey !== null && p.chainKey !== chainKey) return false;
    if (expectedPartnerType === 'airline' && filterIata != null && !p.iataCodes?.includes(filterIata.toUpperCase())) return false;
    return true;
  });
}

function toSourceCard(cardId: CardId, ratio: string): TransferSourceCard {
  const cardName = CARD_NAMES[cardId];
  const parsed = parseTransferRatio(ratio, cardName);
  return { cardId, cardName, multiplier: parsed.multiplier, ratioLabel: parsed.label };
}

/**
 * Every issuer that reaches this program, with the cards behind each one.
 *
 * An issuer the user holds lists only their own cards, because those are the
 * rates they can act on today; an issuer they don't hold lists everything it
 * offers, so the chip can advertise its best rate and show the full breakdown.
 * Rates resolve per card — a single issuer can publish different ratios for
 * different cards in its lineup.
 */
function findSourceIssuers(
  partnerProgram: string,
  expectedPartnerType: 'hotel' | 'airline',
  chainKey: string | null,
  filterIata: string | null,
  ownedCards: CardId[],
  bookingType: BookingType,
  partnersMap: Record<PortalId, TransferPartnerConfig[]>,
): TransferSourceIssuer[] {
  const ownedByPortal = new Map<PortalId, CardId[]>();
  for (const cardId of ownedCards) {
    const portalId = CARD_PORTAL_MAP[cardId];
    if (!portalId) continue;
    const bucket = ownedByPortal.get(portalId);
    if (bucket) { if (!bucket.includes(cardId)) bucket.push(cardId); }
    else ownedByPortal.set(portalId, [cardId]);
  }

  const issuers: TransferSourceIssuer[] = [];
  for (const portalId of Object.keys(partnersMap) as PortalId[]) {
    const partner = partnerConfigFor(portalId, partnerProgram, expectedPartnerType, chainKey, filterIata, partnersMap);
    if (!partner) continue;

    const owned = ownedByPortal.get(portalId) ?? [];
    const cardIds = owned.length > 0 ? owned : ISSUER_CARDS[portalId] ?? [];
    const cards = cardIds
      .map(cardId => toSourceCard(cardId, partner.ratio))
      .sort(byCardQuality(bookingType));
    if (cards.length === 0) continue;

    issuers.push({ portalId, owned: owned.length > 0, cards, best: cards[0], ratio: partner.ratio });
  }
  return issuers.sort(byIssuerQuality(bookingType));
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
  /** DB-backed partner map (trpc.portalData.listTransferPartners) — omitted yields no transfer alternatives, never a hardcoded fallback. */
  transferPartners: Record<PortalId, TransferPartnerConfig[]> = EMPTY_TRANSFER_PARTNERS,
  /** Admin-approved TPG valuations (trpc.portalData.listPointsValuations) — overrides PARTNER_CPP's economy/hotel figures when a program matches; omitted falls back to the hardcoded table entirely. */
  pointsValuations: PointsValuationConfig[] = [],
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

      let note: string;

      // PARTNER_CPP values the *partner's* currency. Keep that value
      // unscaled here and denominate it in source points once the representative
      // card is known — the ratio is a per-card property, so scaling it against
      // this portal's default card would misprice a row the user reaches with a
      // different card in the same lineup.
      const partnerCpp = resolvePartnerCpp(partner, bookingType, pointsValuations);

      const ratioLabel = parseTransferRatio(partner.ratio, CARD_NAMES[sourceCardId]).label;

      if (bookingType === 'hotel') {
        const chainNote = HOTEL_CHAIN_NOTES[partner.chainKey ?? ''] ?? 'Award pricing varies — check program award chart';
        note = partnerCpp !== null
          ? `Est. using ${partner.program}'s typical ${partnerCpp}¢/pt award value${ratioLabel !== '1:1' ? ` at a ${ratioLabel} transfer` : ''} — ${chainNote.charAt(0).toLowerCase()}${chainNote.slice(1)}`
          : chainNote;
      } else {
        note = partnerCpp !== null
          ? `Est. using ${partner.program}'s typical ${partnerCpp}¢/pt value${ratioLabel !== '1:1' ? ` at a ${ratioLabel} transfer` : ''} — actual award pricing varies`
          : 'Award pricing varies by route and availability — check the partner program\'s award chart';
      }

      results.push({
        partnerProgram: partner.program,
        partnerType: partner.type,
        sourceCardId,
        sourcePortalId: portalId,
        transferRatio: partner.ratio,
        partnerCpp,
        // Filled in below, once the representative card is settled.
        estimatedPointsNeeded: null,
        estimatedCentsPerPoint: null,
        transferCpp: null,
        note,
        isBetterThanPortal: false,
        estimated: true,
        routeType: bookingType === 'flight' ? routeType : undefined,
        cabin: bookingType === 'flight' ? cabin : undefined,
        sourceIssuers: [],
      });
    }
  }

  // Deduplicate by normalized partnerProgram — same real-world loyalty program
  // appears in multiple portals, sometimes under a different scraped name
  // (e.g. BA Avios is a Chase, Amex, Capital One, and Bilt partner; Capital
  // One lists "TAP Air Portugal Miles&Go" while Bilt's source names it
  // "TAP Miles&Go" — same program). Group first, then pick which route to show
  // once the user's own cards are known.
  // Clustered across the whole batch rather than keyed name by name: issuers
  // spell one program several ways ("British Airways Club" on Capital One vs
  // "British Airways Executive Club" on Chase), and an exact key left those as
  // separate rows — one owned, one not — for the same transfer.
  const clusterKeys = clusterProgramNames(results.map(r => r.partnerProgram));
  const grouped = new Map<string, TransferResult[]>();
  for (const r of results) {
    const key = clusterKeys.get(r.partnerProgram) ?? normalizeProgramName(r.partnerProgram);
    const bucket = grouped.get(key);
    if (bucket) bucket.push(r);
    else grouped.set(key, [r]);
  }

  const deduped: TransferResult[] = [];
  for (const routes of grouped.values()) {
    // Every issuer behind this program, owned ones first. Ranking on the user's
    // own wallet — not on whichever issuer happens to redeem highest — is what
    // keeps a row from advertising an issuer they don't hold while one they do
    // sits in the same list.
    const sourceIssuers = findSourceIssuers(
      routes[0].partnerProgram, expectedPartnerType, chainKey, filterIata, ownedCards, bookingType, transferPartners,
    );
    const lead = sourceIssuers[0];
    const rep = (lead && routes.find(r => r.sourcePortalId === lead.portalId)) ?? routes[0];

    rep.sourceIssuers = sourceIssuers;
    if (lead) {
      // The row speaks for one card: the user's best on an owned issuer, or the
      // best on the leading issuer when they hold none.
      rep.sourceCardId = lead.best.cardId;
      rep.sourcePortalId = lead.portalId;
      rep.transferRatio = lead.ratio;

      if (rep.partnerCpp !== null) {
        // Display rate: still computed and kept on the row (transferCpp/
        // estimatedCentsPerPoint feed rowView.ts's bonus-adjusted display and
        // rankOptions.ts's sort) — but it is NOT used to decide the
        // recommendation below, which instead compares point counts directly
        // in two explicit currency stages.
        const sourceCpp = Math.round(rep.partnerCpp * lead.best.multiplier * 100) / 100;
        rep.transferCpp = sourceCpp;
        rep.estimatedCentsPerPoint = sourceCpp;

        // Step 1 — cost of the trip in the PARTNER's own points (priceUsd is
        // the raw retail price; transferring bypasses the bank's own portal
        // markup entirely, so it's priced off retail, not portalPrice).
        const partnerPointsNeeded = rep.partnerCpp > 0
          ? Math.ceil(priceUsd / (rep.partnerCpp / 100))
          : null;

        // Step 2 — convert to the SOURCE card's points via the transfer ratio.
        // rep.partnerCpp is priced in the partner's point (e.g. Hyatt), not the
        // source card's point (e.g. Chase UR) — this conversion is required,
        // not optional, or the two currencies get silently mixed.
        rep.estimatedPointsNeeded =
          partnerPointsNeeded !== null && lead.best.multiplier > 0
            ? Math.ceil(partnerPointsNeeded / lead.best.multiplier)
            : null;

        // Both sides now the same currency (source-card points) — compare directly.
        rep.isBetterThanPortal =
          rep.estimatedPointsNeeded !== null && rep.estimatedPointsNeeded < bestPortalResult.pointsNeeded;
      }
    }
    deduped.push(rep);
  }

  // isBetterThanPortal: true results first
  return deduped.sort(
    (a, b) => Number(b.isBetterThanPortal) - Number(a.isBetterThanPortal),
  );
}
