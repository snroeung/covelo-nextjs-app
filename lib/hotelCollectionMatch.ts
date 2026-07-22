import type { HotelCollection } from "@/lib/types/portalData";
import { tokenize, jaccardSimilarity } from "@/lib/textMatch";

interface DuffelAccommodation {
  id: string;
  name: string;
}

interface DuffelSearchResult {
  accommodation: DuffelAccommodation;
}

export type CollectionMatchEntry = {
  collection_name: string;
  issuer: HotelCollection["issuer"];
  perk_summary: string;
  source_url: string | null;
};

const MATCH_THRESHOLD = 0.7;

export function matchHotelCollections(
  duffelResults: DuffelSearchResult[],
  collections: HotelCollection[],
): Map<string, CollectionMatchEntry> {
  const result = new Map<string, CollectionMatchEntry>();

  const candidates = collections.filter((c) => c.property_name && c.status === "approved");

  for (const sr of duffelResults) {
    const dTokens = tokenize(sr.accommodation.name ?? "");

    let bestMatch: HotelCollection | null = null;
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
      result.set(sr.accommodation.id, {
        collection_name: bestMatch.collection_name,
        issuer: bestMatch.issuer,
        perk_summary: bestMatch.perk_summary,
        source_url: bestMatch.source_url,
      });
    }
  }

  return result;
}
