export type HotelSource = "duffel" | "eps" | "booking";

export interface HotelModel {
  id: string;
  name: string;
  lat: number;
  lng: number;
  nightly_usd: number;
  taxes_fees: number;
  source: HotelSource;
  source_id: string;
  amenities: string[];
  images: string[];
  rating: number | null;
}

export type FlightSource = "duffel"; //duffel / eps / booking

export type CabinClass = "economy" | "premium_economy" | "business" | "first";

export interface FlightModel {
  id: string;
  airline: string;
  iata_code: string;
  origin: string;
  destination: string;
  depart_at: string; // ISO 8601
  arrive_at: string; // ISO 8601
  stops: number;
  duration_min: number;
  total_usd: number;
  cabin: CabinClass;
  source: FlightSource;
}