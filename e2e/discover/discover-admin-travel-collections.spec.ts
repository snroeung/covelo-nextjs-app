import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {
  createTravelCollection,
  setTravelCollectionActive,
  daysFromNow,
  TEST_PREFIX,
} from '../utils/admin-helpers';

test.describe('Travel Collections admin — create, edit, deactivate', () => {
  test.describe.configure({ mode: 'serial' });
  const HOTEL_COLLECTION = `${TEST_PREFIX} Fine Hotels + Resorts`;
  const FLIGHT_COLLECTION = `${TEST_PREFIX} Domestic First Class`;
  const EXPIRED_COLLECTION = `${TEST_PREFIX} Expired Perk`;
  let hotelCollectionCreated = false;
  let flightCollectionCreated = false;

  test.afterAll(async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: 'e2e/.auth/admin.json' });
    const page = await ctx.newPage();
    await setTravelCollectionActive(page, HOTEL_COLLECTION, false).catch(() => {});
    await setTravelCollectionActive(page, FLIGHT_COLLECTION, false).catch(() => {});
    await setTravelCollectionActive(page, EXPIRED_COLLECTION, false).catch(() => {});
    await ctx.close();
  });

  test('1. creates a live hotel travel collection via admin', async ({ page }) => {
    await createTravelCollection(page, {
      type: 'hotel',
      issuer: 'Amex',
      collectionName: HOTEL_COLLECTION,
      propertyName: 'The Ritz-Carlton, Test City',
      perkSummary: '$100 credit, room upgrade, late checkout',
      originalAmount: 60000,
      originalUnit: 'points',
      discountAmount: 48000,
      discountUnit: 'points',
      sourceUrl: 'https://example.com/amex-fhr',
    });
    hotelCollectionCreated = true;

    await page.getByRole('button', { name: 'Travel collections' }).click();
    const row = page.locator('div.grid').filter({ hasText: HOTEL_COLLECTION }).first();
    await expect(row.getByText('Active').first()).toBeVisible({ timeout: 10_000 });
  });

  test('2. creates a live flight travel collection via admin', async ({ page }) => {
    await createTravelCollection(page, {
      type: 'flight',
      issuer: 'Chase',
      collectionName: FLIGHT_COLLECTION,
      cabinClass: 'Business',
      airlineName: 'United Airlines',
      airlineIataCode: 'UA',
      perkSummary: 'Complimentary upgrade to first class on select routes',
      sourceUrl: 'https://example.com/chase-united',
    });
    flightCollectionCreated = true;

    await page.getByRole('button', { name: 'Travel collections' }).click();
    const row = page.locator('div.grid').filter({ hasText: FLIGHT_COLLECTION }).first();
    await expect(row.getByText('Active').first()).toBeVisible({ timeout: 10_000 });
  });

  test('3. validation blocks publish with no perk summary', async ({ page }) => {
    await page.goto('/admin');
    await page.getByRole('button', { name: 'Travel collections' }).click();
    await page.getByRole('button', { name: /new collection/i }).click();
    await expect(page.getByText('NEW TRAVEL COLLECTION')).toBeVisible({ timeout: 5_000 });

    await page.getByPlaceholder('Fine Hotels + Resorts').fill(`${TEST_PREFIX} Validation Check`);
    // Perk summary intentionally left empty

    await expect(page.getByText('Perk summary set')).toBeVisible();
    await expect(page.getByRole('button', { name: /^Publish$/ })).toBeDisabled();

    // Editor renders two Cancel buttons (header + footer) — either dismisses it
    await page.getByRole('button', { name: 'Cancel' }).first().click();
  });

  test('4. editing updates the perk summary', async ({ page }) => {
    test.skip(!hotelCollectionCreated, 'Skipped: hotel collection creation (test 1) failed');
    await page.goto('/admin');
    await page.getByRole('button', { name: 'Travel collections' }).click();

    const row = page.locator('div.grid').filter({ hasText: HOTEL_COLLECTION }).first();
    await row.getByRole('button', { name: 'Edit' }).click();
    await expect(page.getByText('EDIT TRAVEL COLLECTION')).toBeVisible({ timeout: 5_000 });

    const perkInput = page.getByPlaceholder('$100 credit, room upgrade, late checkout');
    await perkInput.fill('$150 credit, suite upgrade, late checkout');
    await page.getByRole('button', { name: /^Save changes$/ }).click();
    await expect(page.getByText('EDIT TRAVEL COLLECTION')).toBeHidden({ timeout: 15_000 });

    const updatedRow = page.locator('div.grid').filter({ hasText: HOTEL_COLLECTION }).first();
    await expect(updatedRow.getByText(/\$150 credit/)).toBeVisible({ timeout: 10_000 });
  });

  test('5. a collection with a past end date shows Expired status', async ({ page }) => {
    await createTravelCollection(page, {
      type: 'hotel',
      issuer: 'Bilt',
      collectionName: EXPIRED_COLLECTION,
      propertyName: 'Test Expired Property',
      perkSummary: 'Perk that already lapsed',
      endDate: daysFromNow(-7),
    });

    await page.getByRole('button', { name: 'Travel collections' }).click();
    const row = page.locator('div.grid').filter({ hasText: EXPIRED_COLLECTION }).first();
    // Status filter tabs still say "Active" (PendingBadge only reflects the
    // `active` flag) — the ENDS column carries the expired date instead.
    await expect(row).toBeVisible({ timeout: 10_000 });
    // Filter tab's accessible name includes its count badge (e.g. "Expired1"),
    // so match by prefix rather than an exact/anchored string.
    await page.getByRole('button', { name: /^Expired/ }).click();
    await expect(page.locator('div.grid').filter({ hasText: EXPIRED_COLLECTION }).first()).toBeVisible({ timeout: 10_000 });
  });

  test('6. deactivating shows Inactive status', async ({ page }) => {
    test.skip(!hotelCollectionCreated, 'Skipped: hotel collection creation (test 1) failed');
    await setTravelCollectionActive(page, HOTEL_COLLECTION, false);

    await page.goto('/admin');
    await page.getByRole('button', { name: 'Travel collections' }).click();
    const row = page.locator('div.grid').filter({ hasText: HOTEL_COLLECTION }).first();
    await expect(row.getByText('Inactive').first()).toBeVisible({ timeout: 10_000 });
  });

  test('7. reactivating restores Active status', async ({ page }) => {
    test.skip(!hotelCollectionCreated, 'Skipped: hotel collection creation (test 1) failed');
    await setTravelCollectionActive(page, HOTEL_COLLECTION, true);

    await page.goto('/admin');
    await page.getByRole('button', { name: 'Travel collections' }).click();
    const row = page.locator('div.grid').filter({ hasText: HOTEL_COLLECTION }).first();
    await expect(row.getByText('Active').first()).toBeVisible({ timeout: 10_000 });
  });

  test('8. Travel collections admin tab passes accessibility checks', async ({ page }) => {
    test.skip(!flightCollectionCreated, 'Skipped: flight collection creation (test 2) failed');
    await page.goto('/admin');
    await page.getByRole('button', { name: 'Travel collections' }).click();
    await expect(page.getByText(FLIGHT_COLLECTION).first()).toBeVisible({ timeout: 10_000 });

    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });
});
