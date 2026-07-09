// Pure helpers shared by the /search hub and the /flights + /hotels pages.
// Build the redirect URL contract each results page reads from `useSearchParams`,
// and validate a set of form values before enabling submit. No React, no I/O —
// keep this testable in isolation (see __tests__/searchUrls.test.ts).

export type TripType = 'roundtrip' | 'oneway';

export interface FlightSearchValues {
  originCode: string;       // IATA, e.g. "JFK"
  originName: string;       // display text, e.g. "New York · JFK"
  destinationCode: string;  // IATA, e.g. "PHL"
  destinationName: string;  // display text
  departDate: string;       // YYYY-MM-DD
  returnDate: string;       // YYYY-MM-DD, '' for one-way
  tripType: TripType;
}

export interface HotelSearchValues {
  destinationName: string;
  latitude: number;
  longitude: number;
  checkIn: string;          // YYYY-MM-DD
  checkOut: string;         // YYYY-MM-DD
  rooms: number;
  adults: number;
  children: number;
}

export function isFlightSearchValid(v: FlightSearchValues, todayStr: string): boolean {
  const okDates =
    !!v.departDate && v.departDate >= todayStr &&
    (v.tripType === 'oneway' || (!!v.returnDate && v.returnDate >= v.departDate));
  return v.originCode.length === 3 && v.destinationCode.length === 3 && okDates;
}

export function isHotelSearchValid(v: HotelSearchValues, todayStr: string): boolean {
  return (
    (v.latitude !== 0 || v.longitude !== 0) &&
    !!v.checkIn && v.checkIn >= todayStr &&
    !!v.checkOut && v.checkOut > v.checkIn
  );
}

export function buildFlightSearchUrl(v: FlightSearchValues): string {
  const p = new URLSearchParams({
    origin:          v.originCode,
    originName:      v.originName,
    destination:     v.destinationName, // legacy param kept for trip-planner deep links
    destinationCode: v.destinationCode,
    departDate:      v.departDate,
    tripType:        v.tripType,
  });
  if (v.tripType === 'roundtrip' && v.returnDate) p.set('returnDate', v.returnDate);
  return `/flights?${p.toString()}`;
}

export function buildHotelSearchUrl(v: HotelSearchValues): string {
  const p = new URLSearchParams({
    destination: v.destinationName,
    lat:         String(v.latitude),
    lng:         String(v.longitude),
    checkIn:     v.checkIn,
    checkOut:    v.checkOut,
    rooms:       String(v.rooms),
    adults:      String(v.adults),
    children:    String(v.children),
  });
  return `/hotels?${p.toString()}`;
}
