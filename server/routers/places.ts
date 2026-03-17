import { z } from 'zod';
import { publicProcedure, router } from '@/server/trpc';
import { getPlaceAutocomplete, getPlaceLatLng } from '@/lib/places';

export const placesRouter = router({
  /**
   * Autocomplete — free when called with a sessionToken.
   * The token groups all autocomplete calls in a session; only Place Details is billed.
   */
  autocomplete: publicProcedure
    .input(z.object({
      input: z.string().min(1),
      sessionToken: z.string().uuid(),
      types: z.string().optional(),
    }))
    .query(async ({ input: { input, sessionToken, types } }) => {
      return getPlaceAutocomplete(input, sessionToken, types);
    }),

  /**
   * Resolves a placeId → lat/lng.
   * Checks Redis cache first (keyed by placeId, 30-day TTL).
   * On cache miss: calls Place Details API, which closes the billing session.
   */
  getLatLng: publicProcedure
    .input(z.object({
      placeId: z.string().min(1),
      sessionToken: z.string().uuid(),
    }))
    .query(async ({ input: { placeId, sessionToken } }) => {
      return getPlaceLatLng(placeId, sessionToken);
    }),
});
