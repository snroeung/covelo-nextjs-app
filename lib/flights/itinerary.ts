/* eslint-disable @typescript-eslint/no-explicit-any -- Duffel offer/slice/segment shapes are untyped in the SDK */

import { classifyRoute } from '@/lib/points/transferPartners';
import type { Cabin, FlightContext } from '@/lib/points/types';

/**
 * Pure formatting + shaping helpers behind the flight comparison card's
 * itinerary block. Kept out of the component so the round-trip totals and the
 * per-route rows all read from one derivation.
 */

export interface RouteView {
  /** OUTBOUND / RETURN for a round trip, FLIGHT for a one-way */
  label: string;
  /** 'Aug 10 · Mon' */
  dateLabel: string;
  depTime: string;
  depCode: string;
  depCity: string;
  arrTime: string;
  arrCode: string;
  arrCity: string;
  /** '7h 52m' */
  duration: string;
  stops: number;
  /** Connection airports between origin and destination, in order — ['AMS'] */
  stopCodes: string[];
  /** 'Nonstop' / '1 stop · AMS' / '2 stops · AMS, LHR' */
  stopLabel: string;
  carrier: string;
  airlineIata: string | null;
  /** 'AF 009' — empty when the carrier or flight number is missing */
  flightLabel: string;
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/** ISO 8601 duration ('PT7H52M') → '7h 52m'. Returns the input if unparseable. */
export function formatDuration(iso: string): string {
  const h = iso?.match(/(\d+)H/)?.[1];
  const m = iso?.match(/(\d+)M/)?.[1];
  return [h && `${h}h`, m && `${m}m`].filter(Boolean).join(' ') || iso;
}

export function isoToMinutes(iso: string): number {
  const h = parseInt(iso?.match(/(\d+)H/)?.[1] ?? '0');
  const m = parseInt(iso?.match(/(\d+)M/)?.[1] ?? '0');
  return h * 60 + m;
}

/** Summed flying time across every route, e.g. '16h 2m'. */
export function totalTripDuration(slices: any[]): string {
  const mins = slices.reduce((sum, s) => sum + isoToMinutes(s.duration), 0);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return [h && `${h}h`, m && `${m}m`].filter(Boolean).join(' ') || '0m';
}

/** 'Aug 10 · Mon' — the route-identity date used in the itinerary block. */
export function formatDayDate(iso: string): string {
  const d = new Date(iso);
  const date = d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  const day = d.toLocaleDateString([], { weekday: 'short' });
  return `${date} · ${day}`;
}

/**
 * 'Nonstop', or the stop count followed by where the traveller actually
 * connects — the layover airport is the part people decide on.
 */
export function stopLabel(stops: number, stopCodes: string[] = []): string {
  if (stops === 0) return 'Nonstop';
  const count = `${stops} stop${stops > 1 ? 's' : ''}`;
  return stopCodes.length > 0 ? `${count} · ${stopCodes.join(', ')}` : count;
}

function cityOf(place: any): string {
  return place?.city_name ?? place?.city?.name ?? place?.name ?? '';
}

export function buildRouteView(slice: any, offer: any, label: string): RouteView {
  const firstSeg = slice.segments[0];
  const lastSeg = slice.segments[slice.segments.length - 1];
  const stops = slice.segments.length - 1;
  // Each segment but the last ends at a connection point.
  const stopCodes = slice.segments
    .slice(0, -1)
    .map((s: any) => s.destination?.iata_code)
    .filter(Boolean) as string[];
  const airlineIata = (offer?.owner?.iata_code ?? firstSeg?.marketing_carrier?.iata_code ?? null) as string | null;
  const flightNum = (firstSeg?.marketing_carrier_flight_number ?? '') as string;

  return {
    label,
    dateLabel: formatDayDate(firstSeg.departing_at),
    depTime: formatTime(firstSeg.departing_at),
    depCode: firstSeg.origin?.iata_code ?? '',
    depCity: cityOf(firstSeg.origin),
    arrTime: formatTime(lastSeg.arriving_at),
    arrCode: lastSeg.destination?.iata_code ?? '',
    arrCity: cityOf(lastSeg.destination),
    duration: formatDuration(slice.duration),
    stops,
    stopCodes,
    stopLabel: stopLabel(stops, stopCodes),
    carrier: offer?.owner?.name ?? firstSeg?.marketing_carrier?.name ?? 'Unknown airline',
    airlineIata,
    flightLabel: [airlineIata, flightNum].filter(Boolean).join(' '),
  };
}

/** OUTBOUND/RETURN for a round trip; a single unlabelled route for a one-way. */
export function buildRouteViews(offer: any): RouteView[] {
  const slices = offer.slices ?? [];
  if (slices.length < 2) return slices.map((s: any) => buildRouteView(s, offer, 'Flight'));
  return slices.map((s: any, i: number) =>
    buildRouteView(s, offer, i === 0 ? 'Outbound' : slices.length === 2 ? 'Return' : `Route ${i + 1}`),
  );
}

/**
 * '2 routes', gaining a ' · 1 stop' tail only when every route connects. A
 * nonstop trip says nothing about stops at all, and a trip where only one route
 * connects leaves that detail to the per-route rows rather than implying the
 * whole itinerary stops. Total duration lives in the card's summary header, so
 * it is deliberately absent here.
 */
export function itineraryMeta(offer: any): string {
  const slices = offer.slices ?? [];
  const routeWord = `${slices.length} route${slices.length !== 1 ? 's' : ''}`;
  const everyRouteStops = slices.length > 0 && slices.every((s: any) => s.segments.length > 1);
  if (!everyRouteStops) return routeWord;
  const stops = slices.reduce((n: number, s: any) => n + s.segments.length - 1, 0);
  return `${routeWord} · ${stops} stop${stops !== 1 ? 's' : ''}`;
}

function getCabin(seg: any): Cabin {
  const raw = seg?.passengers?.[0]?.cabin_class as string | undefined;
  return raw === 'business' ? 'business' : raw === 'first' ? 'first' : 'economy';
}

export interface OfferFlightInfo {
  airlineIata: string | null;
  airlineName: string;
  ptsCtx: FlightContext;
}

/**
 * Airline identity + points-calc context for an offer's outbound leg — the
 * derivation FlightCard needs for its header/badge and calcPoints() needs for
 * its transfer-alternative filtering. Shared so the flights list page can
 * compute the same PointsResult per offer (for "featured" matching) without
 * duplicating the origin/destination/cabin extraction.
 */
export function getOfferFlightInfo(offer: any): OfferFlightInfo {
  const firstSlice = offer.slices[0];
  const firstSeg = firstSlice.segments[0];
  const lastSeg = firstSlice.segments[firstSlice.segments.length - 1];

  const airlineIata = (offer.owner?.iata_code ?? firstSeg?.marketing_carrier?.iata_code ?? null) as string | null;
  const airlineName = offer.owner?.name ?? firstSeg?.marketing_carrier?.name ?? 'Unknown airline';

  return {
    airlineIata,
    airlineName,
    ptsCtx: {
      airlineIata,
      originIata: firstSeg?.origin?.iata_code ?? null,
      destIata: lastSeg?.destination?.iata_code ?? null,
      routeType: classifyRoute(firstSeg?.origin?.iata_code, lastSeg?.destination?.iata_code),
      cabin: getCabin(firstSeg),
    },
  };
}

/**
 * Departure date of the outbound slice, plus the return slice's departure
 * date for round trips. Shared so both FlightCard (banner gating) and the
 * flights list page ("featured" bonus matching) check a live transfer bonus
 * against the same trip dates instead of each re-deriving them.
 */
export function getOfferTripDates(offer: any): string[] {
  const firstSeg = offer.slices[0]?.segments?.[0];
  const dates = [firstSeg?.departing_at as string | undefined];
  if (offer.slices.length > 1) {
    const lastSlice = offer.slices[offer.slices.length - 1];
    dates.push(lastSlice.segments?.[0]?.departing_at as string | undefined);
  }
  return dates.filter((d): d is string => !!d);
}

const AIRLINE_COLORS: Record<string, string> = {
  AA: '#c0212b', DL: '#003c7d', UA: '#172649', B6: '#0075ff',
  WN: '#ff4500', AS: '#0074c8', NK: '#ffd300', F9: '#007a3d',
  HA: '#7b1fa2', QR: '#5c0716', EK: '#c8102e', LH: '#05164d',
  BA: '#075aaa', AC: '#c0202d', AF: '#002157', KL: '#00a1de',
  SQ: '#0032a0', CX: '#006564', JL: '#e11931', NH: '#003087',
};

/** Brand colour for an airline badge — a neutral grey for anything unmapped. */
export function getAirlineColor(iata: string | null): string {
  return (iata && AIRLINE_COLORS[iata]) ?? '#374151';
}

export interface AirlineGroup<T> {
  /** airlineIata, falling back to airlineName — same identity rule as getOfferFlightInfo callers use elsewhere. */
  key: string;
  airlineIata: string | null;
  airlineName: string;
  /** First (best-ranked) offer for this airline under the caller's ordering. */
  top: T;
  /** Every other offer for this airline, in the same relative order as the input. */
  rest: T[];
}

/**
 * Splits an already-sorted offer list into one group per airline: a "top"
 * offer (the first occurrence — "best under the caller's ranking", same
 * reasoning the old bestFeaturedPerAirline dedup used) plus every other offer
 * from that airline as "rest". Powers the flights list's per-airline
 * treatment — one card shown inline, the remainder rolled into a group card
 * linking to a full per-airline list. Groups are returned in the order their
 * airline's top offer first appears.
 */
export function groupOffersByAirline<T>(offers: T[]): AirlineGroup<T>[] {
  const order: string[] = [];
  const groups = new Map<string, AirlineGroup<T>>();
  for (const offer of offers) {
    const { airlineIata, airlineName } = getOfferFlightInfo(offer);
    const key = airlineIata ?? airlineName;
    const existing = groups.get(key);
    if (existing) {
      existing.rest.push(offer);
    } else {
      groups.set(key, { key, airlineIata, airlineName, top: offer, rest: [] });
      order.push(key);
    }
  }
  return order.map((key) => groups.get(key)!);
}

/** Cheapest/most expensive total_amount across a list of offers. {min:0,max:0} for an empty list. */
export function offerPriceRange(offers: any[]): { min: number; max: number } {
  const amounts = offers
    .map((o) => parseFloat(o.total_amount))
    .filter((n) => Number.isFinite(n));
  if (amounts.length === 0) return { min: 0, max: 0 };
  return { min: Math.min(...amounts), max: Math.max(...amounts) };
}
