import type { NormalizedHBHotel } from "@/lib/adapters/hotelbeds-adapter";
import { tokenize, jaccardSimilarity } from "@/lib/textMatch";

interface DuffelAccommodation {
  id: string;
  name: string;
  location: {
    geographic_coordinates: { latitude: number; longitude: number } | null;
  };
}

interface DuffelSearchResult {
  accommodation: DuffelAccommodation;
}

const EARTH_RADIUS_M = 6_371_000;

export function haversineMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return EARTH_RADIUS_M * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export type PortalPriceEntry = { amex: number; citi: number };

export function matchHotels(
  duffelResults: DuffelSearchResult[],
  hbHotels: NormalizedHBHotel[],
): Map<string, PortalPriceEntry> {
  const result = new Map<string, PortalPriceEntry>();

  const hbWithCoords = hbHotels.filter((h) => h.lat !== null && h.lng !== null);

  for (const sr of duffelResults) {
    const coords = sr.accommodation.location.geographic_coordinates;
    if (!coords) continue;

    const { latitude: dLat, longitude: dLng } = coords;
    const dTokens = tokenize(sr.accommodation.name ?? '');

    let bestMatch: NormalizedHBHotel | null = null;
    let bestScore = -1;

    for (const hb of hbWithCoords) {
      const distM = haversineMeters(dLat, dLng, hb.lat!, hb.lng!);
      if (distM > 150) continue;

      const nameSim = jaccardSimilarity(dTokens, tokenize(hb.name));
      if (nameSim < 0.8) continue;

      // Combined score: weight name similarity more, distance just qualifies
      const score = nameSim - distM / 10_000;
      if (score > bestScore) {
        bestScore = score;
        bestMatch = hb;
      }
    }

    if (bestMatch) {
      result.set(sr.accommodation.id, {
        amex: bestMatch.lowestRateUsd,
        citi: bestMatch.lowestRateUsd,
      });
    }
  }

  return result;
}
