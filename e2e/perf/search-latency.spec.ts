import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// Search latency journeys: hotels, flights, board. Each runs twice on the same URL — the first run
// uses dates picked at random so the server-side cache is cold, the second repeats it and should
// be served from cache. Prints one line per call (wire time and, outside production, the
// Server-Timing breakdown) and attaches the numbers to the report.
//
//   npm run test:e2e -- e2e/perf/                          local, signed in as the e2e admin
//   PERF_BASE_URL=https://<preview-host> npm run test:e2e -- e2e/perf/   a deployed preview, signed out
//
// Preview runs need the local app up too: global-setup signs the e2e admin in against it. A
// production deployment sends no Server-Timing; compare wire times, or read its Vercel traces.

const REMOTE = process.env.PERF_BASE_URL;
if (REMOTE) test.use({ baseURL: REMOTE, storageState: { cookies: [], origins: [] } });

/** Longest any search may take before we call it hung. The Duffel calls give up after 15 s. */
const HUNG_MS = 25_000;

function isoDay(offsetDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().split('T')[0];
}

/** 30–89 days out, so a first run is unlikely to hit a cache entry left by an earlier run. */
const offset = 30 + Math.floor(Math.random() * 60);

interface Journey {
  name: string;
  url: string;
  call: RegExp;
  /** The page's own sign that it finished rendering the result. */
  settled: (page: Page) => Promise<unknown>;
}

const JOURNEYS: Journey[] = [
  {
    name: 'hotels',
    url: `/hotels?${new URLSearchParams({
      destination: 'Philadelphia, PA', lat: '39.9526', lng: '-75.1652',
      checkIn: isoDay(offset), checkOut: isoDay(offset + 3), adults: '2', children: '0', rooms: '1',
    })}`,
    call: /\/api\/trpc\/stays\.search/,
    settled: (page) =>
      expect(page.getByRole('main').getByText(/hotels? in Philadelphia|No hotels found for this location/)).toBeVisible({ timeout: HUNG_MS }),
  },
  {
    name: 'flights',
    url: `/flights?${new URLSearchParams({
      origin: 'PHL', originName: 'Philadelphia International Airport',
      destinationCode: 'SFO', destination: 'San Francisco International Airport',
      tripType: 'oneway', departDate: isoDay(offset), adults: '1', cabinClass: 'economy',
    })}`,
    call: /\/api\/trpc\/flights\.searchOffers/,
    settled: (page) => page.waitForLoadState('networkidle', { timeout: HUNG_MS }),
  },
  {
    name: 'board',
    url: '/discover/board',
    call: /board\.posts\.list/,
    settled: (page) => page.waitForLoadState('networkidle', { timeout: HUNG_MS }),
  },
];

async function run(page: Page, journey: Journey) {
  const started = Date.now();
  const [res] = await Promise.all([
    page.waitForResponse((r) => journey.call.test(r.url()), { timeout: HUNG_MS }),
    page.goto(journey.url),
  ]);
  await res.finished();
  await journey.settled(page);
  return {
    pageMs: Date.now() - started,
    wireMs: Math.round(res.request().timing().responseEnd),
    status: res.status(),
    serverTiming: (await res.headerValue('server-timing')) ?? '(none: production, or no spans)',
  };
}

for (const journey of JOURNEYS) {
  test.describe(`Search latency — ${journey.name}`, () => {
    test('first run, then the same search again', async ({ page }, testInfo) => {
      const first = await run(page, journey);
      const second = await run(page, journey);

      for (const [label, r] of [['first', first], ['repeat', second]] as const) {
        console.log(`[perf-e2e] ${journey.name} ${label}: page ${r.pageMs} ms, call ${r.wireMs} ms (HTTP ${r.status})\n    ${r.serverTiming}`);
      }
      await testInfo.attach(`${journey.name}-timings.json`, {
        body: JSON.stringify({ first, repeat: second }, null, 2),
        contentType: 'application/json',
      });

      // Not a speed budget (CI hardware and Duffel vary): only that nothing hangs and nothing errors.
      expect(first.status).toBe(200);
      expect(second.status).toBe(200);
      expect(first.wireMs).toBeLessThan(HUNG_MS);
      expect(second.wireMs).toBeLessThan(HUNG_MS);

      const results = await new AxeBuilder({ page }).analyze();
      expect(results.violations).toEqual([]);
    });
  });
}
