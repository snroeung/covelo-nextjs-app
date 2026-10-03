/**
 * Stable identity for "the thing being reported on", shared by every traveller
 * who searches the same itinerary or room. Duffel offer ids are per-search and
 * expire, so they can't be the key — the route, dates and flight numbers can.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function flightSubjectKey(offer: any): string {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const slices = (offer?.slices ?? []) as any[];
  return slices.map(slice => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const segs = (slice?.segments ?? []) as any[];
    const first = segs[0];
    const last = segs[segs.length - 1];
    const date = String(first?.departing_at ?? '').slice(0, 10);
    const flights = segs
      .map(s => `${s?.marketing_carrier?.iata_code ?? ''}${s?.marketing_carrier_flight_number ?? ''}`)
      .join('+');
    return [first?.origin?.iata_code ?? '', last?.destination?.iata_code ?? '', date, flights]
      .join('-')
      .toUpperCase();
  }).join('|');
}

export function hotelSubjectKey(hotelId: string, roomName: string, checkIn: string, checkOut: string): string {
  const room = roomName.trim().toLowerCase().replace(/\s+/g, ' ');
  return [hotelId, room, checkIn.slice(0, 10), checkOut.slice(0, 10)].join('|');
}

/** First / last departure dates of an offer as YYYY-MM-DD; end null for one-way. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function flightQuoteDates(offer: any): { start: string; end: string | null } {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const slices = (offer?.slices ?? []) as any[];
  const start = String(slices[0]?.segments?.[0]?.departing_at ?? '').slice(0, 10);
  const end = slices.length > 1
    ? String(slices[slices.length - 1]?.segments?.[0]?.departing_at ?? '').slice(0, 10)
    : null;
  return { start, end };
}
