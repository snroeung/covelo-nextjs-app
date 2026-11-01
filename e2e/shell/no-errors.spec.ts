import { test, expect, type Page } from '@playwright/test';
import { MOBILE } from '../utils/mobile-helpers';

// No page may show an error to a member or log one in the browser. Database
// detail (function names, schema-cache messages) belongs in the server log.

const ROUTES = ['/search', '/discover', '/discover/board', '/offers', '/you', '/flights', '/hotels'];

/** Visible error banners, excluding Next's own (always-present) route announcer. */
async function errorBanners(page: Page): Promise<string[]> {
  return page.locator('[role="alert"]:not(#__next-route-announcer__)').evaluateAll((els) =>
    els.map((e) => (e.textContent ?? '').trim()).filter(Boolean),
  );
}

function watchConsole(page: Page) {
  const problems: string[] = [];
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const text = m.text();
    // Third-party map/ad/network noise is not an app error; the app's own failures are
    if (/favicon|Mapbox|mapbox|net::ERR|Failed to load resource/i.test(text)) return;
    problems.push(`console.error: ${text.slice(0, 300)}`);
  });
  return problems;
}

for (const [label, use] of [['phone', MOBILE], ['desktop', {}]] as const) {
  test.describe(`No errors on screen or in the console — ${label}`, () => {
    test.use(use);

    for (const route of ROUTES) {
      test(`${route} shows no error banner and logs no console error`, async ({ page }) => {
        const problems = watchConsole(page);
        await page.goto(route);
        await page.waitForLoadState('networkidle').catch(() => {});
        await page.waitForTimeout(1500); // let queries settle and any alert render

        expect(await errorBanners(page)).toEqual([]);
        await expect(page.getByText(/schema cache|Could not find the function|PGRST\d+/i)).toHaveCount(0);
        expect(problems).toEqual([]);
      });
    }

    test('the board filters, searching and sorting still show no error', async ({ page }) => {
      const problems = watchConsole(page);
      await page.goto('/discover/board?sort=new&type=offer');
      await page.getByLabel(/search posts/i).fill('transfer');
      await page.waitForTimeout(1500);
      expect(await errorBanners(page)).toEqual([]);
      expect(problems).toEqual([]);
    });
  });
}
