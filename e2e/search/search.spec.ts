import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

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
