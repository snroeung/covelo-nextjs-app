import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {
  createTransferPartner,
  setTransferPartnerActive,
  TEST_PREFIX,
} from '../utils/admin-helpers';

test.describe('Transfer Partners admin — create, edit, deactivate', () => {
  test.describe.configure({ mode: 'serial' });
  const PROGRAM = `${TEST_PREFIX} World of Hyatt`;
  let partnerCreated = false;

  test.afterAll(async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: 'e2e/.auth/admin.json' });
    const page = await ctx.newPage();
    await setTransferPartnerActive(page, PROGRAM, false).catch(() => {});
    await ctx.close();
  });

  test('1. creates a live transfer partner via admin', async ({ page }) => {
    await createTransferPartner(page, {
      portal: 'Chase',
      type: 'hotel',
      program: PROGRAM,
      ratio: '1:1',
      chainKey: 'hyatttest',
      sourceUrl: 'https://example.com/chase-hyatt',
    });
    partnerCreated = true;

    await page.getByRole('button', { name: 'Transfer partners' }).click();
    const row = page.locator('div.grid').filter({ hasText: PROGRAM }).first();
    await expect(row.getByText('Active').first()).toBeVisible({ timeout: 10_000 });
  });

  test('2. validation blocks publish on a malformed ratio', async ({ page }) => {
    await page.goto('/admin');
    await page.getByRole('button', { name: 'Transfer partners' }).click();
    await page.getByRole('button', { name: /new partner/i }).click();
    await expect(page.getByText('NEW TRANSFER PARTNER')).toBeVisible({ timeout: 5_000 });

    await page.getByPlaceholder('World of Hyatt').fill(`${TEST_PREFIX} Validation Check`);
    await page.getByPlaceholder('1:1').fill('not-a-ratio');

    await expect(page.getByText('Ratio format is N:N')).toBeVisible();
    await expect(page.getByText('✗').first()).toBeVisible();
    await expect(page.getByRole('button', { name: /^Publish$/ })).toBeDisabled();

    // Editor renders two Cancel buttons (header + footer) — either dismisses it
    await page.getByRole('button', { name: 'Cancel' }).first().click();
  });

  test('3. editing updates the ratio', async ({ page }) => {
    test.skip(!partnerCreated, 'Skipped: partner creation (test 1) failed');
    await page.goto('/admin');
    await page.getByRole('button', { name: 'Transfer partners' }).click();

    const row = page.locator('div.grid').filter({ hasText: PROGRAM }).first();
    await row.getByRole('button', { name: 'Edit' }).click();
    await expect(page.getByText('EDIT TRANSFER PARTNER')).toBeVisible({ timeout: 5_000 });

    await page.getByPlaceholder('1:1').fill('2:3');
    await page.getByRole('button', { name: /^Save changes$/ }).click();
    await expect(page.getByText('EDIT TRANSFER PARTNER')).toBeHidden({ timeout: 15_000 });

    const updatedRow = page.locator('div.grid').filter({ hasText: PROGRAM }).first();
    await expect(updatedRow.getByText('2:3')).toBeVisible({ timeout: 10_000 });
  });

  test('4. deactivating shows Paused status', async ({ page }) => {
    test.skip(!partnerCreated, 'Skipped: partner creation (test 1) failed');
    await setTransferPartnerActive(page, PROGRAM, false);

    await page.goto('/admin');
    await page.getByRole('button', { name: 'Transfer partners' }).click();
    const row = page.locator('div.grid').filter({ hasText: PROGRAM }).first();
    await expect(row.getByText('Inactive').first()).toBeVisible({ timeout: 10_000 });
  });

  test('5. reactivating restores Active status', async ({ page }) => {
    test.skip(!partnerCreated, 'Skipped: partner creation (test 1) failed');
    await setTransferPartnerActive(page, PROGRAM, true);

    await page.goto('/admin');
    await page.getByRole('button', { name: 'Transfer partners' }).click();
    const row = page.locator('div.grid').filter({ hasText: PROGRAM }).first();
    await expect(row.getByText('Active').first()).toBeVisible({ timeout: 10_000 });
  });

  test('6. Transfer partners admin tab passes accessibility checks', async ({ page }) => {
    test.skip(!partnerCreated, 'Skipped: partner creation (test 1) failed');
    await page.goto('/admin');
    await page.getByRole('button', { name: 'Transfer partners' }).click();
    await expect(page.getByText(PROGRAM).first()).toBeVisible({ timeout: 10_000 });

    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });
});
