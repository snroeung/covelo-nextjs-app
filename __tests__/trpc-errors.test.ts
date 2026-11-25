import { describe, it, expect } from 'vitest';
import { isProviderOutage } from '@/lib/trpc-errors';

/** Mimics a TRPCClientError's shape for a given HTTP status (null = no response). */
function trpcError(httpStatus: number | null): Error & { data: unknown } {
  const e = new Error('stub') as Error & { data: unknown };
  e.data = httpStatus == null ? null : { httpStatus };
  return e;
}

describe('isProviderOutage', () => {
  it('returns false for no error', () => {
    expect(isProviderOutage(null)).toBe(false);
    expect(isProviderOutage(undefined)).toBe(false);
  });

  it('treats 5xx as an outage', () => {
    expect(isProviderOutage(trpcError(500))).toBe(true);
    expect(isProviderOutage(trpcError(503))).toBe(true);
  });

  it('treats a network error (Error with no httpStatus) as an outage', () => {
    expect(isProviderOutage(trpcError(null))).toBe(true);
    expect(isProviderOutage(new TypeError('Failed to fetch'))).toBe(true);
  });

  it('does NOT treat 4xx client/validation errors as an outage', () => {
    expect(isProviderOutage(trpcError(400))).toBe(false); // BAD_REQUEST / validation
    expect(isProviderOutage(trpcError(404))).toBe(false); // NOT_FOUND (e.g. flag off)
    expect(isProviderOutage(trpcError(401))).toBe(false); // UNAUTHORIZED
  });

  it('ignores non-error objects without a response', () => {
    expect(isProviderOutage({ some: 'object' })).toBe(false);
  });
});
