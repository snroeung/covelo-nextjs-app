import type { HotelBedsHotel, HotelBedsSearchResponse } from "@/lib/hotelbeds";

// TODO: Hardcoded rates vs USD — replace with live FX lookup when ready
const FX_TO_USD: Record<string, number> = {
  EUR: 1.08,
  GBP: 1.27,
  CAD: 0.73,
  AUD: 0.65,
  JPY: 0.0067,
};

function toUsd(amount: number, currency: string): number {
  if (currency === "USD") return amount;
  const rate = FX_TO_USD[currency.toUpperCase()];
  return rate ? amount * rate : amount;
}

export interface NormalizedHBHotel {
  hbId: number;
  name: string;
  lat: number | null;
  lng: number | null;
  lowestRateUsd: number;
  currency: string;
}

export function adaptHotelBedsHotel(
  hotel: HotelBedsHotel,
  responseCurrency: string,
): NormalizedHBHotel | null {
  const currency = hotel.currency ?? responseCurrency;

  let lowestRate: number | null = null;

  if (hotel.minRate) {
    const parsed = parseFloat(hotel.minRate);
    if (!isNaN(parsed) && parsed > 0) lowestRate = parsed;
  }

  if (lowestRate === null && hotel.rooms) {
    for (const room of hotel.rooms) {
      for (const rate of room.rates ?? []) {
        const parsed = parseFloat(rate.net);
        if (!isNaN(parsed) && parsed > 0) {
          if (lowestRate === null || parsed < lowestRate) lowestRate = parsed;
        }
      }
    }
  }

  if (lowestRate === null) return null;

  const lat = hotel.latitude ? parseFloat(hotel.latitude) : null;
  const lng = hotel.longitude ? parseFloat(hotel.longitude) : null;

  return {
    hbId: hotel.code,
    name: hotel.name ?? '',
    lat: isNaN(lat as number) ? null : lat,
    lng: isNaN(lng as number) ? null : lng,
    lowestRateUsd: toUsd(lowestRate, currency),
    currency: "USD",
  };
}

export function adaptHotelBedsResults(response: HotelBedsSearchResponse): NormalizedHBHotel[] {
  const hotels = response.hotels?.hotels ?? [];
  const currency = response.hotels?.currency ?? "USD";
  return hotels.flatMap((h) => {
    const adapted = adaptHotelBedsHotel(h, currency);
    return adapted ? [adapted] : [];
  });
}
