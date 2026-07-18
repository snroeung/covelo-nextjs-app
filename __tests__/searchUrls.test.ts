import { describe, it, expect } from 'vitest';
import {
  buildFlightSearchUrl,
  buildHotelSearchUrl,
  isFlightSearchValid,
  isHotelSearchValid,
  type FlightSearchValues,
  type HotelSearchValues,
} from '@/lib/searchUrls';

const TODAY = '2026-07-07';

const flight: FlightSearchValues = {
  originCode: 'JFK',
  originName: 'New York · JFK',
  destinationCode: 'PHL',
  destinationName: 'Philadelphia · PHL',
  departDate: '2026-07-28',
  returnDate: '2026-07-31',
  tripType: 'roundtrip',
};

const hotel: HotelSearchValues = {
  destinationName: 'Philadelphia, PA',
  latitude: 39.9526,
  longitude: -75.1652,
  checkIn: '2026-07-28',
  checkOut: '2026-07-31',
  rooms: 2,
  adults: 2,
  children: 1,
};

describe('buildFlightSearchUrl', () => {
  it('encodes a round-trip with origin + destination codes', () => {
    const url = buildFlightSearchUrl(flight);
    const q = new URLSearchParams(url.split('?')[1]);
    expect(url.startsWith('/flights?')).toBe(true);
    expect(q.get('origin')).toBe('JFK');
    expect(q.get('destinationCode')).toBe('PHL');
    expect(q.get('destination')).toBe('Philadelphia · PHL');
    expect(q.get('departDate')).toBe('2026-07-28');
    expect(q.get('returnDate')).toBe('2026-07-31');
    expect(q.get('tripType')).toBe('roundtrip');
  });

  it('omits returnDate for one-way', () => {
    const url = buildFlightSearchUrl({ ...flight, tripType: 'oneway' });
    const q = new URLSearchParams(url.split('?')[1]);
    expect(q.has('returnDate')).toBe(false);
    expect(q.get('tripType')).toBe('oneway');
  });
});

describe('buildHotelSearchUrl', () => {
  it('encodes the full hotel contract', () => {
    const url = buildHotelSearchUrl(hotel);
    const q = new URLSearchParams(url.split('?')[1]);
    expect(url.startsWith('/hotels?')).toBe(true);
    expect(q.get('lat')).toBe('39.9526');
    expect(q.get('lng')).toBe('-75.1652');
    expect(q.get('checkIn')).toBe('2026-07-28');
    expect(q.get('checkOut')).toBe('2026-07-31');
    expect(q.get('rooms')).toBe('2');
    expect(q.get('adults')).toBe('2');
    expect(q.get('children')).toBe('1');
  });
});

describe('isFlightSearchValid', () => {
  it('accepts a complete round-trip', () => {
    expect(isFlightSearchValid(flight, TODAY)).toBe(true);
  });
  it('rejects a non-IATA origin', () => {
    expect(isFlightSearchValid({ ...flight, originCode: 'NEWYORK' }, TODAY)).toBe(false);
  });
  it('rejects a return before departure', () => {
    expect(isFlightSearchValid({ ...flight, returnDate: '2026-07-27' }, TODAY)).toBe(false);
  });
  it('accepts one-way without a return date', () => {
    expect(isFlightSearchValid({ ...flight, tripType: 'oneway', returnDate: '' }, TODAY)).toBe(true);
  });
  it('rejects a depart date in the past', () => {
    expect(isFlightSearchValid({ ...flight, departDate: '2026-07-01' }, TODAY)).toBe(false);
  });
});

describe('isHotelSearchValid', () => {
  it('accepts a complete stay', () => {
    expect(isHotelSearchValid(hotel, TODAY)).toBe(true);
  });
  it('rejects a missing location (0,0)', () => {
    expect(isHotelSearchValid({ ...hotel, latitude: 0, longitude: 0 }, TODAY)).toBe(false);
  });
  it('rejects checkout on/before checkin', () => {
    expect(isHotelSearchValid({ ...hotel, checkOut: '2026-07-28' }, TODAY)).toBe(false);
  });
});
