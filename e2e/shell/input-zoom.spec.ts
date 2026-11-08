import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { MOBILE } from '../utils/mobile-helpers';

// iOS Safari zooms in on a focused control under 16px and stays zoomed after
// blur. Every visible text control on a phone must therefore be ≥16px.

const ROUTES = ['/search', '/hotels', '/flights', '/discover/board', '/offers'];

const CONTROLS =
  'input:not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="color"]):not([type="file"]):not([type="hidden"]), textarea, select, [contenteditable="true"]';

async function controlFontSizes(page: Page) {
  return page.locator(CONTROLS).evaluateAll((els) =>
    els
      .filter((e) => (e as HTMLElement).offsetParent !== null)
      .map((e) => ({
        id: e.id || e.getAttribute('name') || e.getAttribute('placeholder') || e.tagName,
        px: parseFloat(getComputedStyle(e).fontSize),
      })),
  );
}

test.describe('Form controls do not trigger focus zoom — phone', () => {
  test.use(MOBILE);

  for (const route of ROUTES) {
    test(`${route} text controls are at least 16px`, async ({ page }) => {
      await page.goto(route);
      await page.waitForLoadState('networkidle').catch(() => {});

      const sizes = await controlFontSizes(page);
      expect(sizes.filter((s) => s.px < 16)).toEqual([]);

      const results = await new AxeBuilder({ page }).analyze();
      expect(results.violations).toEqual([]);
    });
  }

  test('viewport keeps pinch zoom available', async ({ page }) => {
    await page.goto('/search');
    const content = await page.locator('meta[name="viewport"]').getAttribute('content');
    expect(content).not.toMatch(/maximum-scale|user-scalable=no/);
  });
});

test.describe('Form controls keep their own size — desktop', () => {
  test('/hotels controls are not forced to 16px', async ({ page }) => {
    await page.goto('/hotels');
    await page.waitForLoadState('networkidle').catch(() => {});
    const sizes = await controlFontSizes(page);
    expect(sizes.length).toBeGreaterThan(0);
    expect(sizes.some((s) => s.px < 16)).toBe(true);
  });
});
