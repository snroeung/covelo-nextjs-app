import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { UpstreamTimeoutError, withTimeout } from "@/lib/withTimeout";

describe("withTimeout", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("passes through a result that arrives in time and clears its timer", async () => {
    const p = withTimeout(Promise.resolve(42), 1000, "x");
    await expect(p).resolves.toBe(42);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("passes through the original error", async () => {
    await expect(withTimeout(Promise.reject(new Error("boom")), 1000, "x")).rejects.toThrow("boom");
    expect(vi.getTimerCount()).toBe(0);
  });

  it("rejects with UpstreamTimeoutError when the promise never settles", async () => {
    const p = withTimeout(new Promise(() => {}), 15_000, "duffel.stays");
    const assertion = expect(p).rejects.toThrow(UpstreamTimeoutError);
    await vi.advanceTimersByTimeAsync(15_000);
    await assertion;
    await expect(p).rejects.toThrow("duffel.stays timed out after 15000ms");
  });

  it("does not raise an unhandled rejection when the abandoned promise fails late", async () => {
    let fail!: (e: Error) => void;
    const slow = new Promise((_, reject) => (fail = reject));
    const p = withTimeout(slow, 100, "x");
    const assertion = expect(p).rejects.toThrow(UpstreamTimeoutError);
    await vi.advanceTimersByTimeAsync(100);
    await assertion;
    fail(new Error("ECONNRESET")); // arrives after we stopped waiting
    await vi.advanceTimersByTimeAsync(0);
  });
});
