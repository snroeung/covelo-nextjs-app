import { test, expect, type Page } from '@playwright/test';
import { seedTipPosts, type SeededTips } from '../utils/board-seed';

// 27 real posts, loaded 20 at a time: opening one near the bottom means 2 batches were loaded.
const TOTAL = 27;
const FIRST_BATCH = 20;
const TOLERANCE_PX = 60;

let seeded: SeededTips;
test.beforeAll(async () => { seeded = await seedTipPosts(TOTAL); });
test.afterAll(async () => { await seeded?.cleanup(); });

const feedUrl = () => `/discover/board?q=${seeded.token}`;
const cards = (page: Page) => page.locator('section[aria-label="Posts"] > ul > li');
const scrollY = (page: Page) => page.evaluate(() => Math.round(window.scrollY));
const expectScrollNear = (page: Page, y: number) =>
  expect.poll(async () => Math.abs((await scrollY(page)) - y), { timeout: 10_000 }).toBeLessThan(TOLERANCE_PX);

/** Loads every batch, then parks on a post near the bottom. Returns where we are and the post's link. */
async function scrollDeep(page: Page) {
  await page.goto(feedUrl());
  await expect(cards(page)).toHaveCount(FIRST_BATCH);
  await cards(page).last().scrollIntoViewIfNeeded();
  await expect(cards(page)).toHaveCount(TOTAL);
  const target = cards(page).nth(TOTAL - 4);
  await target.scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  return { y: await scrollY(page), link: target.locator('h2 a') };
}

const onPost = (page: Page) => expect(page).toHaveURL(/\/discover\/board\/[0-9a-f-]{36}/);

test.describe('The board — returning to where you were', () => {
  test('Back from a post returns to the same place with the same posts', async ({ page }) => {
    const { y, link } = await scrollDeep(page);
    expect(y).toBeGreaterThan(1000);
    await link.click();
    await onPost(page);

    await page.goBack();
    await expect(cards(page)).toHaveCount(TOTAL);
    await expectScrollNear(page, y);
  });

  test('Back still works after the page was reloaded on the post and nothing is cached', async ({ page }) => {
    const { y, link } = await scrollDeep(page);
    await link.click();
    await onPost(page);
    await page.reload();
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    await page.goBack();
    // A fresh page only has the first batch, so the second is fetched before the scroll is restored
    await expect(cards(page)).toHaveCount(TOTAL, { timeout: 15_000 });
    await expectScrollNear(page, y);
  });

  test('"The board" on the post returns to the same place', async ({ page }) => {
    const { y, link } = await scrollDeep(page);
    await link.click();
    await onPost(page);

    await page.getByRole('link', { name: 'The board' }).first().click();
    await expect(page).toHaveURL(new RegExp(`q=${seeded.token}`));
    await expect(cards(page)).toHaveCount(TOTAL);
    await expectScrollNear(page, y);
  });

  test('reloading the feed keeps your place too', async ({ page }) => {
    const { y } = await scrollDeep(page);
    await page.reload();
    await expect(cards(page)).toHaveCount(TOTAL, { timeout: 15_000 });
    await expectScrollNear(page, y);
  });

  test('a plain visit to the board still starts at the top', async ({ page }) => {
    const { link } = await scrollDeep(page);
    await link.click();
    await onPost(page);

    await page.goto(feedUrl());
    await expect(cards(page)).toHaveCount(FIRST_BATCH);
    expect(await scrollY(page)).toBeLessThan(20);
  });

  test('a feed left at the top opens at the top', async ({ page }) => {
    await page.goto(feedUrl());
    await expect(cards(page)).toHaveCount(FIRST_BATCH);
    await cards(page).first().locator('h2 a').click();
    await onPost(page);

    await page.goBack();
    await expect(cards(page).first()).toBeVisible();
    expect(await scrollY(page)).toBeLessThan(20);
    await expect(cards(page)).toHaveCount(FIRST_BATCH);
  });

  test.describe('on a phone', () => {
    test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

    test('Back from a post returns to the same place', async ({ page }) => {
      const { y, link } = await scrollDeep(page);
      await link.click();
      await onPost(page);
      await page.goBack();
      await expect(cards(page)).toHaveCount(TOTAL);
      await expectScrollNear(page, y);
    });
  });
});
