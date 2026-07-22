import { describe, it, expect } from "vitest";
import { matchHotelCollections } from "@/lib/hotelCollectionMatch";
import type { HotelCollection } from "@/lib/types/portalData";

function makeCollection(overrides: Partial<HotelCollection> = {}): HotelCollection {
  return {
    id: "00000000-0000-0000-0000-000000000001",
    issuer: "amex",
    collection_name: "Fine Hotels + Resorts",
    property_name: "The Ritz-Carlton New York",
    perk_summary: "Free breakfast, room upgrade, $100 credit",
    start_date: null,
    end_date: null,
    source: "admin",
    status: "approved",
    source_url: null,
    active: true,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function makeResult(id: string, name: string) {
  return { accommodation: { id, name } };
}

describe("matchHotelCollections", () => {
  it("matches an exact name", () => {
    const collections = [makeCollection()];
    const results = [makeResult("acc_1", "The Ritz-Carlton New York")];
    const matches = matchHotelCollections(results, collections);
    expect(matches.get("acc_1")).toEqual({
      collection_name: "Fine Hotels + Resorts",
      issuer: "amex",
      perk_summary: "Free breakfast, room upgrade, $100 credit",
      source_url: null,
    });
  });

  it("matches fuzzy names above threshold", () => {
    const collections = [makeCollection()];
    const results = [makeResult("acc_2", "The Ritz-Carlton New York, a Marriott Hotel")];
    const matches = matchHotelCollections(results, collections);
    expect(matches.has("acc_2")).toBe(true);
  });

  it("does not match names below threshold", () => {
    const collections = [makeCollection()];
    const results = [makeResult("acc_3", "Holiday Inn Express Newark Airport")];
    const matches = matchHotelCollections(results, collections);
    expect(matches.has("acc_3")).toBe(false);
  });

  it("ignores collections with a null property_name", () => {
    const collections = [makeCollection({ property_name: null })];
    const results = [makeResult("acc_4", "The Ritz-Carlton New York")];
    const matches = matchHotelCollections(results, collections);
    expect(matches.has("acc_4")).toBe(false);
  });

  it("ignores collections that are not status=approved", () => {
    const collections = [makeCollection({ status: "admin" }), makeCollection({ status: "pending" })];
    const results = [makeResult("acc_6", "The Ritz-Carlton New York")];
    const matches = matchHotelCollections(results, collections);
    expect(matches.has("acc_6")).toBe(false);
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
    const matches = matchHotelCollections(results, collections);
    expect(matches.get("acc_5")?.collection_name).toBe("Strong Match Collection");
  });
});
