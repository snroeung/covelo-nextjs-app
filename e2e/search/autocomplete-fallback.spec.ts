import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { stubLocationHealth as stubHealth, stubTrpcQuery } from '../utils/admin-helpers';

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

// Default every test to healthy location services: the banner is off unless a test opts in,
// and no test hits the real health APIs. (health.* is unbatched, so this route is reliable.)
test.beforeEach(async ({ page }) => {
  await stubHealth(page, true);
});

test.describe('Resolve on submit — flights (raw IATA)', () => {
  test('typed 3-letter codes resolve on Search and submit (autocomplete down)', async ({ page }) => {
    await stubHealth(page, false); // Places down → banner
    await failAutocomplete(page);
    await page.goto('/search');
    await expect(page.getByText('Location search is temporarily unavailable')).toBeVisible({ timeout: 20_000 });

    // Nothing resolves as you type; the code is read only when Search is pressed.
    const origin = page.getByRole('combobox').nth(0);
    await origin.click();
    await origin.fill('PHL');
    const arrival = page.getByRole('combobox').nth(1);
    await arrival.click();
    await arrival.fill('SFO');
    await fillVisibleDate(page, 0, futureDate(21));
    await fillVisibleDate(page, 1, futureDate(28));

    const search = page.getByRole('button', { name: 'Search →' });
    await expect(search).toBeEnabled();
    await search.click();

    await expect(page).toHaveURL(/\/flights\?/, { timeout: 15_000 });
    const url = new URL(page.url());
    expect(url.searchParams.get('origin')).toBe('PHL');
    expect(url.searchParams.get('destinationCode')).toBe('SFO');
  });

  test('a non-code airport input with autocomplete down stays put with no inline message; the banner explains', async ({ page }) => {
    await stubHealth(page, false); // Places down → banner
    await failAutocomplete(page);
    await page.goto('/search');

    const origin = page.getByRole('combobox').nth(0);
    await origin.click();
    await origin.fill('Philadelphia');
    const arrival = page.getByRole('combobox').nth(1);
    await arrival.click();
    await arrival.fill('SFO');
    await fillVisibleDate(page, 0, futureDate(21));
    await fillVisibleDate(page, 1, futureDate(28));

    await expect(page.getByText('Location search is temporarily unavailable')).toBeVisible({ timeout: 20_000 });

    // "Philadelphia" can't be resolved without autocomplete, so Search does nothing —
    // an outage, not a no-match, so no inline message; the banner is the explanation.
    const autocompleteTried = page.waitForResponse('**/api/trpc/places.autocomplete*');
    await page.getByRole('button', { name: 'Search →' }).click();
    await autocompleteTried;
    await expect(page.getByText('No match for', { exact: false })).toBeHidden();
    await expect(page).toHaveURL(/\/search/);

    const results = await new AxeBuilder({ page }).include('main').analyze();
    expect(results.violations).toEqual([]);
  });
});

test.describe('Resolve on submit — hotels (Mapbox geocode)', () => {
  test('a typed destination is geocoded on Search and the hotel search runs', async ({ page }) => {
    await stubHealth(page, false); // Places down → banner
    await failAutocomplete(page);
    await stubGeocode(page, { latitude: 48.8566, longitude: 2.3522, name: 'Paris' });

    await page.goto('/search');
    await page.getByRole('tab', { name: 'Hotels' }).click();
    await expect(page.getByText('Location search is temporarily unavailable')).toBeVisible({ timeout: 20_000 });

    const dest = page.getByRole('combobox').nth(0);
    await dest.click();
    await dest.fill('Paris');
    await fillVisibleDate(page, 0, futureDate(14));
    await fillVisibleDate(page, 1, futureDate(17));

    // Typed text alone is enough to submit; the geocode happens on click.
    const search = page.getByRole('button', { name: 'Search →' });
    await expect(search).toBeEnabled();
    await search.click();

    await expect(page).toHaveURL(/\/hotels\?/, { timeout: 15_000 });
    const url = new URL(page.url());
    expect(Number(url.searchParams.get('lat'))).toBeCloseTo(48.8566, 2);
    expect(Number(url.searchParams.get('lng'))).toBeCloseTo(2.3522, 2);
  });

  test('a geocode no-match on submit shows an error and stays on /search', async ({ page }) => {
    await stubHealth(page, false); // Places down → banner
    await failAutocomplete(page);
    await stubGeocodeNoMatch(page);

    await page.goto('/search');
    await page.getByRole('tab', { name: 'Hotels' }).click();
    await expect(page.getByText('Location search is temporarily unavailable')).toBeVisible({ timeout: 20_000 });

    const dest = page.getByRole('combobox').nth(0);
    await dest.click();
    await dest.fill('Nowhereville');
    await fillVisibleDate(page, 0, futureDate(14));
    await fillVisibleDate(page, 1, futureDate(17));
    await page.getByRole('button', { name: 'Search →' }).click();

    await expect(page.getByText('No match for "Nowhereville"')).toBeVisible({ timeout: 15_000 });
    await expect(page).toHaveURL(/\/search/);
  });

  test('a geocode outage on submit shows no inline message (banner only)', async ({ page }) => {
    await stubHealth(page, false); // Places down → banner
    await failAutocomplete(page);
    await failGeocode(page);

    await page.goto('/search');
    await page.getByRole('tab', { name: 'Hotels' }).click();
    await expect(page.getByText('Location search is temporarily unavailable')).toBeVisible({ timeout: 20_000 });

    const dest = page.getByRole('combobox').nth(0);
    await dest.click();
    await dest.fill('Paris');
    await fillVisibleDate(page, 0, futureDate(14));
    await fillVisibleDate(page, 1, futureDate(17));

    // Wait for the failed geocode to come back so the "nothing inline" check isn't vacuous.
    const geocodeDone = page.waitForResponse('**/api/trpc/places.geocode*');
    await page.getByRole('button', { name: 'Search →' }).click();
    await geocodeDone;

    // No inline message — the top banner is the only signal of the outage.
    await expect(page.getByText('Location search is unavailable', { exact: false })).toBeHidden();
    await expect(page.getByText('Location search is temporarily unavailable')).toBeVisible();
    await expect(page).toHaveURL(/\/search/);
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

// Autocomplete is UP here: typing without picking a suggestion auto-selects one on Search —
// the exact match for the typed text if there is one, otherwise the closest (top-ranked).
test.describe('Closest suggestion on submit — autocomplete up', () => {
  const COORDS: Record<string, { latitude: number; longitude: number; name: string }> = {
    'p-fr':     { latitude: 48.8566, longitude: 2.3522,   name: 'Paris' },
    'p-tx':     { latitude: 33.6609, longitude: -95.5555, name: 'Paris' },
    'iata:BOS': { latitude: 42.3656, longitude: -71.0096, name: 'Boston Logan International Airport' },
    'iata:SFO': { latitude: 37.6213, longitude: -122.379, name: 'San Francisco International Airport' },
  };

  async function stubAutocompleteUp(page: Page) {
    await stubTrpcQuery(page, 'places.autocomplete', (input) => {
      const q = String(input.input ?? '').toLowerCase();
      if (q.startsWith('par')) return [
        { placeId: 'p-fr', description: 'Paris, France' },
        { placeId: 'p-tx', description: 'Paris, TX, USA' },
      ];
      if (q.startsWith('bos')) return [{ placeId: 'iata:BOS', description: 'Boston Logan International Airport (BOS), Boston, MA' }];
      if (q.startsWith('san')) return [{ placeId: 'iata:SFO', description: 'San Francisco International Airport (SFO), San Francisco, CA' }];
      return [];
    });
    await stubTrpcQuery(page, 'places.getLatLng', (input) => COORDS[String(input.placeId)]);
  }

  async function typeWithoutPicking(page: Page, index: number, text: string) {
    const field = page.getByRole('combobox').nth(index);
    await field.click();
    await field.fill(text);
    // Suggestions appear, but the user never clicks one.
    await expect(page.getByRole('option').first()).toBeVisible({ timeout: 10_000 });
  }

  test('hotels: no exact match → the closest (top) suggestion is selected', async ({ page }) => {
    await stubAutocompleteUp(page);
    await page.goto('/search');
    await page.getByRole('tab', { name: 'Hotels' }).click();

    await typeWithoutPicking(page, 0, 'Pari');
    await fillVisibleDate(page, 0, futureDate(14));
    await fillVisibleDate(page, 1, futureDate(17));
    await page.getByRole('button', { name: 'Search →' }).click();

    await expect(page).toHaveURL(/\/hotels\?/, { timeout: 15_000 });
    const url = new URL(page.url());
    expect(Number(url.searchParams.get('lat'))).toBeCloseTo(48.8566, 2); // Paris, France (top)
  });

  test('hotels: an exact match wins over the top suggestion', async ({ page }) => {
    await stubAutocompleteUp(page);
    await page.goto('/search');
    await page.getByRole('tab', { name: 'Hotels' }).click();

    await typeWithoutPicking(page, 0, 'Paris, TX, USA');
    await fillVisibleDate(page, 0, futureDate(14));
    await fillVisibleDate(page, 1, futureDate(17));
    await page.getByRole('button', { name: 'Search →' }).click();

    await expect(page).toHaveURL(/\/hotels\?/, { timeout: 15_000 });
    const url = new URL(page.url());
    expect(Number(url.searchParams.get('lat'))).toBeCloseTo(33.6609, 2); // Paris, TX (exact)
  });

  test('flights: typed city names resolve to the closest airports', async ({ page }) => {
    await stubAutocompleteUp(page);
    await page.goto('/search');

    await typeWithoutPicking(page, 0, 'Boston');
    await typeWithoutPicking(page, 1, 'San Fran');
    await fillVisibleDate(page, 0, futureDate(21));
    await fillVisibleDate(page, 1, futureDate(28));
    await page.getByRole('button', { name: 'Search →' }).click();

    await expect(page).toHaveURL(/\/flights\?/, { timeout: 15_000 });
    const url = new URL(page.url());
    expect(url.searchParams.get('origin')).toBe('BOS');
    expect(url.searchParams.get('destinationCode')).toBe('SFO');
  });

  test('hotels: no suggestions at all → inline no-match, and Mapbox is never called', async ({ page }) => {
    await stubAutocompleteUp(page);
    let geocodeCalls = 0;
    await page.route('**/api/trpc/places.geocode*', (r) => { geocodeCalls += 1; return r.abort(); });

    await page.goto('/search');
    await page.getByRole('tab', { name: 'Hotels' }).click();
    const dest = page.getByRole('combobox').nth(0);
    await dest.click();
    await dest.fill('Zzqx');
    await fillVisibleDate(page, 0, futureDate(14));
    await fillVisibleDate(page, 1, futureDate(17));
    await page.getByRole('button', { name: 'Search →' }).click();

    await expect(page.getByText('No match for "Zzqx"')).toBeVisible({ timeout: 15_000 });
    expect(geocodeCalls).toBe(0);
  });

  test('switching Flights ⇄ Hotels clears typed text and the no-match note', async ({ page }) => {
    await stubAutocompleteUp(page);
    await page.goto('/search');
    await page.getByRole('tab', { name: 'Hotels' }).click();

    const dest = page.getByRole('combobox').nth(0);
    await dest.click();
    await dest.fill('Zzqx');
    await fillVisibleDate(page, 0, futureDate(14));
    await fillVisibleDate(page, 1, futureDate(17));
    await page.getByRole('button', { name: 'Search →' }).click();
    await expect(page.getByText('No match for "Zzqx"')).toBeVisible({ timeout: 15_000 });

    // The note doesn't follow the user to the other mode…
    await page.getByRole('tab', { name: 'Flights' }).click();
    await expect(page.getByText('No match for', { exact: false })).toBeHidden();

    // …and back on Hotels the empty field can't drive a search with the old hidden text,
    // even though the dates are still filled.
    await page.getByRole('tab', { name: 'Hotels' }).click();
    await expect(page.getByRole('combobox').nth(0)).toHaveValue('');
    await expect(page.getByRole('button', { name: 'Search →' })).toBeDisabled();
  });
});

test.describe('Autocomplete unavailable — page banner', () => {
  test('/search: a non-dismissible alarm appears when location services are down', async ({ page }) => {
    await stubHealth(page, false); // healthcheck reports Places down → banner on load
    await page.goto('/search');

    await expect(page.getByText(BANNER)).toBeVisible({ timeout: 20_000 });
    // Not dismissible — no dismiss control exists.
    await expect(page.getByRole('button', { name: 'Dismiss' })).toHaveCount(0);
  });

  test('/search: no banner when location services are healthy', async ({ page }) => {
    await stubHealth(page, true);
    await page.goto('/search');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByText(BANNER)).toBeHidden();
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

  // The location banner (healthcheck) and the provider alarm (search error) are independent:
  // a 4xx search error must NOT raise the provider alarm, while a location outage still shows
  // the location banner, and both can show at once.
  test('/hotels: location outage shows the location banner; a 4xx search error raises no provider alarm', async ({ page }) => {
    await stubHealth(page, false);
    await failSearchClient(page, 'stays.search');
    await page.goto(`/hotels?${new URLSearchParams({
      lat: '39.9526', lng: '-75.1652', destination: 'Philadelphia',
      checkIn: futureDate(14), checkOut: futureDate(17), guests: '2',
    })}`);

    await expect(page.getByText(BANNER)).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText('Hotel search is temporarily unavailable')).toBeHidden();
  });

  test('/flights: location outage shows the location banner; a 4xx search error raises no provider alarm', async ({ page }) => {
    await stubHealth(page, false);
    await failSearchClient(page, 'flights.searchOffers');
    await page.goto(`/flights?${new URLSearchParams({
      origin: 'PHL', originName: 'Philadelphia International Airport',
      destinationCode: 'SFO', destination: 'San Francisco International Airport',
      tripType: 'roundtrip', departDate: futureDate(21), returnDate: futureDate(28),
      adults: '1', cabinClass: 'economy',
    })}`);

    await expect(page.getByText(BANNER)).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText('Flight search is temporarily unavailable')).toBeHidden();
  });
});
