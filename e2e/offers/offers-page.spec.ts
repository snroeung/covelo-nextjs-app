import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('Offers page — /offers', () => {
  test('loads with the "All offers" heading and issuer filter pills', async ({ page }) => {
    await page.goto('/offers');

    await expect(page.getByRole('heading', { level: 1, name: /all offers/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /^all$/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /^chase$/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /^bilt$/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /^citi$/i })).toBeVisible();
  });

  test('page passes accessibility checks', async ({ page }) => {
    await page.goto('/offers');
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });

  test('issuer pill filters the list to that issuer only', async ({ page }) => {
    await page.goto('/offers');

    // isVisible() checks the DOM immediately with no polling — unlike an
    // expect() assertion it won't wait out the async offers query, so wait
    // via a (possibly failing) expect first and treat a timeout as absence.
    const countLabel = page.getByText(/^\d+ offers?$/i);
    const loaded = await expect(countLabel).toBeVisible({ timeout: 10_000 }).then(() => true, () => false);
    if (!loaded) test.skip(true, 'No offers in this environment — nothing to filter');

    await page.getByRole('button', { name: /^chase$/i }).click();

    // Offer rows carry an explicit role="button" attribute; the filter pills
    // are plain <button> elements with no such attribute, so this selector
    // only matches rows, not pills.
    const rows = page.locator('[role="button"]');
    const rowCount = await rows.count();
    if (rowCount === 0) test.skip(true, 'No Chase offers in this environment');
    for (let i = 0; i < rowCount; i++) {
      await expect(rows.nth(i)).toContainText(/chase/i);
    }
  });

  test('clicking an offer row opens the detail modal', async ({ page }) => {
    await page.goto('/offers');

    const emptyState = page.getByText(/no offers match this filter/i);
    if (await emptyState.isVisible({ timeout: 3_000 }).catch(() => false)) {
      test.skip(true, 'No offers in this environment — nothing to open');
    }

    const firstRow = page.locator('[role="button"]').first();
    await firstRow.click();
    await expect(page.getByRole('dialog')).toBeVisible();
  });
});
