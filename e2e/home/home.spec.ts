import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('Home page', () => {
  test('loads and passes accessibility checks', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/covelo/i);

    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });

  test('search form is visible on desktop', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('search')).toBeVisible();
  });
});

test.describe('Flight search flow', () => {
  test('submitting a search shows results', async ({ page }) => {
    await page.goto('/flights');
    // TODO: fill origin, destination, date, then assert result cards appear
  });
});
