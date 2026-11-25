import { describe, it, expect } from 'vitest';
import { isLocationUnavailable } from '@/hooks/useLocationUnavailable';

describe('isLocationUnavailable', () => {
  it('is false while the healthcheck is still loading (no data)', () => {
    expect(isLocationUnavailable(undefined)).toBe(false);
  });

  it('is false when Places is reachable', () => {
    expect(isLocationUnavailable({ places: true, mapbox: true })).toBe(false);
  });

  it('is true when Places is down', () => {
    expect(isLocationUnavailable({ places: false, mapbox: true })).toBe(true);
  });

  it('ignores Mapbox — it is only the fallback', () => {
    expect(isLocationUnavailable({ places: true, mapbox: false })).toBe(false);
  });
});
