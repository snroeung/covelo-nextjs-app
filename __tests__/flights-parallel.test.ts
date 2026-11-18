import { vi, beforeEach, describe, it, expect, type Mock } from "vitest";

vi.mock("@/lib/duffel", () => ({ duffel: { offerRequests: { create: vi.fn() } } }));
vi.mock("@/lib/redis", () => ({ redis: { get: vi.fn(), set: vi.fn() } }));
vi.mock("@/lib/feature-flags", () => ({ isEnabled: vi.fn(() => true) }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

import { duffel } from "@/lib/duffel";
import { redis } from "@/lib/redis";
import { createClient } from "@/lib/supabase/server";
import { appRouter } from "@/server/routers/_app";

function collectionsBuilder(rows: unknown[]) {
  const b: Record<string, unknown> = {};
  for (const m of ["select", "eq", "in"]) b[m] = vi.fn().mockReturnValue(b);
  b.then = (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) =>
    Promise.resolve({ data: rows, error: null }).then(resolve, reject);
  return b;
}

const INPUT = { origin: "JFK", destination: "LAX", departureDate: "2027-01-17", passengers: 1 };

describe("flights.searchOffers — travel_collections runs alongside Duffel", () => {
  const caller = appRouter.createCaller({});

  beforeEach(() => {
    vi.clearAllMocks();
    (redis.get as Mock).mockResolvedValue(null);
    (redis.set as Mock).mockResolvedValue("OK");
  });

  it("starts the collections query before Duffel has answered", async () => {
    const from = vi.fn().mockReturnValue(collectionsBuilder([]));
    (createClient as Mock).mockResolvedValue({ from });

    let resolveDuffel!: (v: unknown) => void;
    (duffel.offerRequests.create as Mock).mockReturnValue(new Promise((r) => (resolveDuffel = r)));

    const pending = caller.flights.searchOffers(INPUT);
    await vi.waitFor(() => expect(from).toHaveBeenCalledWith("travel_collections"));
    // Duffel is still in flight, yet the lookup has already happened
    expect(duffel.offerRequests.create).toHaveBeenCalledTimes(1);

    resolveDuffel({ data: { id: "orq_1", offers: [] } });
    await expect(pending).resolves.toMatchObject({ id: "orq_1", offers: [] });
  });

  it("still returns Duffel's offers when the collections lookup fails", async () => {
    (createClient as Mock).mockRejectedValue(new Error("supabase down"));
    (duffel.offerRequests.create as Mock).mockResolvedValue({ data: { id: "orq_2", offers: [] } });

    await expect(caller.flights.searchOffers(INPUT)).resolves.toMatchObject({ id: "orq_2" });
  });

  it("does not leave an unhandled rejection when Duffel fails first", async () => {
    (createClient as Mock).mockRejectedValue(new Error("supabase down"));
    (duffel.offerRequests.create as Mock).mockRejectedValue(new Error("duffel down"));

    await expect(caller.flights.searchOffers(INPUT)).rejects.toThrow("duffel down");
  });
});
