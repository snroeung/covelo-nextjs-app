import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

function futureDate(daysFromNow: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return d.toISOString().split('T')[0];
}

async function fillVisibleDate(page: Page, index: number, value: string) {
  await page.locator('input[type="date"]:visible').nth(index).fill(value);
}

/** Force places.autocomplete to fail (403/500 family) so the search box falls back. */
async function failAutocomplete(page: Page) {
  await page.route('**/api/trpc/places.autocomplete*', async (route) => {
    await route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify([
        { error: { message: 'stubbed autocomplete failure', code: -32603, data: { code: 'INTERNAL_SERVER_ERROR', httpStatus: 500, path: 'places.autocomplete' } } },
      ]),
    });
  });
}

/** Stub the Mapbox geocode fallback proc to resolve text → fixed coordinates. */
async function stubGeocode(page: Page, coords: { latitude: number; longitude: number; name: string }) {
  await page.route('**/api/trpc/places.geocode*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([{ result: { data: coords } }]),
    });
  });
}

/** Stub the geocode fallback to return no match (null data). */
async function stubGeocodeNoMatch(page: Page) {
  await page.route('**/api/trpc/places.geocode*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([{ result: { data: null } }]),
    });
  });
}

/** Stub the geocode fallback to fail outright. */
async function failGeocode(page: Page) {
  await page.route('**/api/trpc/places.geocode*', async (route) => {
    await route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify([
        { error: { message: 'stubbed geocode failure', code: -32603, data: { code: 'INTERNAL_SERVER_ERROR', httpStatus: 500, path: 'places.geocode' } } },
      ]),
    });
  });
}

test.describe('Autocomplete fallback — flights (raw IATA)', () => {
  test('a 3-letter code auto-commits without Google, and the search submits', async ({ page }) => {
    await failAutocomplete(page);
    await page.goto('/search');

    // No inline button: typing a 3-letter code auto-commits it when autocomplete is down.
    const origin = page.getByRole('combobox').nth(0);
    await origin.click();
    await origin.fill('PHL');

    const arrival = page.getByRole('combobox').nth(1);
    await arrival.click();
    await arrival.fill('SFO');

    await fillVisibleDate(page, 0, futureDate(21));
    await fillVisibleDate(page, 1, futureDate(28));

    const search = page.getByRole('button', { name: 'Search →' });
    await expect(search).toBeEnabled({ timeout: 20_000 });
    await search.click();

    await expect(page).toHaveURL(/\/flights\?/, { timeout: 15_000 });
    const url = new URL(page.url());
    expect(url.searchParams.get('origin')).toBe('PHL');
    expect(url.searchParams.get('destinationCode')).toBe('SFO');
  });

  test('non-code input shows the banner (no inline guidance) and stays accessible', async ({ page }) => {
    await failAutocomplete(page);
    await page.goto('/search');

    const origin = page.getByRole('combobox').nth(0);
    await origin.click();
    await origin.fill('Philadelphia');
    // The outage is explained by the top banner, not an inline line under the field.
    await expect(page.getByText('Location search is temporarily unavailable')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText('Search unavailable — type a 3-letter airport code.')).toBeHidden();

    // Scope to the search panel (the nav avatar carries a pre-existing label-name-mismatch
    // unrelated to this change; the existing search.spec full-page axe test races past it).
    const results = await new AxeBuilder({ page }).include('main').analyze();
    expect(results.violations).toEqual([]);
  });
});

test.describe('Autocomplete fallback — hotels (Mapbox geocode)', () => {
  test('the geocode fallback resolves coords and the hotel search submits', async ({ page }) => {
    await failAutocomplete(page);
    await stubGeocode(page, { latitude: 48.8566, longitude: 2.3522, name: 'Paris' });

    await page.goto('/search');
    await page.getByRole('tab', { name: 'Hotels' }).click();

    const dest = page.getByRole('combobox').nth(0);
    await dest.click();
    await dest.fill('Paris');

    // Auto-resolves via Mapbox (no manual trigger): coords commit and the search enables.
    await fillVisibleDate(page, 0, futureDate(14));
    await fillVisibleDate(page, 1, futureDate(17));

    const search = page.getByRole('button', { name: 'Search →' });
    await expect(search).toBeEnabled({ timeout: 20_000 });
    await search.click();

    await expect(page).toHaveURL(/\/hotels\?/, { timeout: 15_000 });
    const url = new URL(page.url());
    expect(Number(url.searchParams.get('lat'))).toBeCloseTo(48.8566, 2);
    expect(Number(url.searchParams.get('lng'))).toBeCloseTo(2.3522, 2);
  });

  test('/hotels: a geocode no-match shows the search-failed state, not an inline message', async ({ page }) => {
    await failAutocomplete(page);
    await stubGeocodeNoMatch(page);

    // No search params → the page is idle (no isError), so the failed state can only come
    // from the no-match path.
    await page.goto('/hotels');

    const dest = page.getByRole('combobox').first();
    await dest.click();
    await dest.fill('Nowhereville');

    // No inline message under the field; the results area shows the search-failed state.
    await expect(page.getByText('Hotel search failed. Check your selections and try again.')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText('No match for', { exact: false })).toBeHidden();
  });

  test('a geocode outage shows no inline error (banner only)', async ({ page }) => {
    await failAutocomplete(page);
    await failGeocode(page);

    await page.goto('/search');
    await page.getByRole('tab', { name: 'Hotels' }).click();

    const dest = page.getByRole('combobox').nth(0);
    await dest.click();
    await dest.fill('Paris');

    // The top banner explains the outage; nothing is shown inline under the field.
    await expect(page.getByText('Location search is temporarily unavailable')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText('Location search is unavailable', { exact: false })).toBeHidden();
    await expect(page.getByRole('button', { name: 'Search →' })).toBeDisabled();
  });
});

/** Make a results-page search fail fast so the search-strip header renders without a live API. */
async function failSearch(page: Page, proc: string) {
  await page.route(`**/api/trpc/${proc}*`, (r) => r.fulfill({
    status: 500, contentType: 'application/json',
    body: JSON.stringify([{ error: { message: 'stub', code: -32603, data: { code: 'INTERNAL_SERVER_ERROR', httpStatus: 500, path: proc } } }]),
  }));
}

/** Fail a search proc with a 4xx (client/validation) error — must NOT raise the provider alarm. */
async function failSearchClient(page: Page, proc: string) {
  await page.route(`**/api/trpc/${proc}*`, (r) => r.fulfill({
    status: 400, contentType: 'application/json',
    body: JSON.stringify([{ error: { message: 'bad request', code: -32600, data: { code: 'BAD_REQUEST', httpStatus: 400, path: proc } } }]),
  }));
}

const BANNER = 'Location search is temporarily unavailable';

test.describe('Autocomplete unavailable — page banner', () => {
  test('/search: a non-dismissible alarm appears when autocomplete fails', async ({ page }) => {
    await failAutocomplete(page);
    await stubGeocodeNoMatch(page); // keep the auto-geocode deterministic (banner is the subject)
    await page.goto('/search');
    await page.getByRole('tab', { name: 'Hotels' }).click();

    // No banner until a field actually reports the failure.
    const banner = page.getByText(BANNER);
    await expect(banner).toBeHidden();

    const dest = page.getByRole('combobox').nth(0);
    await dest.click();
    await dest.fill('Paris');
    await expect(banner).toBeVisible({ timeout: 20_000 });

    // Not dismissible — no dismiss control exists.
    await expect(page.getByRole('button', { name: 'Dismiss' })).toHaveCount(0);
  });

  test('/flights: a flight-search API outage shows the alarm banner', async ({ page }) => {
    await failSearch(page, 'flights.searchOffers');
    await page.goto(`/flights?${new URLSearchParams({
      origin: 'PHL', originName: 'Philadelphia International Airport',
      destinationCode: 'SFO', destination: 'San Francisco International Airport',
      tripType: 'roundtrip', departDate: futureDate(21), returnDate: futureDate(28),
      adults: '1', cabinClass: 'economy',
    })}`);

    // The search errors on load → top alarm names the failing API.
    await expect(page.getByText('Flight search is temporarily unavailable')).toBeVisible({ timeout: 20_000 });
  });

  test('/hotels: a stays API outage shows the alarm banner', async ({ page }) => {
    await failSearch(page, 'stays.search');
    await page.goto(`/hotels?${new URLSearchParams({
      lat: '39.9526', lng: '-75.1652', destination: 'Philadelphia',
      checkIn: futureDate(14), checkOut: futureDate(17), guests: '2',
    })}`);

    await expect(page.getByText('Hotel search is temporarily unavailable')).toBeVisible({ timeout: 20_000 });
  });

  // A 4xx search error must NOT raise the provider alarm, and a concurrent autocomplete
  // outage must still show the location banner (the two are independent, not mutually exclusive).
  test('/hotels: location outage shows the location banner; a 4xx search error raises no provider alarm', async ({ page }) => {
    await failAutocomplete(page);
    await stubGeocodeNoMatch(page);
    await failSearchClient(page, 'stays.search');
    await page.goto(`/hotels?${new URLSearchParams({
      lat: '39.9526', lng: '-75.1652', destination: 'Philadelphia',
      checkIn: futureDate(14), checkOut: futureDate(17), guests: '2',
    })}`);

    await expect(page.getByText('Hotel search is temporarily unavailable')).toBeHidden();

    const dest = page.getByRole('combobox').first();
    await dest.click();
    await dest.fill('Paris');
    await expect(page.getByText(BANNER)).toBeVisible({ timeout: 20_000 });
  });

  test('/flights: location outage shows the location banner; a 4xx search error raises no provider alarm', async ({ page }) => {
    await failAutocomplete(page);
    await failSearchClient(page, 'flights.searchOffers');
    await page.goto(`/flights?${new URLSearchParams({
      origin: 'PHL', originName: 'Philadelphia International Airport',
      destinationCode: 'SFO', destination: 'San Francisco International Airport',
      tripType: 'roundtrip', departDate: futureDate(21), returnDate: futureDate(28),
      adults: '1', cabinClass: 'economy',
    })}`);

    await expect(page.getByText('Flight search is temporarily unavailable')).toBeHidden();

    const origin = page.getByRole('combobox').first();
    await origin.click();
    await origin.fill('Boston');
    await expect(page.getByText(BANNER)).toBeVisible({ timeout: 20_000 });
  });
});
