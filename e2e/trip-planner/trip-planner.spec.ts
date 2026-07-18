import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { createTestTrip, deleteTestTrip } from '../utils/admin-helpers';

// Pin-tab buttons carry `title={pin.label}`; the remove-pin button is the
// only other `title`-bearing button in the map, so exclude it by value.
function pinTabs(page: Page) {
  return page.locator('button[title]:not([title="Remove pin"])');
}

test.describe.serial('Trip planner detail page', () => {
  let tripUrl: string | null = null;

  test.afterAll(async ({ browser }) => {
    // browser.newPage() has no project storageState — open an authenticated
    // context explicitly so cleanup can navigate /trip-planner regardless of
    // whether earlier tests passed or failed.
    const context = await browser.newContext({ storageState: 'e2e/.auth/admin.json' });
    const page = await context.newPage();
    await deleteTestTrip(page);
    await context.close();
  });

  test('creates a new test trip', async ({ page }) => {
    tripUrl = await createTestTrip(page);
    expect(tripUrl).toBeTruthy();
  });

  test('loads and passes accessibility checks', async ({ page }) => {
    test.skip(!tripUrl, 'Trip was not created');
    await page.goto(tripUrl!);
    await expect(page.getByRole('heading', { name: /Itinerary/ })).toBeVisible();

    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });

  test('clicking the destination pin opens its card, and clicking the map background closes it', async ({ page }) => {
    test.skip(!tripUrl, 'Trip was not created');
    await page.goto(tripUrl!);

    const tabs = pinTabs(page);
    await tabs.first().waitFor({ state: 'visible', timeout: 15_000 });
    await tabs.first().click();

    const pinCard = page.getByTestId('map-pin-card');
    await expect(pinCard).toBeVisible({ timeout: 10_000 });
    await expect(pinCard.getByRole('button', { name: 'Add to trip' })).toBeVisible();

    const mapCanvas = page.locator('.mapboxgl-canvas').first();
    await mapCanvas.click({ position: { x: 5, y: 5 } });
    await expect(pinCard).not.toBeVisible();
  });

  test('switching between pins shows each pin\'s own data, not the previously selected pin\'s', async ({ page }) => {
    test.skip(!tripUrl, 'Trip was not created');
    await page.goto(tripUrl!);

    const tabs = pinTabs(page);
    await tabs.first().waitFor({ state: 'visible', timeout: 15_000 });
    const defaultLabel = await tabs.first().getAttribute('title');

    // Add a second, unrelated pin via map search.
    const searchInput = page.getByPlaceholder('Search location to add pin…');
    await searchInput.fill('Eiffel Tower');
    const firstResult = page.getByRole('button').filter({ hasText: /Eiffel/i }).first();
    await firstResult.waitFor({ state: 'visible', timeout: 10_000 });
    await firstResult.click();

    const pinCard = page.getByTestId('map-pin-card');
    await expect(pinCard).toBeVisible({ timeout: 10_000 });
    await expect(pinCard).toContainText(/Eiffel/i);

    await expect(tabs).toHaveCount(2);

    // Switch back to the original pin — its card must show its own data, not Eiffel Tower's.
    await tabs.first().click();
    await expect(pinCard).toBeVisible({ timeout: 10_000 });
    await expect(pinCard).not.toContainText(/Eiffel/i);

    // Switch forward again — must show Eiffel Tower's data again, not the default pin's.
    await tabs.last().click();
    await expect(pinCard).toContainText(/Eiffel/i, { timeout: 10_000 });
    if (defaultLabel) await expect(pinCard).not.toContainText(defaultLabel);
  });

  test('"Add to trip" adds the pin as an unscheduled activity', async ({ page }) => {
    test.skip(!tripUrl, 'Trip was not created');
    await page.goto(tripUrl!);

    const tabs = pinTabs(page);
    await tabs.first().waitFor({ state: 'visible', timeout: 15_000 });
    await tabs.first().click();

    const pinCard = page.getByTestId('map-pin-card');
    await expect(pinCard).toBeVisible({ timeout: 10_000 });
    await pinCard.getByRole('button', { name: 'Add to trip' }).click();

    await expect(page.getByText('Things to Do · not yet scheduled')).toBeVisible({ timeout: 10_000 });
  });
});
