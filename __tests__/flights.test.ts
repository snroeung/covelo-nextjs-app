import { appRouter } from "@/server/routers/_app";

jest.mock("@/lib/duffel", () => ({
  duffel: {
    offerRequests: {
      create: jest.fn(),
    },
  },
}));

import { duffel } from "@/lib/duffel";

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
    jest.clearAllMocks();
  });

  it("returns an offer request for a one-way flight search", async () => {
    (duffel.offerRequests.create as jest.Mock).mockResolvedValue({
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
      slices: [{ origin: "LHR", destination: "JFK", departure_date: "2026-06-01" }],
      passengers: [{ type: "adult" }],
      cabin_class: "economy",
    });
  });

  it("throws when the Duffel API fails", async () => {
    (duffel.offerRequests.create as jest.Mock).mockRejectedValue(
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
    (duffel.offerRequests.create as jest.Mock).mockResolvedValue({
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
});
