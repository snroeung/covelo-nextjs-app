import type { TravelCollection } from "@/lib/types/portalData";
import { tokenize, jaccardSimilarity } from "@/lib/textMatch";

interface DuffelAccommodation {
  id: string;
  name: string;
}

interface DuffelSearchResult {
  accommodation: DuffelAccommodation;
}

interface FlightOffer {
  id: string;
  owner: { iata_code: string | null };
}

export type CollectionMatchEntry = {
  collection_name: string;
  issuer: TravelCollection["issuer"];
  perk_summary: string;
  source_url: string | null;
  original_amount: number | null;
  original_unit: TravelCollection["original_unit"];
  discount_amount: number | null;
  discount_unit: TravelCollection["discount_unit"];
  limited_time_offer: boolean;
};

const MATCH_THRESHOLD = 0.7;

function toMatchEntry(c: TravelCollection): CollectionMatchEntry {
  return {
    collection_name: c.collection_name,
    issuer: c.issuer,
    perk_summary: c.perk_summary,
    source_url: c.source_url,
    original_amount: c.original_amount,
    original_unit: c.original_unit,
    discount_amount: c.discount_amount,
    discount_unit: c.discount_unit,
    limited_time_offer: c.limited_time_offer,
  };
}

export function matchHotelCollections(
  duffelResults: DuffelSearchResult[],
  collections: TravelCollection[],
): Map<string, CollectionMatchEntry> {
  const result = new Map<string, CollectionMatchEntry>();

  // 'admin' rows are published directly by an admin (no cron review needed) —
  // same visibility rule as listTravelCollections/listTransferPartners, which
  // already treat admin+approved as publicly visible.
  const candidates = collections.filter(
    (c) => c.type === "hotel" && c.property_name && (c.status === "approved" || c.status === "admin"),
  );

  for (const sr of duffelResults) {
    const dTokens = tokenize(sr.accommodation.name ?? "");

    let bestMatch: TravelCollection | null = null;
    let bestScore = -1;

    for (const c of candidates) {
      const score = jaccardSimilarity(dTokens, tokenize(c.property_name));
      if (score < MATCH_THRESHOLD) continue;
      if (score > bestScore) {
        bestScore = score;
        bestMatch = c;
      }
    }

    if (bestMatch) {
      result.set(sr.accommodation.id, toMatchEntry(bestMatch));
    }
  }

  return result;
}

export function matchFlightCollections(
  offers: FlightOffer[],
  collections: TravelCollection[],
): Map<string, CollectionMatchEntry> {
  const result = new Map<string, CollectionMatchEntry>();

  // 'admin' rows are published directly by an admin (no cron review needed) —
  // same visibility rule as listTravelCollections/listTransferPartners, which
  // already treat admin+approved as publicly visible.
  const candidates = collections.filter(
    (c) => c.type === "flight" && (c.status === "approved" || c.status === "admin"),
  );

  for (const offer of offers) {
    const match = candidates.find((c) => c.airline_iata_code === offer.owner.iata_code);
    if (match) {
      result.set(offer.id, toMatchEntry(match));
    }
  }

  return result;
}
