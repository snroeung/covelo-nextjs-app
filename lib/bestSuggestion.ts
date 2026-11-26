export interface Suggestion {
  placeId: string;
  description: string;
}

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');

/** "Philadelphia International Airport (PHL), Philadelphia, PA" → "philadelphia international airport" */
function primaryName(description: string): string {
  return norm(description.split(',')[0]).replace(/\s*\([a-z]{3}\)$/, '');
}

/**
 * The suggestion to auto-select when the user submits without picking one: an exact match
 * for what they typed if there is one, otherwise the closest — the top-ranked suggestion,
 * since autocomplete already orders by relevance.
 *
 * "Exact" means the typed text equals the full description, its primary name ("Paris" ↔
 * "Paris, France"), or — for airports — its IATA code ("phl" ↔ "… (PHL), …").
 */
export function pickBestSuggestion<T extends Suggestion>(
  text: string,
  suggestions: T[],
  forAirport = false,
): T | null {
  const q = norm(text);
  if (!q || suggestions.length === 0) return null;

  const exact = suggestions.find((s) => {
    if (norm(s.description) === q || primaryName(s.description) === q) return true;
    if (forAirport) {
      const iata = s.description.match(/\(([A-Z]{3})\)/)?.[1];
      if (iata && iata.toLowerCase() === q) return true;
    }
    return false;
  });

  return exact ?? suggestions[0];
}
