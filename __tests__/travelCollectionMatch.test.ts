import { describe, it, expect } from "vitest";
import { matchHotelCollections, matchFlightCollections } from "@/lib/travelCollectionMatch";
import type { TravelCollection } from "@/lib/types/portalData";

function makeCollection(overrides: Partial<TravelCollection> = {}): TravelCollection {
  return {
    id: "00000000-0000-0000-0000-000000000001",
    issuer: "amex",
    type: "hotel",
    collection_name: "Fine Hotels + Resorts",
    property_name: "The Ritz-Carlton New York",
    airline_name: null,
    airline_iata_code: null,
    origin_iata_code: null,
    destination_iata_code: null,
    cabin_class: null,
    perk_summary: "Free breakfast, room upgrade, $100 credit",
    original_amount: null,
    original_unit: null,
    discount_amount: null,
    discount_unit: null,
    end_date: null,
    limited_time_offer: false,
    source: "admin",
    status: "approved",
    source_url: null,
    active: true,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function makeMatchEntry(c: TravelCollection) {
  return {
    collection_name: c.collection_name,
    issuer: c.issuer,
    perk_summary: c.perk_summary,
    source_url: c.source_url,
    original_amount: c.original_amount,
    original_unit: c.original_unit,
    discount_amount: c.discount_amount,
    discount_unit: c.discount_unit,
    limited_time_offer: c.limited_time_offer,
  };
}

function makeResult(id: string, name: string) {
  return { accommodation: { id, name } };
}

const SEARCH_DATE = "2026-06-01";

describe("matchHotelCollections", () => {
  it("matches an exact name", () => {
    const collection = makeCollection();
    const results = [makeResult("acc_1", "The Ritz-Carlton New York")];
    const matches = matchHotelCollections(results, [collection], SEARCH_DATE);
    expect(matches.get("acc_1")).toEqual(makeMatchEntry(collection));
  });

  it("matches fuzzy names above threshold", () => {
    const collections = [makeCollection()];
    const results = [makeResult("acc_2", "The Ritz-Carlton New York, a Marriott Hotel")];
    const matches = matchHotelCollections(results, collections, SEARCH_DATE);
    expect(matches.has("acc_2")).toBe(true);
  });

  it("does not match names below threshold", () => {
    const collections = [makeCollection()];
    const results = [makeResult("acc_3", "Holiday Inn Express Newark Airport")];
    const matches = matchHotelCollections(results, collections, SEARCH_DATE);
    expect(matches.has("acc_3")).toBe(false);
  });

  it("ignores collections with a null property_name", () => {
    const collections = [makeCollection({ property_name: null })];
    const results = [makeResult("acc_4", "The Ritz-Carlton New York")];
    const matches = matchHotelCollections(results, collections, SEARCH_DATE);
    expect(matches.has("acc_4")).toBe(false);
  });

  it("matches status=admin rows — admin-published collections are publicly visible without cron review", () => {
    const collections = [makeCollection({ status: "admin" })];
    const results = [makeResult("acc_6", "The Ritz-Carlton New York")];
    const matches = matchHotelCollections(results, collections, SEARCH_DATE);
    expect(matches.has("acc_6")).toBe(true);
  });

  it("ignores collections that are status=pending or status=rejected", () => {
    const collections = [makeCollection({ status: "pending" }), makeCollection({ status: "rejected" })];
    const results = [makeResult("acc_6b", "The Ritz-Carlton New York")];
    const matches = matchHotelCollections(results, collections, SEARCH_DATE);
    expect(matches.has("acc_6b")).toBe(false);
  });

  it("ignores collections with type=flight", () => {
    const collections = [makeCollection({ type: "flight" })];
    const results = [makeResult("acc_7", "The Ritz-Carlton New York")];
    const matches = matchHotelCollections(results, collections, SEARCH_DATE);
    expect(matches.has("acc_7")).toBe(false);
  });

  it("picks the best match among multiple candidates", () => {
    const collections = [
      makeCollection({
        id: "c1",
        collection_name: "Weak Match Collection",
        property_name: "The Ritz-Carlton New York, a Marriott Hotel",
      }),
      makeCollection({
        id: "c2",
        collection_name: "Strong Match Collection",
        property_name: "The Ritz-Carlton New York",
      }),
    ];
    const results = [makeResult("acc_5", "The Ritz-Carlton New York")];
    const matches = matchHotelCollections(results, collections, SEARCH_DATE);
    expect(matches.get("acc_5")?.collection_name).toBe("Strong Match Collection");
  });

  it("carries limited_time_offer and discount fields through", () => {
    const collection = makeCollection({
      original_amount: 100000,
      original_unit: "points",
      discount_amount: 70000,
      discount_unit: "points",
      limited_time_offer: true,
    });
    const results = [makeResult("acc_8", "The Ritz-Carlton New York")];
    const matches = matchHotelCollections(results, [collection], SEARCH_DATE);
    expect(matches.get("acc_8")).toMatchObject({
      original_amount: 100000,
      original_unit: "points",
      discount_amount: 70000,
      discount_unit: "points",
      limited_time_offer: true,
    });
  });

  it("ignores a collection whose end_date is before the search date", () => {
    const collections = [makeCollection({ end_date: "2026-05-01" })];
    const results = [makeResult("acc_9", "The Ritz-Carlton New York")];
    const matches = matchHotelCollections(results, collections, SEARCH_DATE);
    expect(matches.has("acc_9")).toBe(false);
  });

  it("matches a collection whose end_date is after the search date", () => {
    const collections = [makeCollection({ end_date: "2026-07-01" })];
    const results = [makeResult("acc_10", "The Ritz-Carlton New York")];
    const matches = matchHotelCollections(results, collections, SEARCH_DATE);
    expect(matches.has("acc_10")).toBe(true);
  });

  it("matches a collection whose end_date exactly equals the search date", () => {
    const collections = [makeCollection({ end_date: SEARCH_DATE })];
    const results = [makeResult("acc_11", "The Ritz-Carlton New York")];
    const matches = matchHotelCollections(results, collections, SEARCH_DATE);
    expect(matches.has("acc_11")).toBe(true);
  });

  it("matches a collection with no end_date regardless of search date", () => {
    const collections = [makeCollection({ end_date: null })];
    const results = [makeResult("acc_12", "The Ritz-Carlton New York")];
    const matches = matchHotelCollections(results, collections, "2099-01-01");
    expect(matches.has("acc_12")).toBe(true);
  });
});

function makeFlightCollection(overrides: Partial<TravelCollection> = {}): TravelCollection {
  return makeCollection({
    type: "flight",
    collection_name: "Points Boost",
    property_name: null,
    airline_name: "United Airlines",
    airline_iata_code: "UA",
    cabin_class: "business",
    ...overrides,
  });
}

function makeOffer(id: string, iataCode: string, originIata = "SFO", destIata = "JFK") {
  return {
    id,
    owner: { iata_code: iataCode },
    slices: [{ segments: [{ origin: { iata_code: originIata }, destination: { iata_code: destIata } }] }],
  };
}

describe("matchFlightCollections", () => {
  it("matches on exact IATA code", () => {
    const collection = makeFlightCollection();
    const offers = [makeOffer("offer_1", "UA")];
    const matches = matchFlightCollections(offers, [collection], SEARCH_DATE);
    expect(matches.get("offer_1")).toEqual(makeMatchEntry(collection));
  });

  it("does not match a different airline", () => {
    const collections = [makeFlightCollection({ airline_iata_code: "UA" })];
    const offers = [makeOffer("offer_2", "DL")];
    const matches = matchFlightCollections(offers, collections, SEARCH_DATE);
    expect(matches.has("offer_2")).toBe(false);
  });

  it("picks the first matching collection when multiple exist for the same airline", () => {
    // matchFlightCollections matches on airline_iata_code only — no cabin_class
    // awareness, since FlightOffer carries no cabin_class field to match against.
    const collections = [
      makeFlightCollection({ id: "fc1", cabin_class: "economy", collection_name: "Economy Boost" }),
      makeFlightCollection({ id: "fc2", cabin_class: "business", collection_name: "Business Boost" }),
    ];
    const offers = [makeOffer("offer_3", "UA")];
    const matches = matchFlightCollections(offers, collections, SEARCH_DATE);
    expect(matches.get("offer_3")?.collection_name).toBe("Economy Boost");
  });

  it("matches status=admin rows — admin-published collections are publicly visible without cron review", () => {
    const collections = [makeFlightCollection({ status: "admin" })];
    const offers = [makeOffer("offer_4a", "UA")];
    const matches = matchFlightCollections(offers, collections, SEARCH_DATE);
    expect(matches.has("offer_4a")).toBe(true);
  });

  it("ignores collections that are status=pending or status=rejected", () => {
    const collections = [makeFlightCollection({ status: "pending" }), makeFlightCollection({ status: "rejected" })];
    const offers = [makeOffer("offer_4", "UA")];
    const matches = matchFlightCollections(offers, collections, SEARCH_DATE);
    expect(matches.has("offer_4")).toBe(false);
  });

  it("ignores collections with type=hotel", () => {
    const collections = [makeFlightCollection({ type: "hotel" })];
    const offers = [makeOffer("offer_5", "UA")];
    const matches = matchFlightCollections(offers, collections, SEARCH_DATE);
    expect(matches.has("offer_5")).toBe(false);
  });

  it("matches when airline, origin, and destination all match", () => {
    const collection = makeFlightCollection({ origin_iata_code: "SFO", destination_iata_code: "NRT" });
    const offers = [makeOffer("offer_6", "UA", "SFO", "NRT")];
    const matches = matchFlightCollections(offers, [collection], SEARCH_DATE);
    expect(matches.get("offer_6")).toEqual(makeMatchEntry(collection));
  });

  it("does not match when airline matches but origin differs", () => {
    const collections = [makeFlightCollection({ origin_iata_code: "SFO", destination_iata_code: "NRT" })];
    const offers = [makeOffer("offer_7", "UA", "LAX", "NRT")];
    const matches = matchFlightCollections(offers, collections, SEARCH_DATE);
    expect(matches.has("offer_7")).toBe(false);
  });

  it("does not match when airline matches but destination differs", () => {
    const collections = [makeFlightCollection({ origin_iata_code: "SFO", destination_iata_code: "NRT" })];
    const offers = [makeOffer("offer_8", "UA", "SFO", "HND")];
    const matches = matchFlightCollections(offers, collections, SEARCH_DATE);
    expect(matches.has("offer_8")).toBe(false);
  });

  it("matches on airline alone when the collection's route fields are both null (wildcard)", () => {
    const collection = makeFlightCollection({ origin_iata_code: null, destination_iata_code: null });
    const offers = [makeOffer("offer_9", "UA", "ORD", "LHR")];
    const matches = matchFlightCollections(offers, [collection], SEARCH_DATE);
    expect(matches.has("offer_9")).toBe(true);
  });

  it("treats a null origin as wildcard even when destination is set", () => {
    const collection = makeFlightCollection({ origin_iata_code: null, destination_iata_code: "NRT" });
    const matchingOffer = makeOffer("offer_10a", "UA", "LAX", "NRT");
    const nonMatchingOffer = makeOffer("offer_10b", "UA", "LAX", "HND");
    const matches = matchFlightCollections([matchingOffer, nonMatchingOffer], [collection], SEARCH_DATE);
    expect(matches.has("offer_10a")).toBe(true);
    expect(matches.has("offer_10b")).toBe(false);
  });

  it("ignores a collection whose end_date is before the search date", () => {
    const collections = [makeFlightCollection({ end_date: "2026-05-01" })];
    const offers = [makeOffer("offer_11", "UA")];
    const matches = matchFlightCollections(offers, collections, SEARCH_DATE);
    expect(matches.has("offer_11")).toBe(false);
  });

  it("matches a collection whose end_date is after the search date", () => {
    const collections = [makeFlightCollection({ end_date: "2026-07-01" })];
    const offers = [makeOffer("offer_12", "UA")];
    const matches = matchFlightCollections(offers, collections, SEARCH_DATE);
    expect(matches.has("offer_12")).toBe(true);
  });

  it("matches a collection whose end_date exactly equals the search date", () => {
    const collections = [makeFlightCollection({ end_date: SEARCH_DATE })];
    const offers = [makeOffer("offer_13", "UA")];
    const matches = matchFlightCollections(offers, collections, SEARCH_DATE);
    expect(matches.has("offer_13")).toBe(true);
  });

  it("matches a collection with no end_date regardless of search date", () => {
    const collections = [makeFlightCollection({ end_date: null })];
    const offers = [makeOffer("offer_14", "UA")];
    const matches = matchFlightCollections(offers, collections, "2099-01-01");
    expect(matches.has("offer_14")).toBe(true);
  });
});
