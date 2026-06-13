import { haversineMeters, matchHotels } from '@/lib/hotelbeds-match';
import { adaptHotelBedsHotel, adaptHotelBedsResults } from '@/lib/adapters/hotelbeds-adapter';
import type { HotelBedsHotel, HotelBedsSearchResponse } from '@/lib/hotelbeds';
import type { NormalizedHBHotel } from '@/lib/adapters/hotelbeds-adapter';

// ---------------------------------------------------------------------------
// haversineMeters()
// ---------------------------------------------------------------------------

describe('haversineMeters()', () => {
  it('returns 0 for identical coordinates', () => {
    expect(haversineMeters(40.7128, -74.006, 40.7128, -74.006)).toBe(0);
  });

  it('computes ~111km per degree of latitude', () => {
    const dist = haversineMeters(0, 0, 1, 0);
    expect(dist).toBeGreaterThan(110_000);
    expect(dist).toBeLessThan(112_000);
  });

  it('returns ~157m for a very small offset', () => {
    // ~0.001° latitude ≈ 111m
    const dist = haversineMeters(40.7128, -74.006, 40.7138, -74.006);
    expect(dist).toBeGreaterThan(100);
    expect(dist).toBeLessThan(200);
  });

  it('is symmetric', () => {
    const a = haversineMeters(48.8566, 2.3522, 51.5074, -0.1278);
    const b = haversineMeters(51.5074, -0.1278, 48.8566, 2.3522);
    expect(Math.abs(a - b)).toBeLessThan(1);
  });
});

// ---------------------------------------------------------------------------
// adaptHotelBedsHotel()
// ---------------------------------------------------------------------------

describe('adaptHotelBedsHotel()', () => {
  const base: HotelBedsHotel = {
    code: 12345,
    name: 'Grand Plaza Hotel',
    latitude: '40.7128',
    longitude: '-74.0060',
    minRate: '199.50',
    currency: 'USD',
  };

  it('extracts all fields correctly', () => {
    const result = adaptHotelBedsHotel(base, 'USD');
    expect(result).not.toBeNull();
    expect(result!.hbId).toBe(12345);
    expect(result!.name).toBe('Grand Plaza Hotel');
    expect(result!.lat).toBeCloseTo(40.7128);
    expect(result!.lng).toBeCloseTo(-74.006);
    expect(result!.lowestRateUsd).toBeCloseTo(199.5);
    expect(result!.currency).toBe('USD');
  });

  it('falls back to room rates when minRate is absent', () => {
    const hotel: HotelBedsHotel = {
      ...base,
      minRate: undefined,
      rooms: [{ rates: [{ net: '220.00' }, { net: '180.00' }] }],
    };
    const result = adaptHotelBedsHotel(hotel, 'USD');
    expect(result!.lowestRateUsd).toBeCloseTo(180.0);
  });

  it('returns null when no rate is available', () => {
    const hotel: HotelBedsHotel = { ...base, minRate: undefined, rooms: [] };
    expect(adaptHotelBedsHotel(hotel, 'USD')).toBeNull();
  });

  it('converts to USD and normalizes currency field', () => {
    const hotel: HotelBedsHotel = { ...base, currency: undefined, minRate: '100.00' };
    const result = adaptHotelBedsHotel(hotel, 'EUR');
    expect(result!.currency).toBe('USD');
    expect(result!.lowestRateUsd).toBeCloseTo(108); // 100 EUR * 1.08
  });

  it('returns null coordinates when latitude/longitude are absent', () => {
    const hotel: HotelBedsHotel = { ...base, latitude: undefined, longitude: undefined };
    const result = adaptHotelBedsHotel(hotel, 'USD');
    expect(result!.lat).toBeNull();
    expect(result!.lng).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// adaptHotelBedsResults()
// ---------------------------------------------------------------------------

describe('adaptHotelBedsResults()', () => {
  it('filters out hotels with no rate', () => {
    const response: HotelBedsSearchResponse = {
      hotels: {
        currency: 'USD',
        hotels: [
          { code: 1, name: 'Hotel A', latitude: '40.0', longitude: '-74.0', minRate: '100.00' },
          { code: 2, name: 'Hotel B' }, // no rate
        ],
      },
    };
    const results = adaptHotelBedsResults(response);
    expect(results).toHaveLength(1);
    expect(results[0].hbId).toBe(1);
  });

  it('returns empty array for empty response', () => {
    expect(adaptHotelBedsResults({})).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// matchHotels()
// ---------------------------------------------------------------------------

function makeDuffelResult(id: string, name: string, lat: number, lng: number) {
  return {
    accommodation: {
      id,
      name,
      location: { geographic_coordinates: { latitude: lat, longitude: lng } },
    },
  };
}

function makeHBHotel(hbId: number, name: string, lat: number, lng: number, rate: number): NormalizedHBHotel {
  return { hbId, name, lat, lng, lowestRateUsd: rate, currency: 'USD' };
}

describe('matchHotels()', () => {
  it('matches hotels within 150m with similar names', () => {
    const duffel = [makeDuffelResult('acc_1', 'Marriott Philadelphia', 39.9526, -75.1652)];
    const hb     = [makeHBHotel(1, 'Philadelphia Marriott', 39.9527, -75.1652, 280)];

    const map = matchHotels(duffel, hb);
    expect(map.has('acc_1')).toBe(true);
    expect(map.get('acc_1')!.amex).toBeCloseTo(280);
    expect(map.get('acc_1')!.citi).toBeCloseTo(280);
  });

  it('does not match hotels > 150m apart even with identical names', () => {
    const duffel = [makeDuffelResult('acc_2', 'Grand Hyatt', 40.7128, -74.006)];
    const hb     = [makeHBHotel(2, 'Grand Hyatt', 40.8, -74.006, 350)]; // ~9.7km away

    const map = matchHotels(duffel, hb);
    expect(map.has('acc_2')).toBe(false);
  });

  it('does not match when names are too dissimilar', () => {
    const duffel = [makeDuffelResult('acc_3', 'Marriott Downtown', 39.9526, -75.1652)];
    const hb     = [makeHBHotel(3, 'Hilton Garden Inn', 39.9527, -75.1652, 200)];

    const map = matchHotels(duffel, hb);
    expect(map.has('acc_3')).toBe(false);
  });

  it('skips duffel results with no geographic_coordinates', () => {
    const duffelNoCoords = [{
      accommodation: { id: 'acc_4', name: 'Mystery Hotel', location: { geographic_coordinates: null } },
    }];
    const hb = [makeHBHotel(4, 'Mystery Hotel', 40.0, -74.0, 100)];

    const map = matchHotels(duffelNoCoords, hb);
    expect(map.size).toBe(0);
  });

  it('returns empty map when HotelBeds list is empty', () => {
    const duffel = [makeDuffelResult('acc_5', 'Some Hotel', 40.0, -74.0)];
    expect(matchHotels(duffel, [])).toEqual(new Map());
  });

  it('picks the best match when multiple HB hotels are within range', () => {
    const duffel = [makeDuffelResult('acc_6', 'Four Seasons Philadelphia', 39.9526, -75.1652)];
    const hb = [
      makeHBHotel(6, 'Philadelphia Four Seasons', 39.9527, -75.1652, 450), // very close, good name
      makeHBHotel(7, 'Four Seasons Hotel',       39.9528, -75.1652, 500), // close, decent name
    ];

    const map = matchHotels(duffel, hb);
    expect(map.has('acc_6')).toBe(true);
    // Should pick the one with better combined score (hbId 6 is closer)
    expect(map.get('acc_6')!.amex).toBeCloseTo(450);
  });
});
