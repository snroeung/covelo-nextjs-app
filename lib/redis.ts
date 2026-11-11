import { Redis } from '@upstash/redis';

/** Per-request cap. Caching is best-effort: a slow or unreachable Redis must cost milliseconds, not seconds. */
export const REDIS_TIMEOUT_MS = 2000;

export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  // The default (5 retries with exponential backoff) turned one unreachable Redis into ~4 s per call
  retry: false,
  signal: () => AbortSignal.timeout(REDIS_TIMEOUT_MS),
});
