import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

function futureDate(daysFromNow: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return d.toISOString().split('T')[0];
}

const FLIGHT_QUERY = new URLSearchParams({
  origin: 'PHL',
  originName: 'Philadelphia International Airport',
  destinationCode: 'SFO',
  destination: 'San Francisco International Airport',
  tripType: 'roundtrip',
  departDate: futureDate(21),
  returnDate: futureDate(28),
  adults: '1',
  cabinClass: 'economy',
}).toString();

/** Hold every matching tRPC call for `ms`, then let it through, so the loading state stays on screen. */
async function slowTrpc(page: Page, procedure: string, ms = 4_000) {
  await page.route(`**/api/trpc/${procedure}*`, async (route) => {
    await new Promise((r) => setTimeout(r, ms));
    await route.continue().catch(() => {});
  });
}

async function expectAxeClean(page: Page) {
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
}

test.describe('Loading states', () => {
  test('flights: route loader shows and the search fields lock while searching', async ({ page }) => {
    await slowTrpc(page, 'flights.searchOffers');
    await page.goto(`/flights?${FLIGHT_QUERY}`);

    await expect(page.getByRole('status').filter({ hasText: 'Loading flights' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Searching…' })).toBeDisabled();
    await expect(page.locator('fieldset[aria-busy="true"]')).toBeVisible();
    await expect(page.locator('fieldset[aria-busy="true"] input').first()).toBeDisabled();
    await expect(page.getByTestId('cards-sidebar')).toHaveAttribute('data-collapsed', 'true');
    await expectAxeClean(page);

    // Unlocks once results (or an empty/failed state) land
    await expect(page.locator('fieldset[aria-busy="true"]')).toHaveCount(0, { timeout: 40_000 });
    await expect(page.getByTestId('cards-sidebar')).toHaveAttribute('data-collapsed', 'false');
  });

  test('hotels: stay loader shows while searching', async ({ page }) => {
    await slowTrpc(page, 'stays.search');
    await page.goto(`/hotels?${new URLSearchParams({ lat: '39.9526', lng: '-75.1652', destination: 'Philadelphia', checkIn: futureDate(21), checkOut: futureDate(23), guests: '2' })}`);
    await expect(page.getByRole('status').filter({ hasText: 'Loading hotels' })).toBeVisible();
    await expectAxeClean(page);
  });

  test('offers: list loader shows while offers load', async ({ page }) => {
    await slowTrpc(page, 'offers.*');
    await page.goto('/offers');
    await expect(page.getByRole('status').filter({ hasText: 'Loading offers' })).toBeVisible();
    await expectAxeClean(page);
  });

  test('discover: lead + grid loader shows while offers load', async ({ page }) => {
    await slowTrpc(page, 'offers.*');
    await page.goto('/discover');
    await expect(page.getByRole('status').filter({ hasText: 'Loading offers' })).toBeVisible();
    await expectAxeClean(page);
  });

  test('flights: loader respects reduced motion (static first status line)', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await slowTrpc(page, 'flights.searchOffers');
    await page.goto(`/flights?${FLIGHT_QUERY}`);
    await expect(page.getByRole('status').filter({ hasText: 'Loading flights' })).toBeVisible();
    await expect(page.getByText('SEARCHING AIRLINES…')).toBeVisible();
  });
});
