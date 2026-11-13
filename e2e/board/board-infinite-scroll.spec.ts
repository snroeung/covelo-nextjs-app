import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { MOBILE, expectNoHorizontalScroll } from '../utils/mobile-helpers';
import { seedTipPosts, type SeededTips } from '../utils/board-seed';

// 27 real posts sharing one search token; the feed loads 20 at a time, so there is one more batch (7).
const TOTAL = 27;
const FIRST_BATCH = 20;

let seeded: SeededTips;
test.beforeAll(async () => { seeded = await seedTipPosts(TOTAL); });
test.afterAll(async () => { await seeded?.cleanup(); });

const board = (page: Page) => page.goto(`/discover/board?q=${seeded.token}`);
const cards = (page: Page) => page.locator('section[aria-label="Posts"] > ul > li');
const loadingMore = (page: Page) => page.getByRole('status').filter({ hasText: 'Loading more posts' });
const isLaterBatch = (url: string) => decodeURIComponent(url).includes('"cursor":"');

/** Holds back the request for the next batch, so the loading state can be seen. */
async function slowNextBatch(page: Page, ms: number) {
  await page.route(/board\.posts\.list/, async (route) => {
    if (isLaterBatch(route.request().url())) await new Promise((r) => setTimeout(r, ms));
    await route.continue();
  });
}

test.describe('The board — infinite scroll', () => {
  test('loads the first batch, then the next one on its own when the end comes into view', async ({ page }) => {
    await board(page);
    await expect(cards(page)).toHaveCount(FIRST_BATCH);
    await cards(page).last().scrollIntoViewIfNeeded();
    await expect(cards(page)).toHaveCount(TOTAL);
  });

  test('shows a loading animation while the next batch is on its way, and not afterwards', async ({ page }) => {
    await slowNextBatch(page, 1500);
    await board(page);
    await expect(cards(page)).toHaveCount(FIRST_BATCH);

    await cards(page).last().scrollIntoViewIfNeeded();
    await expect(loadingMore(page)).toBeVisible();
    await expect(page.locator('.cv-sk').first()).toBeVisible();
    await expect(cards(page)).toHaveCount(TOTAL);
    await expect(loadingMore(page)).toHaveCount(0);
  });

  test('says so when there is nothing more, and stops asking', async ({ page }) => {
    let laterBatches = 0;
    await page.route(/board\.posts\.list/, async (route) => {
      if (isLaterBatch(route.request().url())) laterBatches += 1;
      await route.continue();
    });
    await board(page);
    await cards(page).last().scrollIntoViewIfNeeded();
    await expect(cards(page)).toHaveCount(TOTAL);
    await expect(page.getByText('You’re all caught up.')).toBeVisible();

    await page.mouse.wheel(0, 4000);
    await page.waitForTimeout(500);
    expect(laterBatches).toBe(1);
  });

  test('a failed batch offers Try again instead of retrying forever, and Try again works', async ({ page }) => {
    // The client retries a failed request once by itself, so keep failing until the member asks
    let failing = true;
    await page.route(/board\.posts\.list/, async (route) => {
      if (failing && isLaterBatch(route.request().url())) {
        await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify([{ error: { message: 'boom', code: -32603, data: { code: 'INTERNAL_SERVER_ERROR', httpStatus: 500 } } }]) });
        return;
      }
      await route.continue();
    });
    await board(page);
    await cards(page).last().scrollIntoViewIfNeeded();

    await expect(page.getByText('Couldn’t load more posts.')).toBeVisible({ timeout: 10_000 });
    await expect(cards(page)).toHaveCount(FIRST_BATCH);
    await expect(loadingMore(page)).toHaveCount(0);

    failing = false;
    await page.getByRole('button', { name: 'Try again' }).click();
    await expect(cards(page)).toHaveCount(TOTAL);
  });

  test('a short feed shows no loading animation and no retry', async ({ page }) => {
    await page.goto('/discover/board?q=zzznosuchpostzzz');
    await expect(page.getByText(/No posts match/)).toBeVisible();
    await expect(loadingMore(page)).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Try again' })).toHaveCount(0);
  });

  test('passes accessibility checks while loading more and once everything is loaded', async ({ page }) => {
    await slowNextBatch(page, 1200);
    await board(page);
    await cards(page).last().scrollIntoViewIfNeeded();
    await expect(loadingMore(page)).toBeVisible();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);

    await expect(cards(page)).toHaveCount(TOTAL);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  });

  test.describe('on a phone', () => {
    test.use({ viewport: MOBILE.viewport });

    test('loads more on scroll and the page cannot drag sideways', async ({ page }) => {
      await board(page);
      await expect(cards(page)).toHaveCount(FIRST_BATCH);
      await cards(page).last().scrollIntoViewIfNeeded();
      await expect(cards(page)).toHaveCount(TOTAL);
      await expectNoHorizontalScroll(page);
    });
  });
});
