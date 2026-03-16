import {
  CardId,
  PortalId,
  BookingType,
  PortalResult,
  TransferResult,
  CARD_PORTAL_MAP,
} from './types';

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

export function calcTransferAlternatives(
  priceUsd: number,
  bookingType: BookingType,
  userCards: CardId[],
  bestPortalResult: PortalResult,
  hotelChain?: string | null,
  airlineIata?: string | null
): TransferResult[] {
  // Collect unique portals the user has access to, mapped to their best card per portal
  const portalCardMap = new Map<PortalId, CardId>();
  for (const cardId of userCards) {
    const portalId = CARD_PORTAL_MAP[cardId];
    if (portalId && !portalCardMap.has(portalId)) {
      portalCardMap.set(portalId, cardId);
    }
  }

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
      if (bookingType === 'flight' && airlineIata !== null && airlineIata !== undefined) {
        if (!partner.iataCodes?.includes(airlineIata.toUpperCase())) continue;
      }

      let estimatedPointsNeeded: number | null = null;
      let estimatedCentsPerPoint: number | null = null;
      let note: string;

      if (bookingType === 'hotel') {
        note = HOTEL_CHAIN_NOTES[partner.chainKey ?? ''] ?? 'Award pricing varies — check program award chart';
      } else {
        // Simplified domestic economy estimate
        estimatedPointsNeeded = 20_000;
        estimatedCentsPerPoint = parseFloat(((priceUsd / estimatedPointsNeeded) * 100).toFixed(2));
        note = '~estimated based on saver award charts — actual availability varies';
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
        note,
        isBetterThanPortal,
        estimated: true,
      });
    }
  }

  // isBetterThanPortal: true results first
  return results.sort((a, b) => Number(b.isBetterThanPortal) - Number(a.isBetterThanPortal));
}
