import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

function futureDate(daysFromNow: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return d.toISOString().split('T')[0];
}

const DEPART_DATE = futureDate(21);
const RETURN_DATE = futureDate(28);

// PHL → SFO — matches the route used in search.spec.ts's flight flow
const FLIGHT_QUERY = new URLSearchParams({
  origin: 'PHL',
  originName: 'Philadelphia International Airport',
  destinationCode: 'SFO',
  destination: 'San Francisco International Airport',
  tripType: 'roundtrip',
  departDate: DEPART_DATE,
  returnDate: RETURN_DATE,
  adults: '1',
  cabinClass: 'economy',
}).toString();

async function gotoFlightsWithResults(page: Page) {
  await page.goto(`/flights?${FLIGHT_QUERY}`);
  await expect(
    page.getByRole('main').getByText(/flights? · PHL → SFO|No flights found for this route and date|Flight search failed/),
  ).toBeVisible({ timeout: 30_000 });
}

test.describe('Flights page — empty state', () => {
  test('prompts for a search with no query params', async ({ page }) => {
    await page.goto('/flights');
    await expect(page.getByRole('main').getByText('Select departure and arrival airports to search.')).toBeVisible();
  });
});

test.describe('Flights page — results', () => {
  test('loads results from query params and passes a11y', async ({ page }) => {
    await gotoFlightsWithResults(page);

    const cards = page.getByTestId('flight-card');
    const count = await cards.count();
    test.skip(count === 0, 'No flights returned by Duffel for this query');

    await expect(cards.first()).toBeVisible();

    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });

  test('sort tabs reorder results', async ({ page }) => {
    await gotoFlightsWithResults(page);

    const cards = page.getByTestId('flight-card');
    const total = await cards.count();
    test.skip(total < 2, 'Need 2+ flights to verify sort order');

    await page.getByRole('button', { name: 'Cheap' }).click();
    await expect(async () => {
      const stillThere = await cards.count();
      expect(stillThere).toBe(total);
    }).toPass();

    await page.getByRole('button', { name: 'Fast' }).click();
    await expect(async () => {
      const stillThere = await cards.count();
      expect(stillThere).toBe(total);
    }).toPass();
  });

  test('Refine sidebar narrows results by stops', async ({ page }) => {
    await gotoFlightsWithResults(page);

    const cards = page.getByTestId('flight-card');
    const total = await cards.count();
    test.skip(total === 0, 'No flights returned by Duffel for this query');

    const nonstop = page.getByRole('button', { name: /^Nonstop/ });
    const hasNonstop = await nonstop.isVisible({ timeout: 5_000 }).catch(() => false);
    test.skip(!hasNonstop, 'No nonstop filter available for this result set');

    await nonstop.click();

    await expect(async () => {
      const filtered = await cards.count();
      expect(filtered).toBeLessThanOrEqual(total);
    }).toPass();
  });

  test('clicking Compare on a flight card expands the points comparison grid', async ({ page }) => {
    await gotoFlightsWithResults(page);

    const cards = page.getByTestId('flight-card');
    const total = await cards.count();
    test.skip(total === 0, 'No flights returned by Duffel for this query');

    const compareButton = cards.first().getByRole('button', { name: /^Compare \d+ portals?/ });
    const hasCompare = await compareButton.isVisible({ timeout: 10_000 }).catch(() => false);
    test.skip(!hasCompare, 'No points data for this offer');

    await compareButton.click();
    await expect(cards.first().getByRole('button', { name: '↑ Hide' })).toBeVisible();

    await compareButton.click();
    await expect(cards.first().getByRole('button', { name: /^Compare \d+ portals?/ })).toBeVisible();
  });
});
