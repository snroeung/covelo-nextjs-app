import { createHash } from "crypto";

const BASE_URL =
    process.env.HOTELBEDS_URL
    || "https://api.test.hotelbeds.com/hotel-api/1.0";

function getCredentials(): { apiKey: string; apiSecret: string } {
  const apiKey = process.env.HOTELBEDS_API_KEY;
  const apiSecret = process.env.HOTELBEDS_API_SECRET;
  if (!apiKey) throw new Error("HOTELBEDS_API_KEY is not set");
  if (!apiSecret) throw new Error("HOTELBEDS_API_SECRET is not set");
  return { apiKey, apiSecret };
}

function signature(apiKey: string, apiSecret: string): string {
  const ts = Math.floor(Date.now() / 1000).toString();
  return createHash("sha256").update(apiKey + apiSecret + ts).digest("hex");
}

export interface HotelBedsSearchParams {
  checkIn: string;
  checkOut: string;
  rooms: number;
  adults: number;
  children: number;
  latitude: number;
  longitude: number;
  radiusKm?: number;
}

export interface HotelBedsRate {
  net: string;
  currency?: string;
}

export interface HotelBedsHotel {
  code: number;
  name: string;
  latitude?: string;
  longitude?: string;
  minRate?: string;
  maxRate?: string;
  currency?: string;
  rooms?: { rates?: HotelBedsRate[] }[];
}

export interface HotelBedsSearchResponse {
  hotels?: {
    hotels?: HotelBedsHotel[];
    currency?: string;
    checkIn?: string;
    checkOut?: string;
  };
}

export async function searchHotels(
  params: HotelBedsSearchParams,
): Promise<HotelBedsSearchResponse> {
  const { checkIn, checkOut, rooms, adults, children, latitude, longitude, radiusKm = 20 } = params;
  const { apiKey, apiSecret } = getCredentials();

  const body = {
    stay: { checkIn, checkOut },
    occupancies: [{ rooms, adults, children }],
    geolocation: { latitude, longitude, radius: radiusKm, unit: "km" },
    filter: { maxHotels: 100 },
  };

  const res = await fetch(`${BASE_URL}/hotels`, {
    method: "POST",
    headers: {
      "Api-key": apiKey,
      "X-Signature": signature(apiKey, apiSecret),
      "Accept": "application/json",
      "Accept-Encoding": "gzip",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HotelBeds API error ${res.status}: ${text}`);
  }

  return res.json() as Promise<HotelBedsSearchResponse>;
}
