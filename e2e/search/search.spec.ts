import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { MOBILE, expectNoHorizontalScroll, swipe, tabBar } from '../utils/mobile-helpers';

function futureDate(daysFromNow: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return d.toISOString().split('T')[0];
}

async function pickPlace(page: Page, comboboxIndex: number, query: string) {
  const combo = page.getByRole('combobox').nth(comboboxIndex);
  await combo.click();
  await combo.fill(query);
  await expect(page.getByRole('listbox')).toBeVisible({ timeout: 10_000 });
  await page.getByRole('option').first().click();
}

async function fillVisibleDate(page: Page, index: number, value: string) {
  await page.locator('input[type="date"]:visible').nth(index).fill(value);
}

test.describe('Search page', () => {
  test('loads and passes accessibility checks', async ({ page }) => {
    await page.goto('/search');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Find your flight');

    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });

  test('mode toggle switches between flights and hotels', async ({ page }) => {
    await page.goto('/search');

    await expect(page.getByRole('heading', { level: 1 })).toContainText('Find your flight');

    await page.getByRole('tab', { name: 'Hotels' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Find your stay');
    await expect(page.getByRole('tab', { name: 'Hotels' })).toHaveAttribute('aria-selected', 'true');

    await page.getByRole('tab', { name: 'Flights' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Find your flight');
    await expect(page.getByRole('tab', { name: 'Flights' })).toHaveAttribute('aria-selected', 'true');
  });

  test('search button is disabled until required fields are filled', async ({ page }) => {
    await page.goto('/search');
    await expect(page.getByRole('button', { name: 'Search →' })).toBeDisabled();

    await page.getByRole('tab', { name: 'Hotels' }).click();
    await expect(page.getByRole('button', { name: 'Search →' })).toBeDisabled();
  });

  test('example board renders', async ({ page }) => {
    await page.goto('/search');
    await expect(page.getByText('Example routes · Philadelphia departures')).toBeVisible();

    await page.getByRole('tab', { name: 'Hotels' }).click();
    await expect(page.getByText('Example stays · Philadelphia')).toBeVisible();
  });
});

test.describe('Flight search flow', () => {
  test('full flow: pick origin, arrival, dates, submit redirects to /flights', async ({ page }) => {
    await page.goto('/search');

    await pickPlace(page, 0, 'Philadelphia International Airport');
    await pickPlace(page, 1, 'San Francisco International Airport');

    const departDate = futureDate(21);
    const returnDate = futureDate(28);
    await fillVisibleDate(page, 0, departDate);
    await fillVisibleDate(page, 1, returnDate);

    const searchButton = page.getByRole('button', { name: 'Search →' });
    await expect(searchButton).toBeEnabled();
    await searchButton.click();

    await expect(page).toHaveURL(/\/flights\?/, { timeout: 15_000 });

    const url = new URL(page.url());
    expect(url.searchParams.get('origin')).toMatch(/^[A-Z]{3}$/);
    expect(url.searchParams.get('destinationCode')).toMatch(/^[A-Z]{3}$/);
    expect(url.searchParams.get('originName')).toBeTruthy();
    expect(url.searchParams.get('destination')).toBeTruthy();
    expect(url.searchParams.get('tripType')).toBe('roundtrip');
    expect(url.searchParams.get('departDate')).toBe(departDate);
    expect(url.searchParams.get('returnDate')).toBe(returnDate);
  });
});

test.describe('Hotel search flow', () => {
  test('full flow: pick destination, dates, submit redirects to /hotels', async ({ page }) => {
    await page.goto('/search');
    await page.getByRole('tab', { name: 'Hotels' }).click();

    await pickPlace(page, 0, 'Philadelphia, PA');

    const checkIn = futureDate(14);
    const checkOut = futureDate(17);
    await fillVisibleDate(page, 0, checkIn);
    await fillVisibleDate(page, 1, checkOut);

    const searchButton = page.getByRole('button', { name: 'Search →' });
    await expect(searchButton).toBeEnabled();
    await searchButton.click();

    await expect(page).toHaveURL(/\/hotels\?/, { timeout: 15_000 });

    const url = new URL(page.url());
    expect(url.searchParams.get('destination')).toBeTruthy();
    expect(Number(url.searchParams.get('lat'))).not.toBe(0);
    expect(Number(url.searchParams.get('lng'))).not.toBe(0);
    expect(url.searchParams.get('checkIn')).toBe(checkIn);
    expect(url.searchParams.get('checkOut')).toBe(checkOut);
    expect(url.searchParams.get('rooms')).toBe('1');
    expect(url.searchParams.get('adults')).toBe('2');
    expect(url.searchParams.get('children')).toBe('0');
  });
});

test.describe('Search page — phone', () => {
  test.use(MOBILE);

  test('page cannot be dragged sideways and passes accessibility checks', async ({ page }) => {
    await page.goto('/search');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Find your flight');
    await expectNoHorizontalScroll(page);

    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });

  test('top bar is just the wordmark and theme toggle; navigation is the bottom tab bar', async ({ page }) => {
    await page.goto('/search');
    await expect(tabBar(page)).toBeVisible();
    await expect(tabBar(page).getByRole('link')).toHaveText(['Search', 'Offers', 'You']);
    await expect(tabBar(page).getByRole('link', { name: 'Search' })).toHaveAttribute('aria-current', 'page');
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeHidden();
  });

  test('Flights / Hotels tabs are the same size and centered', async ({ page }) => {
    await page.goto('/search');
    await expect(page.getByRole('tab', { name: 'Hotels' })).toBeVisible();
    const flights = await page.getByRole('tab', { name: 'Flights' }).boundingBox();
    const hotels = await page.getByRole('tab', { name: 'Hotels' }).boundingBox();
    expect(flights && hotels).toBeTruthy();
    expect(Math.abs(flights!.width - hotels!.width)).toBeLessThan(1);
    // Midpoint between the two tabs sits on the viewport's center line
    const mid = (flights!.x + hotels!.x + hotels!.width) / 2;
    expect(Math.abs(mid - 390 / 2)).toBeLessThan(2);
  });

  test('example carousel scrolls with a touch swipe', async ({ page }) => {
    await page.goto('/search');
    const track = page.locator('.tk-mask').first();
    await expect(track).toBeVisible({ timeout: 15_000 });
    await track.scrollIntoViewIfNeeded();
    const before = await track.evaluate((el) => el.scrollLeft);
    const box = (await track.boundingBox())!;
    await swipe(page, box.x + box.width * 0.8, box.y + box.height / 2, -220);
    await expect.poll(() => track.evaluate((el) => el.scrollLeft)).toBeGreaterThan(before);
  });

  test('example popup is centered and the page behind it does not move', async ({ page }) => {
    await page.goto('/search');
    const card = page.locator('.tk-track button').first();
    await card.click();
    const dialog = page.getByRole('dialog').first();
    await expect(dialog).toBeVisible();

    const box = (await dialog.boundingBox())!;
    expect(Math.abs(box.y + box.height / 2 - 844 / 2)).toBeLessThan(60);

    const scrollY = await page.evaluate(() => window.scrollY);
    await page.mouse.wheel(0, 400);
    expect(await page.evaluate(() => window.scrollY)).toBe(scrollY);
    await expectNoHorizontalScroll(page);
  });
});
