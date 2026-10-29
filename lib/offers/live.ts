// When an offer counts as live. An offer runs through its end date, so one that
// "ends today" is still shown; the day after, it is gone from every page and
// from saved lists. Pure, so the server, the pages and the tests agree.
//
// "The day after" is the viewer's day: pass their time zone (default UTC). A
// database query cannot know it, so it fetches a superset with
// widestLiveOfferFilter and the result is trimmed with liveOffers.

import { UTC, dateInZone } from "@/lib/time";

export interface OfferWindow {
  active?: boolean;
  end_date: string | null;
}

/** A real calendar date in "YYYY-MM-DD" form — "2026-02-31" and "2026-13-45" are not. Matches what Postgres accepts for DATE. */
export function isRealIsoDate(value: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const t = new Date(Date.UTC(y, mo - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === mo - 1 && t.getUTCDate() === d;
}

/** "2026-10-27" — today's date in `timeZone` (UTC unless given). */
export function todayIso(now: Date = new Date(), timeZone: string = UTC): string {
  return dateInZone(now, timeZone);
}

/** Live: switched on, and either ongoing (no end date) or ending today or later, in `timeZone`. */
export function isLiveOffer(offer: OfferWindow, now: Date = new Date(), timeZone: string = UTC): boolean {
  if (offer.active === false) return false;
  return !offer.end_date || offer.end_date.slice(0, 10) >= todayIso(now, timeZone);
}

/** Drop what has ended. Used on cached lists, which can outlive an offer by up to their TTL. */
export function liveOffers<T extends OfferWindow>(offers: readonly T[], now: Date = new Date(), timeZone: string = UTC): T[] {
  return offers.filter((o) => isLiveOffer(o, now, timeZone));
}

/** PostgREST `or` filter for offers still live in `timeZone`. */
export function liveOfferFilter(now: Date = new Date(), timeZone: string = UTC): string {
  return `end_date.is.null,end_date.gte.${todayIso(now, timeZone)}`;
}

/**
 * Offers live for *anyone*: the earliest "today" on Earth is UTC-12's. Use for
 * queries and caches shared by every viewer, then trim per viewer with liveOffers.
 */
export function widestLiveOfferFilter(now: Date = new Date()): string {
  return liveOfferFilter(new Date(now.getTime() - 12 * 3600_000));
}

/** How many saved offers one member can keep. */
export const SAVED_OFFERS_LIMIT = 100;
