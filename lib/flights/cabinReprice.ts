export interface FlightSearchVars {
  origin: string;
  destination: string;
  departureDate: string;
  returnDate?: string;
  passengers: number;
  cabinClass: string;
}

/**
 * True when `next` is the same search as `prev` with only the cabin changed. Duffel prices per
 * cabin, so a cabin switch re-runs the search; the previous itineraries are still the right rows
 * and can stay on screen while fares are re-priced.
 */
export function isCabinOnlyChange(prev: FlightSearchVars | null | undefined, next: FlightSearchVars | null | undefined): boolean {
  if (!prev || !next) return false;
  return (
    prev.cabinClass !== next.cabinClass &&
    prev.origin === next.origin &&
    prev.destination === next.destination &&
    prev.departureDate === next.departureDate &&
    prev.returnDate === next.returnDate &&
    prev.passengers === next.passengers
  );
}
