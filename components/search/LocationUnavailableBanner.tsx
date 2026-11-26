'use client';

import { UnavailableBanner } from '@/components/ui/UnavailableBanner';

/**
 * Location-search variant of the reusable {@link UnavailableBanner}. Shown at the top of
 * the search surfaces when Google Places autocomplete is down (flag off / 403 / network).
 * Flights can still enter a 3-letter code; hotels auto-resolve via Mapbox.
 */
export function LocationUnavailableBanner({ show }: { show: boolean }) {
  return (
    <UnavailableBanner
      show={show}
      subject="Location search"
      detail="Enter a 3-letter airport code for flights. You can also try again shortly."
    />
  );
}
