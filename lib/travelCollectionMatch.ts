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
  slices: { segments: { origin: { iata_code: string | null }; destination: { iata_code: string | null } }[] }[];
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

/** No end_date means open-ended; otherwise the collection must still cover the search date. */
function isLiveForSearch(c: TravelCollection, searchDate: string): boolean {
  return !c.end_date || new Date(c.end_date).getTime() >= new Date(searchDate).getTime();
}

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
  searchDate: string,
): Map<string, CollectionMatchEntry> {
  const result = new Map<string, CollectionMatchEntry>();

  // 'admin' rows are published directly by an admin (no cron review needed) —
  // same visibility rule as listTravelCollections/listTransferPartners, which
  // already treat admin+approved as publicly visible.
  const candidates = collections.filter(
    (c) =>
      c.type === "hotel" &&
      c.property_name &&
      (c.status === "approved" || c.status === "admin") &&
      isLiveForSearch(c, searchDate),
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
  searchDate: string,
): Map<string, CollectionMatchEntry> {
  const result = new Map<string, CollectionMatchEntry>();

  // 'admin' rows are published directly by an admin (no cron review needed) —
  // same visibility rule as listTravelCollections/listTransferPartners, which
  // already treat admin+approved as publicly visible.
  const candidates = collections.filter(
    (c) =>
      c.type === "flight" &&
      (c.status === "approved" || c.status === "admin") &&
      isLiveForSearch(c, searchDate),
  );

  for (const offer of offers) {
    const firstSlice = offer.slices[0];
    const originIata = firstSlice?.segments[0]?.origin?.iata_code ?? null;
    const destIata = firstSlice?.segments[firstSlice.segments.length - 1]?.destination?.iata_code ?? null;

    // A null origin/destination on the collection is a wildcard for that field —
    // preserves airline-only matching for rows that haven't been given a route yet.
    const match = candidates.find(
      (c) =>
        c.airline_iata_code === offer.owner.iata_code &&
        (c.origin_iata_code === null || c.origin_iata_code === originIata) &&
        (c.destination_iata_code === null || c.destination_iata_code === destIata),
    );
    if (match) {
      result.set(offer.id, toMatchEntry(match));
    }
  }

  return result;
}
