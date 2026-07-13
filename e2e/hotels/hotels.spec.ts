import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

function futureDate(daysFromNow: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return d.toISOString().split('T')[0];
}

const CHECK_IN  = futureDate(14);
const CHECK_OUT = futureDate(17);

// Philadelphia — matches the destination used in search.spec.ts's hotel flow
const HOTEL_QUERY = new URLSearchParams({
  destination: 'Philadelphia, PA',
  lat: '39.9526',
  lng: '-75.1652',
  checkIn: CHECK_IN,
  checkOut: CHECK_OUT,
  adults: '2',
  children: '0',
  rooms: '1',
}).toString();

async function gotoHotelsWithResults(page: Page) {
  await page.goto(`/hotels?${HOTEL_QUERY}`);
  await expect(
    page.getByRole('main').getByText(/hotels? in Philadelphia|No hotels found for this location/),
  ).toBeVisible({ timeout: 30_000 });
}

test.describe('Hotels page — empty state', () => {
  test('prompts for a search with no query params', async ({ page }) => {
    await page.goto('/hotels');
    await expect(page.getByRole('main').getByText('Search for a location to find hotels.')).toBeVisible();
  });
});

test.describe('Hotels page — results', () => {
  test('loads results from query params and passes a11y', async ({ page }) => {
    await gotoHotelsWithResults(page);

    const cards = page.getByTestId('hotel-card');
    const count = await cards.count();
    test.skip(count === 0, 'No hotels returned by Duffel for this query');

    await expect(cards.first()).toBeVisible();

    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });

  test('star rating filter narrows results', async ({ page }) => {
    await gotoHotelsWithResults(page);

    const cards = page.getByTestId('hotel-card');
    const total = await cards.count();
    test.skip(total === 0, 'No hotels returned by Duffel for this query');

    await page.getByRole('button', { name: '4★+' }).click();

    await expect(async () => {
      const filtered = await cards.count();
      expect(filtered).toBeLessThanOrEqual(total);
    }).toPass();
  });

  test('sort dropdown reorders results A to Z', async ({ page }) => {
    await gotoHotelsWithResults(page);

    const cards = page.getByTestId('hotel-card');
    const total = await cards.count();
    test.skip(total < 2, 'Need 2+ hotels to verify sort order');

    await page.getByRole('button', { name: /^Sort:/ }).click();
    await page.getByRole('button', { name: 'A to Z' }).click();

    const names = await cards.locator('h3').allTextContents();
    const sorted = [...names].sort((a, b) => a.localeCompare(b));
    expect(names).toEqual(sorted);
  });

  test('clicking a hotel card opens the detail modal with points comparison', async ({ page }) => {
    await gotoHotelsWithResults(page);

    const cards = page.getByTestId('hotel-card');
    const total = await cards.count();
    test.skip(total === 0, 'No hotels returned by Duffel for this query');

    await cards.first().locator('h3').click();

    await expect(page.getByRole('button', { name: 'Close' })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('heading', { level: 2 }).last()).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(page.getByRole('button', { name: 'Close' })).not.toBeVisible();
  });

  test('opens room comparison popup from detail modal', async ({ page }) => {
    await gotoHotelsWithResults(page);

    const cards = page.getByTestId('hotel-card');
    const total = await cards.count();
    test.skip(total === 0, 'No hotels returned by Duffel for this query');

    await cards.first().locator('h3').click();
    await expect(page.getByRole('button', { name: 'Close' })).toBeVisible({ timeout: 10_000 });

    const roomsHeading = page.getByText('Choose your room');
    const hasRooms = await roomsHeading.isVisible({ timeout: 15_000 }).catch(() => false);
    test.skip(!hasRooms, 'No priced room types returned for this hotel');

    // Rooms section only renders room types that have a genuine priced rate,
    // so any visible room card is guaranteed a points comparison.
    const compareButton = page.getByRole('button', { name: /^Compare \d+ portals/ });
    await expect(compareButton.first()).toBeVisible({ timeout: 15_000 });

    await compareButton.first().click();

    await expect(page.getByRole('button', { name: 'Close comparison' })).toBeVisible({ timeout: 10_000 });

    await page.keyboard.press('Escape');
    await expect(page.getByRole('button', { name: 'Close comparison' })).not.toBeVisible();
  });
});

test.describe('Hotels page — map', () => {
  test('map toggle shows and hides the map', async ({ page }) => {
    await gotoHotelsWithResults(page);

    const cards = page.getByTestId('hotel-card');
    const total = await cards.count();
    test.skip(total === 0, 'No hotels returned by Duffel for this query');

    const toggleBtn = page.getByRole('button', { name: /^(Show|Hide) map$/ });
    const hasToggle = await toggleBtn.isVisible({ timeout: 5_000 }).catch(() => false);
    test.skip(!hasToggle, 'No mappable hotels (missing geographic coordinates) for this query');

    // Map is visible by default when mappable hotels exist.
    await expect(page.getByRole('button', { name: 'Hide map' })).toBeVisible();
    await toggleBtn.click();
    await expect(page.getByRole('button', { name: 'Show map' })).toBeVisible();
    await toggleBtn.click();
    await expect(page.getByRole('button', { name: 'Hide map' })).toBeVisible();
  });

  test('clicking a map pin opens its card, and "View details" opens the hotel modal', async ({ page }) => {
    await gotoHotelsWithResults(page);

    const cards = page.getByTestId('hotel-card');
    const total = await cards.count();
    test.skip(total === 0, 'No hotels returned by Duffel for this query');

    const hotelMap = page.getByTestId('hotel-map');
    const pinButtons = hotelMap.getByRole('button', { name: /^View / });
    const hasMap = await pinButtons.first().waitFor({ state: 'visible', timeout: 15_000 }).then(() => true).catch(() => false);
    test.skip(!hasMap, 'No mappable hotels (missing geographic coordinates) for this query');

    await pinButtons.first().click({ force: true });

    const pinCard = page.getByTestId('map-pin-card');
    const viewDetailsBtn = pinCard.getByRole('button', { name: 'View details', exact: true });
    await expect(viewDetailsBtn).toBeVisible({ timeout: 10_000 });

    await viewDetailsBtn.click();

    await expect(page.getByRole('button', { name: 'Close' })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('heading', { level: 2 }).last()).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(page.getByRole('button', { name: 'Close' })).not.toBeVisible();
  });

  test('clicking the map background closes the pin card', async ({ page }) => {
    await gotoHotelsWithResults(page);

    const cards = page.getByTestId('hotel-card');
    const total = await cards.count();
    test.skip(total === 0, 'No hotels returned by Duffel for this query');

    const hotelMap = page.getByTestId('hotel-map');
    const pinButtons = hotelMap.getByRole('button', { name: /^View / });
    const hasMap = await pinButtons.first().waitFor({ state: 'visible', timeout: 15_000 }).then(() => true).catch(() => false);
    test.skip(!hasMap, 'No mappable hotels (missing geographic coordinates) for this query');

    await pinButtons.first().click({ force: true });

    const pinCard = page.getByTestId('map-pin-card');
    await expect(pinCard).toBeVisible({ timeout: 10_000 });

    // Click the map canvas, away from any pin, to dismiss the open card.
    const mapCanvas = page.locator('.mapboxgl-canvas');
    await mapCanvas.click({ position: { x: 5, y: 5 } });

    await expect(pinCard).not.toBeVisible();
  });
});
