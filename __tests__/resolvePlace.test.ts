import { vi, beforeEach, describe, it, expect, type Mock } from 'vitest';

vi.mock('@/lib/trpc-client', () => ({
  trpc: { places: { geocode: { query: vi.fn() } } },
}));

import { trpc } from '@/lib/trpc-client';
import { resolvePlace, isResolved } from '@/lib/resolvePlace';
import type { BestMatchResult, LocationSearchHandle, SelectedPlace } from '@/components/inputs/LocationSearch';

const geocode = trpc.places.geocode.query as unknown as Mock;

const PARIS: SelectedPlace = { latitude: 48.8566, longitude: 2.3522, name: 'Paris', description: 'Paris, France' };
const BOS: SelectedPlace = { latitude: 42.36, longitude: -71.01, name: 'Logan', description: 'Boston Logan (BOS)', iataCode: 'BOS' };

const field = (result: BestMatchResult): LocationSearchHandle & { commitBestMatch: Mock } => ({
  commitBestMatch: vi.fn().mockResolvedValue(result),
});

describe('isResolved', () => {
  it('needs coordinates for places and a code for airports', () => {
    expect(isResolved(PARIS, false)).toBe(true);
    expect(isResolved({ ...PARIS, latitude: 0, longitude: 0 }, false)).toBe(false);
    expect(isResolved(BOS, true)).toBe(true);
    expect(isResolved({ ...BOS, iataCode: undefined }, true)).toBe(false);
    expect(isResolved(null, false)).toBe(false);
  });
});

describe('resolvePlace', () => {
  beforeEach(() => vi.clearAllMocks());

  it('uses a picked place without auto-selecting or geocoding', async () => {
    const f = field({ status: 'no-suggestions' });
    expect(await resolvePlace({ picked: PARIS, text: 'Paris', field: f, forAirport: false })).toEqual({ kind: 'place', place: PARIS });
    expect(f.commitBestMatch).not.toHaveBeenCalled();
    expect(geocode).not.toHaveBeenCalled();
  });

  it('auto-selects the best suggestion when nothing was picked', async () => {
    const f = field({ status: 'picked', place: PARIS });
    expect(await resolvePlace({ picked: null, text: 'Pari', field: f, forAirport: false })).toEqual({ kind: 'place', place: PARIS });
    expect(geocode).not.toHaveBeenCalled(); // Mapbox only runs when autocomplete is down
  });

  it('is a no-match when autocomplete answers with nothing (no geocode)', async () => {
    const f = field({ status: 'no-suggestions' });
    expect(await resolvePlace({ picked: null, text: 'Nowhereville', field: f, forAirport: false })).toEqual({ kind: 'no-match' });
    expect(geocode).not.toHaveBeenCalled();
  });

  it('falls back to a Mapbox geocode only when autocomplete is down', async () => {
    geocode.mockResolvedValue({ latitude: 48.8566, longitude: 2.3522, name: 'Paris' });
    const f = field({ status: 'unavailable' });
    const r = await resolvePlace({ picked: null, text: 'Paris', field: f, forAirport: false });
    expect(r).toEqual({ kind: 'place', place: { latitude: 48.8566, longitude: 2.3522, name: 'Paris', description: 'Paris' } });
  });

  it('is a no-match when the fallback geocode finds nothing', async () => {
    geocode.mockResolvedValue(null);
    const r = await resolvePlace({ picked: null, text: 'Nowhereville', field: field({ status: 'unavailable' }), forAirport: false });
    expect(r).toEqual({ kind: 'no-match' });
  });

  it('is unavailable (silent) when the fallback geocode errors too', async () => {
    geocode.mockRejectedValue(new Error('mapbox down'));
    const r = await resolvePlace({ picked: null, text: 'Paris', field: field({ status: 'unavailable' }), forAirport: false });
    expect(r).toEqual({ kind: 'unavailable' });
  });

  it('airports: auto-selects the best suggestion', async () => {
    const r = await resolvePlace({ picked: null, text: 'Boston', field: field({ status: 'picked', place: BOS }), forAirport: true });
    expect(r).toEqual({ kind: 'place', place: BOS });
  });

  it('airports: falls back to a typed 3-letter code when autocomplete is down', async () => {
    const r = await resolvePlace({ picked: null, text: 'sfo', field: field({ status: 'unavailable' }), forAirport: true });
    expect(r).toEqual({ kind: 'place', place: { latitude: 0, longitude: 0, name: 'SFO', description: 'SFO', iataCode: 'SFO' } });
  });

  it('airports: a typed code still counts when autocomplete has no suggestions', async () => {
    const r = await resolvePlace({ picked: null, text: 'XYZ', field: field({ status: 'no-suggestions' }), forAirport: true });
    expect(r).toEqual({ kind: 'place', place: { latitude: 0, longitude: 0, name: 'XYZ', description: 'XYZ', iataCode: 'XYZ' } });
  });

  it('airports: a non-code with autocomplete down is unavailable (banner), not a no-match', async () => {
    const r = await resolvePlace({ picked: null, text: 'Philadelphia', field: field({ status: 'unavailable' }), forAirport: true });
    expect(r).toEqual({ kind: 'unavailable' });
  });

  it('text under 2 characters is a no-match', async () => {
    expect(await resolvePlace({ picked: null, text: 'P', field: field({ status: 'unavailable' }), forAirport: false })).toEqual({ kind: 'no-match' });
  });
});
