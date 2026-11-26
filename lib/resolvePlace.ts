import { trpc } from '@/lib/trpc-client';
import type { LocationSearchHandle, SelectedPlace } from '@/components/inputs/LocationSearch';

export type ResolvedLocation =
  | { kind: 'place'; place: SelectedPlace }
  | { kind: 'no-match' }      // services answered and nothing matched → the one inline/"search failed" case
  | { kind: 'unavailable' };  // no service could answer → the page-top banner covers it, show nothing inline

const IATA = /^[A-Za-z]{3}$/;

/** A field is ready to search with: airports need a code, places need real coordinates. */
export function isResolved(place: SelectedPlace | null, forAirport: boolean): place is SelectedPlace {
  if (!place) return false;
  return forAirport ? !!place.iataCode : place.latitude !== 0 || place.longitude !== 0;
}

function codePlace(code: string): SelectedPlace {
  const c = code.toUpperCase();
  return { latitude: 0, longitude: 0, name: c, description: c, iataCode: c };
}

/**
 * Resolve a search field when the user presses Search:
 * 1. a suggestion they picked → use it;
 * 2. otherwise auto-select a suggestion for the typed text — the exact match, else the
 *    closest — via the field's commitBestMatch();
 * 3. only if autocomplete is unavailable → fall back to the typed 3-letter code (airports)
 *    or a Mapbox geocode (places).
 */
export async function resolvePlace({ picked, text, field, forAirport }: {
  picked: SelectedPlace | null;
  text: string;
  field: LocationSearchHandle | null;
  forAirport: boolean;
}): Promise<ResolvedLocation> {
  if (isResolved(picked, forAirport)) return { kind: 'place', place: picked };

  const typed = text.trim();
  if (typed.length < 2) return { kind: 'no-match' };

  const best = field ? await field.commitBestMatch() : ({ status: 'unavailable' } as const);

  if (best.status === 'picked' && isResolved(best.place, forAirport)) {
    return { kind: 'place', place: best.place };
  }

  if (best.status !== 'unavailable') {
    // Autocomplete answered but nothing usable. A typed code still counts for airports
    // (e.g. a small airport autocomplete doesn't list).
    if (forAirport && IATA.test(typed)) return { kind: 'place', place: codePlace(typed) };
    return { kind: 'no-match' };
  }

  // Autocomplete is down → fallbacks.
  if (forAirport) {
    return IATA.test(typed) ? { kind: 'place', place: codePlace(typed) } : { kind: 'unavailable' };
  }
  try {
    const r = await trpc.places.geocode.query({ query: typed });
    return r ? { kind: 'place', place: { ...r, description: r.name } } : { kind: 'no-match' };
  } catch {
    return { kind: 'unavailable' };
  }
}
