import { vi, beforeEach, describe, it, expect, type Mock } from 'vitest';
import { appRouter } from "@/server/routers/_app";

vi.mock("@/lib/duffel", () => ({
  duffel: {
    offerRequests: {
      create: vi.fn(),
    },
  },
}));

// Cache-first path depends on Redis — mock it so tests control hit/miss.
vi.mock("@/lib/redis", () => ({
  redis: {
    get: vi.fn(),
    set: vi.fn(),
  },
}));

// Enable all flags relevant to flights so unit tests are not coupled to flag config
vi.mock("@/lib/feature-flags", () => ({
  isEnabled: vi.fn(() => true),
}));

import { duffel } from "@/lib/duffel";
import { redis } from "@/lib/redis";
import { isEnabled } from "@/lib/feature-flags";

const mockOfferRequest = {
  id: "orq_0000AJyFCYScL8vOSuyfJ0",
  live_mode: false,
  cabin_class: "economy",
  created_at: "2024-01-01T00:00:00.000Z",
  slices: [
    {
      origin: { iata_code: "LHR", name: "London Heathrow" },
      destination: { iata_code: "JFK", name: "John F. Kennedy International" },
      departure_date: "2026-06-01",
    },
  ],
  passengers: [{ type: "adult", id: "pas_0000AJyFCYScL8vOSuyfJ1" }],
  offers: [
    {
      id: "off_0000AJyFCYScL8vOSuyfJ2",
      total_amount: "450.00",
      total_currency: "USD",
      base_amount: "380.00",
      base_currency: "USD",
      tax_amount: "70.00",
      tax_currency: "USD",
    },
  ],
};

describe("flights.searchOffers", () => {
  const caller = appRouter.createCaller({});

  beforeEach(() => {
    vi.clearAllMocks();
    // Default: cache miss, writes succeed.
    (redis.get as any).mockResolvedValue(null);
    (redis.set as any).mockResolvedValue("OK");
  });

  it("returns an offer request for a one-way flight search", async () => {
    (duffel.offerRequests.create as Mock).mockResolvedValue({
      data: mockOfferRequest,
    });

    const result = await caller.flights.searchOffers({
      origin: "LHR",
      destination: "JFK",
      departureDate: "2026-06-01",
      passengers: 1,
    });

    expect(result).toEqual(mockOfferRequest);
    expect(duffel.offerRequests.create).toHaveBeenCalledWith({
      slices: [{ origin: "LHR", destination: "JFK", departure_date: "2026-06-01", arrival_time: null, departure_time: null }],
      passengers: [{ type: "adult" }],
      cabin_class: "economy",
    });
  });

  it("throws when the Duffel API fails", async () => {
    (duffel.offerRequests.create as Mock).mockRejectedValue(
      new Error("Duffel API unavailable")
    );

    await expect(
      caller.flights.searchOffers({
        origin: "LHR",
        destination: "JFK",
        departureDate: "2026-06-01",
        passengers: 1,
      })
    ).rejects.toThrow("Duffel API unavailable");
  });

  it("throws a validation error for an invalid airport code", async () => {
    await expect(
      caller.flights.searchOffers({
        origin: "INVALID",
        destination: "JFK",
        departureDate: "2026-06-01",
        passengers: 1,
      })
    ).rejects.toThrow();
  });

  it("passes cabin class when provided", async () => {
    (duffel.offerRequests.create as Mock).mockResolvedValue({
      data: mockOfferRequest,
    });

    await caller.flights.searchOffers({
      origin: "LHR",
      destination: "JFK",
      departureDate: "2026-06-01",
      passengers: 2,
      cabinClass: "business",
    });

    expect(duffel.offerRequests.create).toHaveBeenCalledWith(
      expect.objectContaining({
        cabin_class: "business",
        passengers: [{ type: "adult" }, { type: "adult" }],
      })
    );
  });

  it("returns cached offers without calling Duffel on a cache hit", async () => {
    (redis.get as any).mockResolvedValue(mockOfferRequest);

    const result = await caller.flights.searchOffers({
      origin: "LHR",
      destination: "JFK",
      departureDate: "2026-06-01",
      passengers: 1,
    });

    expect(result).toEqual(mockOfferRequest);
    expect(duffel.offerRequests.create).not.toHaveBeenCalled();
    expect(redis.set).not.toHaveBeenCalled();
  });

  it("writes the Duffel response to the cache on a miss", async () => {
    (duffel.offerRequests.create as any).mockResolvedValue({ data: mockOfferRequest });

    await caller.flights.searchOffers({
      origin: "LHR",
      destination: "JFK",
      departureDate: "2026-06-01",
      passengers: 1,
    });

    expect(duffel.offerRequests.create).toHaveBeenCalledTimes(1);
    expect(redis.set).toHaveBeenCalledTimes(1);
    const [key, value] = (redis.set as any).mock.calls[0];
    expect(key).toMatch(/^flight:search:/);
    expect(value).toEqual(mockOfferRequest);
  });
});

function makeOffer(id: string, totalAmount: string) {
  return { id, total_amount: totalAmount };
}

describe("flights.board", () => {
  const caller = appRouter.createCaller({});

  beforeEach(() => {
    vi.clearAllMocks();
    (isEnabled as any).mockReturnValue(true);
    (redis.get as any).mockResolvedValue(null);
    (redis.set as any).mockResolvedValue("OK");
  });

  it("fans out one Duffel call per destination and returns the cheapest offer per route", async () => {
    (duffel.offerRequests.create as any)
      .mockResolvedValueOnce({ data: { offers: [makeOffer("off_sfo", "210.00")] } })
      .mockResolvedValueOnce({ data: { offers: [makeOffer("off_lax", "198.00")] } });

    const result = await caller.flights.board({
      origin: "PHL",
      destinations: ["SFO", "LAX"],
      departureDate: "2026-08-01",
    });

    expect(duffel.offerRequests.create).toHaveBeenCalledTimes(2);
    expect(result).toEqual([makeOffer("off_sfo", "210.00"), makeOffer("off_lax", "198.00")]);
  });

  it("drops a route whose Duffel call rejects without affecting other routes", async () => {
    (duffel.offerRequests.create as any)
      .mockRejectedValueOnce(new Error("Duffel API unavailable"))
      .mockResolvedValueOnce({ data: { offers: [makeOffer("off_lax", "198.00")] } });

    const result = await caller.flights.board({
      origin: "PHL",
      destinations: ["SFO", "LAX"],
      departureDate: "2026-08-01",
    });

    expect(result).toEqual([makeOffer("off_lax", "198.00")]);
  });

  it("picks the lowest total_amount when a route returns multiple offers", async () => {
    (duffel.offerRequests.create as any).mockResolvedValue({
      data: { offers: [makeOffer("off_expensive", "500.00"), makeOffer("off_cheap", "150.00"), makeOffer("off_mid", "300.00")] },
    });

    const result = await caller.flights.board({
      origin: "PHL",
      destinations: ["SFO"],
      departureDate: "2026-08-01",
    });

    expect(result).toEqual([makeOffer("off_cheap", "150.00")]);
  });

  it("skips offers with missing or zero total_amount when finding the cheapest", async () => {
    (duffel.offerRequests.create as any).mockResolvedValue({
      data: { offers: [makeOffer("off_zero", "0"), { id: "off_missing" }, makeOffer("off_valid", "220.00")] },
    });

    const result = await caller.flights.board({
      origin: "PHL",
      destinations: ["SFO"],
      departureDate: "2026-08-01",
    });

    expect(result).toEqual([makeOffer("off_valid", "220.00")]);
  });

  it("returns the cached payload without calling Duffel on a cache hit", async () => {
    const cached = [makeOffer("off_cached", "199.00")];
    (redis.get as any).mockResolvedValue(cached);

    const result = await caller.flights.board({
      origin: "PHL",
      destinations: ["SFO"],
      departureDate: "2026-08-01",
    });

    expect(result).toEqual(cached);
    expect(duffel.offerRequests.create).not.toHaveBeenCalled();
    expect(redis.set).not.toHaveBeenCalled();
  });

  it("writes to the cache on a miss, even when the result is empty", async () => {
    (duffel.offerRequests.create as any).mockRejectedValue(new Error("Duffel API unavailable"));

    const result = await caller.flights.board({
      origin: "PHL",
      destinations: ["SFO"],
      departureDate: "2026-08-01",
    });

    expect(result).toEqual([]);
    expect(redis.set).toHaveBeenCalledTimes(1);
    const [key, value] = (redis.set as any).mock.calls[0];
    expect(key).toMatch(/^flight:board:/);
    expect(value).toEqual([]);
  });

  it("returns an empty array without calling Duffel when integration:duffel:flights is disabled", async () => {
    (isEnabled as any).mockImplementation((flag: string) => flag !== "integration:duffel:flights");

    const result = await caller.flights.board({
      origin: "PHL",
      destinations: ["SFO", "LAX"],
      departureDate: "2026-08-01",
    });

    expect(result).toEqual([]);
    expect(duffel.offerRequests.create).not.toHaveBeenCalled();
  });
});
