// When an offer counts as live. An offer runs through its end date, so one that
// "ends today" is still shown; the day after, it is gone from every page and
// from saved lists. Pure, so the server, the pages and the tests agree.

export interface OfferWindow {
  active?: boolean;
  end_date: string | null;
}

/** "2026-10-27" in UTC — the same day boundary the database uses for CURRENT_DATE. */
export function todayIso(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

/** Live: switched on, and either ongoing (no end date) or ending today or later. */
export function isLiveOffer(offer: OfferWindow, now: Date = new Date()): boolean {
  if (offer.active === false) return false;
  return !offer.end_date || offer.end_date.slice(0, 10) >= todayIso(now);
}

/** Drop what has ended. Used on cached lists, which can outlive an offer by up to their TTL. */
export function liveOffers<T extends OfferWindow>(offers: readonly T[], now: Date = new Date()): T[] {
  return offers.filter((o) => isLiveOffer(o, now));
}

/** PostgREST `.or()` filter for the same rule, for queries that should not fetch ended offers at all. */
export function liveOfferFilter(now: Date = new Date()): string {
  return `end_date.is.null,end_date.gte.${todayIso(now)}`;
}

/** How many saved offers one member can keep. */
export const SAVED_OFFERS_LIMIT = 100;
