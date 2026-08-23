import { describe, it, expect } from 'vitest';
import {
  bestFeaturedPerAirline,
  buildRouteView,
  buildRouteViews,
  formatDayDate,
  formatDuration,
  getOfferFlightInfo,
  isoToMinutes,
  itineraryMeta,
  stopLabel,
  totalTripDuration,
} from '@/lib/flights/itinerary';

function seg(overrides: Record<string, unknown> = {}) {
  return {
    departing_at: '2026-08-10T06:58:00',
    arriving_at: '2026-08-10T20:50:00',
    origin: { iata_code: 'JFK', city_name: 'New York' },
    destination: { iata_code: 'CDG', city_name: 'Paris' },
    marketing_carrier: { iata_code: 'AF', name: 'Air France' },
    marketing_carrier_flight_number: '009',
    ...overrides,
  };
}

const OUTBOUND = { duration: 'PT7H52M', segments: [seg()] };
const RETURN = {
  duration: 'PT8H10M',
  segments: [seg({
    departing_at: '2026-08-13T10:20:00',
    arriving_at: '2026-08-13T12:30:00',
    origin: { iata_code: 'CDG', city_name: 'Paris' },
    destination: { iata_code: 'JFK', city_name: 'New York' },
    marketing_carrier_flight_number: '010',
  })],
};

const ROUND_TRIP = {
  owner: { iata_code: 'AF', name: 'Air France' },
  slices: [OUTBOUND, RETURN],
};

describe('formatDuration', () => {
  it('renders hours and minutes', () => {
    expect(formatDuration('PT7H52M')).toBe('7h 52m');
  });

  it('renders an hours-only duration without a stray minutes part', () => {
    expect(formatDuration('PT8H')).toBe('8h');
  });

  it('renders a minutes-only duration', () => {
    expect(formatDuration('PT45M')).toBe('45m');
  });

  it('falls back to the raw string when nothing parses', () => {
    expect(formatDuration('unknown')).toBe('unknown');
  });
});

describe('isoToMinutes', () => {
  it('converts hours and minutes to total minutes', () => {
    expect(isoToMinutes('PT7H52M')).toBe(472);
  });

  it('treats a missing component as zero', () => {
    expect(isoToMinutes('PT2H')).toBe(120);
    expect(isoToMinutes('PT30M')).toBe(30);
  });
});

describe('totalTripDuration', () => {
  it('sums every route and rolls minutes into hours', () => {
    expect(totalTripDuration([OUTBOUND, RETURN])).toBe('16h 2m');
  });

  it('returns 0m for an empty itinerary rather than an empty string', () => {
    expect(totalTripDuration([])).toBe('0m');
  });
});

describe('stopLabel', () => {
  it('names a nonstop route', () => {
    expect(stopLabel(0)).toBe('Nonstop');
    expect(stopLabel(0, [])).toBe('Nonstop');
  });

  it('singularises one stop and pluralises the rest', () => {
    expect(stopLabel(1)).toBe('1 stop');
    expect(stopLabel(2)).toBe('2 stops');
  });

  it('names where the traveller connects', () => {
    expect(stopLabel(1, ['AMS'])).toBe('1 stop · AMS');
    expect(stopLabel(2, ['AMS', 'LHR'])).toBe('2 stops · AMS, LHR');
  });
});

describe('buildRouteView', () => {
  it('pulls departure, arrival, carrier and stop data off the slice', () => {
    const route = buildRouteView(OUTBOUND, ROUND_TRIP, 'Outbound');

    expect(route.label).toBe('Outbound');
    expect(route.dateLabel).toBe('Aug 10 · Mon');
    expect(route.depCode).toBe('JFK');
    expect(route.depCity).toBe('New York');
    expect(route.arrCode).toBe('CDG');
    expect(route.arrCity).toBe('Paris');
    expect(route.duration).toBe('7h 52m');
    expect(route.stops).toBe(0);
    expect(route.stopLabel).toBe('Nonstop');
    expect(route.carrier).toBe('Air France');
    expect(route.flightLabel).toBe('AF 009');
  });

  it('reads the arrival off the last segment of a connecting route', () => {
    const connecting = {
      duration: 'PT11H',
      segments: [
        seg({ destination: { iata_code: 'AMS', city_name: 'Amsterdam' } }),
        seg({
          origin: { iata_code: 'AMS', city_name: 'Amsterdam' },
          destination: { iata_code: 'CDG', city_name: 'Paris' },
          arriving_at: '2026-08-10T23:15:00',
        }),
      ],
    };

    const route = buildRouteView(connecting, ROUND_TRIP, 'Outbound');

    expect(route.arrCode).toBe('CDG');
    expect(route.stops).toBe(1);
    expect(route.stopCodes).toEqual(['AMS']);
    expect(route.stopLabel).toBe('1 stop · AMS');
  });

  it('leaves stopCodes empty for a nonstop route', () => {
    const route = buildRouteView(OUTBOUND, ROUND_TRIP, 'Outbound');

    expect(route.stopCodes).toEqual([]);
    expect(route.stopLabel).toBe('Nonstop');
  });

  it('falls back to the marketing carrier when the offer has no owner', () => {
    const route = buildRouteView(OUTBOUND, { slices: [OUTBOUND] }, 'Flight');

    expect(route.carrier).toBe('Air France');
    expect(route.airlineIata).toBe('AF');
  });
});

describe('buildRouteViews', () => {
  it('labels a round trip OUTBOUND then RETURN', () => {
    expect(buildRouteViews(ROUND_TRIP).map(l => l.label)).toEqual(['Outbound', 'Return']);
  });

  it('leaves a one-way unlabelled as a plain flight', () => {
    expect(buildRouteViews({ owner: null, slices: [OUTBOUND] }).map(l => l.label)).toEqual(['Flight']);
  });

  it('numbers the middle routes of a multi-city itinerary', () => {
    const multi = { owner: null, slices: [OUTBOUND, RETURN, OUTBOUND] };
    expect(buildRouteViews(multi).map(l => l.label)).toEqual(['Outbound', 'Route 2', 'Route 3']);
  });
});

describe('formatDayDate', () => {
  it('renders the date ahead of the weekday', () => {
    expect(formatDayDate('2026-08-10T06:58:00')).toBe('Aug 10 · Mon');
  });
});

describe('itineraryMeta', () => {
  it('says nothing about stops when the whole trip is nonstop', () => {
    expect(itineraryMeta(ROUND_TRIP)).toBe('2 routes');
  });

  it('stays quiet when only one route of a round trip connects', () => {
    const oneConnects = {
      slices: [OUTBOUND, { duration: 'PT8H10M', segments: [seg(), seg()] }],
    };
    expect(itineraryMeta(oneConnects)).toBe('2 routes');
  });

  it('totals the stops once every route connects', () => {
    const bothConnect = {
      slices: [
        { duration: 'PT7H52M', segments: [seg(), seg()] },
        { duration: 'PT8H10M', segments: [seg(), seg(), seg()] },
      ],
    };
    expect(itineraryMeta(bothConnect)).toBe('2 routes · 3 stops');
  });

  it('singularises the route and stop counts for a one-way', () => {
    expect(itineraryMeta({ slices: [OUTBOUND] })).toBe('1 route');
    expect(itineraryMeta({ slices: [{ duration: 'PT7H52M', segments: [seg(), seg()] }] }))
      .toBe('1 route · 1 stop');
  });

  it('handles an empty itinerary without a stop tail', () => {
    expect(itineraryMeta({ slices: [] })).toBe('0 routes');
  });
});

describe('getOfferFlightInfo', () => {
  it('derives airline identity and route context from the owner and outbound slice', () => {
    const info = getOfferFlightInfo(ROUND_TRIP);
    expect(info.airlineIata).toBe('AF');
    expect(info.airlineName).toBe('Air France');
    expect(info.ptsCtx).toMatchObject({
      airlineIata: 'AF',
      originIata: 'JFK',
      destIata: 'CDG',
      cabin: 'economy',
    });
  });

  it('falls back to the marketing carrier when the offer has no owner', () => {
    const info = getOfferFlightInfo({ owner: null, slices: [OUTBOUND] });
    expect(info.airlineIata).toBe('AF');
    expect(info.airlineName).toBe('Air France');
  });

  it('falls back to "Unknown airline" when neither owner nor marketing carrier is present', () => {
    const noCarrier = { duration: 'PT7H52M', segments: [seg({ marketing_carrier: null })] };
    const info = getOfferFlightInfo({ owner: null, slices: [noCarrier] });
    expect(info.airlineName).toBe('Unknown airline');
    expect(info.airlineIata).toBeNull();
  });

  it('reads destination off the last segment of a connecting outbound route', () => {
    const connecting = {
      duration: 'PT11H',
      segments: [
        seg({ destination: { iata_code: 'AMS', city_name: 'Amsterdam' } }),
        seg({ origin: { iata_code: 'AMS', city_name: 'Amsterdam' }, destination: { iata_code: 'CDG', city_name: 'Paris' } }),
      ],
    };
    const info = getOfferFlightInfo({ owner: { iata_code: 'AF', name: 'Air France' }, slices: [connecting] });
    expect(info.ptsCtx.originIata).toBe('JFK');
    expect(info.ptsCtx.destIata).toBe('CDG');
  });

  it('reads cabin_class off the first passenger of the first segment', () => {
    const businessSeg = { duration: 'PT7H52M', segments: [seg({ passengers: [{ cabin_class: 'business' }] })] };
    const info = getOfferFlightInfo({ owner: { iata_code: 'AF', name: 'Air France' }, slices: [businessSeg] });
    expect(info.ptsCtx.cabin).toBe('business');
  });
});

function featuredOffer(id: string, ownerIata: string | null, ownerName: string) {
  return { id, owner: ownerIata ? { iata_code: ownerIata, name: ownerName } : null, slices: [OUTBOUND] };
}

describe('bestFeaturedPerAirline', () => {
  it('keeps only the first (best-ranked) offer per airline', () => {
    const offers = [
      featuredOffer('af-1', 'AF', 'Air France'),
      featuredOffer('af-2', 'AF', 'Air France'),
      featuredOffer('dl-1', 'DL', 'Delta'),
    ];
    expect(bestFeaturedPerAirline(offers).map((o) => o.id)).toEqual(['af-1', 'dl-1']);
  });

  it('preserves input order and drops nothing when every airline is unique', () => {
    const offers = [
      featuredOffer('dl-1', 'DL', 'Delta'),
      featuredOffer('af-1', 'AF', 'Air France'),
      featuredOffer('ba-1', 'BA', 'British Airways'),
    ];
    expect(bestFeaturedPerAirline(offers).map((o) => o.id)).toEqual(['dl-1', 'af-1', 'ba-1']);
  });

  it('falls back to airline name for grouping when iata is missing, matching getOfferFlightInfo', () => {
    const noOwnerSameCarrier = {
      id: 'noowner-1',
      owner: null,
      slices: [{ duration: 'PT7H52M', segments: [seg({ marketing_carrier: { iata_code: 'AF', name: 'Air France' } })] }],
    };
    const offers = [featuredOffer('af-1', 'AF', 'Air France'), noOwnerSameCarrier];
    expect(bestFeaturedPerAirline(offers).map((o) => o.id)).toEqual(['af-1']);
  });

  it('returns an empty array for an empty input', () => {
    expect(bestFeaturedPerAirline([])).toEqual([]);
  });
});
