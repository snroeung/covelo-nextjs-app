/** How long a Duffel search may take before we stop waiting. Normal searches finish in 1–4 s. */
export const DUFFEL_TIMEOUT_MS = 15_000;

export class UpstreamTimeoutError extends Error {
  constructor(label: string, ms: number) {
    super(`${label} timed out after ${ms}ms`);
    this.name = "UpstreamTimeoutError";
  }
}

/**
 * Rejects with UpstreamTimeoutError if `promise` has not settled within `ms`. For SDKs that expose
 * no timeout or abort option (Duffel): the underlying request keeps running, but the caller stops
 * waiting instead of hanging until the OS resets the connection. A late result or error from the
 * abandoned promise is swallowed by the race.
 */
export function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new UpstreamTimeoutError(label, ms)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}
