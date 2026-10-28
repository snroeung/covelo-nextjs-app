import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { seedMemberOfferPost, setSeededOfferEnd, type SeededMemberOffer } from '../utils/board-seed';

// "Saved posts" beside "New post": a member's saved list, in a dropdown (a bottom
// sheet on a phone). Offer posts whose offer has ended leave it. Each test seeds
// its own live offer post (unique title) and removes it afterwards.

let seeded: SeededMemberOffer;
const token = () => seeded.title.split(' ').pop()!;

test.beforeEach(async () => { seeded = await seedMemberOfferPost(); });
test.afterEach(async () => { await seeded.cleanup(); });

/** Click Save until the card says Saved (an early click can land before hydration; never un-save by clicking twice). */
async function saveCard(card: ReturnType<Page['locator']>) {
  await expect(async () => {
    if (await card.getByRole('button', { name: 'Save', exact: true }).isVisible()) await card.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(card.getByRole('button', { name: 'Saved' })).toBeVisible({ timeout: 1500 });
  }).toPass({ timeout: 15_000 });
}

async function findPostCard(page: Page) {
  await page.goto(`/discover/board?q=${token()}`);
  const card = page.locator('article').filter({ hasText: seeded.title });
  await expect(card).toBeVisible();
  return card;
}
const savedButton = (page: Page) => page.getByRole('button', { name: 'Saved posts', exact: true });
const savedPanel = (page: Page) => page.getByRole('region', { name: 'Saved posts' });
// The e2e account may have other saved posts: look only at the seeded one
const seededLink = (page: Page) => savedPanel(page).getByRole('link', { name: new RegExp(token()) });
/** The first click can land before the page has hydrated, so retry until the list is up (never double-toggle). */
async function openSaved(page: Page) {
  await expect(async () => {
    if (!(await savedPanel(page).isVisible())) await savedButton(page).click();
    await expect(savedPanel(page)).toBeVisible({ timeout: 1500 });
  }).toPass({ timeout: 15_000 });
}
const loaded = (page: Page) => expect(savedPanel(page).getByLabel('Loading saved posts')).toHaveCount(0);

test.describe('The board — saved posts', () => {
  test('1. a "Saved posts" button sits beside "New post"', async ({ page }) => {
    await page.goto('/discover/board');
    await expect(savedButton(page)).toBeVisible();
    await expect(page.getByRole('button', { name: 'New post' })).toBeVisible();
  });

  test('2. a saved post shows in the list, and removing it there unsaves it', async ({ page }) => {
    const card = await findPostCard(page);
    await saveCard(card);

    await openSaved(page);
    await expect(seededLink(page)).toBeVisible();

    await savedPanel(page).getByRole('button', { name: new RegExp(`^Remove .*${token()}.* from saved$`) }).click();
    await expect(seededLink(page)).toHaveCount(0);
    await expect(card.getByRole('button', { name: 'Save', exact: true })).toBeVisible();
  });

  test('3. an offer that has expired drops off the saved list and the board', async ({ page }) => {
    const card = await findPostCard(page);
    await saveCard(card);

    await openSaved(page);
    await expect(seededLink(page)).toBeVisible();
    await page.keyboard.press('Escape');

    // The offer ends yesterday
    const yesterday = new Date(Date.now() - 24 * 3600 * 1000).toISOString().slice(0, 10);
    await setSeededOfferEnd(seeded.memberOfferId, yesterday);

    await page.reload();
    await openSaved(page);
    await loaded(page);
    await expect(seededLink(page)).toHaveCount(0);
    await page.keyboard.press('Escape');

    await page.goto(`/discover/board?q=${token()}`);
    await expect(page.locator('article').filter({ hasText: seeded.title })).toHaveCount(0);
    // A direct link still opens the post
    await page.goto(`/discover/board/${seeded.postId}`);
    await expect(page.getByRole('heading', { level: 1, name: seeded.title })).toBeVisible();
  });

  test('4. the list closes on Escape and passes accessibility checks', async ({ page }) => {
    await page.goto('/discover/board');
    await openSaved(page);
    const results = await new AxeBuilder({ page }).include('[aria-label="Saved posts"]').analyze();
    expect(results.violations).toEqual([]);
    await page.keyboard.press('Escape');
    await expect(savedPanel(page)).toBeHidden();
  });

  test('5. on a phone it is a bottom sheet that fits the screen', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto('/discover/board');
    await openSaved(page);
    const box = await savedPanel(page).boundingBox();
    expect(box!.width).toBeLessThanOrEqual(375);
    expect(box!.y + box!.height).toBeLessThanOrEqual(800 + 1);
  });
});

test.describe('The board — saved posts, signed out', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('6. a visitor is asked to sign in instead of seeing a list', async ({ page }) => {
    await page.goto('/discover/board');
    await savedButton(page).click();
    await expect(page.getByText('Sign in to see your saved posts')).toBeVisible();
    await expect(savedPanel(page)).toHaveCount(0);
  });
});
