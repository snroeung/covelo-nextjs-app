import { describe, expect, it } from 'vitest';
import { isCabinOnlyChange, type FlightSearchVars } from '@/lib/flights/cabinReprice';

const base: FlightSearchVars = { origin: 'JFK', destination: 'PHL', departureDate: '2026-04-24', passengers: 1, cabinClass: 'economy' };

describe('isCabinOnlyChange', () => {
  it('is true when only the cabin differs', () => {
    expect(isCabinOnlyChange(base, { ...base, cabinClass: 'business' })).toBe(true);
  });
  it('is false for an identical search', () => {
    expect(isCabinOnlyChange(base, { ...base })).toBe(false);
  });
  it('is false when the route changes too', () => {
    expect(isCabinOnlyChange(base, { ...base, cabinClass: 'business', destination: 'BOS' })).toBe(false);
  });
  it('is false when dates or passengers change too', () => {
    expect(isCabinOnlyChange(base, { ...base, cabinClass: 'first', departureDate: '2026-04-25' })).toBe(false);
    expect(isCabinOnlyChange(base, { ...base, cabinClass: 'first', passengers: 2 })).toBe(false);
    expect(isCabinOnlyChange(base, { ...base, cabinClass: 'first', returnDate: '2026-04-28' })).toBe(false);
  });
  it('is false when either side is missing', () => {
    expect(isCabinOnlyChange(null, base)).toBe(false);
    expect(isCabinOnlyChange(base, undefined)).toBe(false);
  });
});
