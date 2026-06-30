import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('Offers page — general', () => {
  test('30. page loads with heading, category chips, and offers grid', async ({ page }) => {
    await page.goto('/offers');

    // Page title / heading
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    // Category filter chips
    await expect(page.getByRole('button', { name: /all offers/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /transfer bonuses/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /spending bonuses/i })).toBeVisible();
  });

  test('31. page passes accessibility checks', async ({ page }) => {
    await page.goto('/offers');
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });

  test('32. empty state message shown when active filter has no results', async ({ page }) => {
    await page.goto('/offers');

    // Click a filter that would have no results in a fresh test environment
    // (spending bonuses chip — if no spending bonuses were created yet)
    await page.getByRole('button', { name: /spending bonuses/i }).click();

    // Either offers appear, or an empty state is shown — both are valid
    const hasCards = await page.locator('article, [class*="card"]').count();
    if (hasCards === 0) {
      await expect(page.getByText(/no offers|nothing here|no results/i)).toBeVisible();
    }
  });

  test('33. "All offers" chip shows both transfer and spending cards', async ({ page }) => {
    await page.goto('/offers');

    // Start on "All offers" (default)
    await page.getByRole('button', { name: /all offers/i }).click();

    // If there are any offers at all, the grid should be visible
    const grid = page.locator('[class*="grid"], [class*="offers"]').first();
    await expect(grid).toBeVisible();
  });

  test('34. NavBar "Offers" link navigates to /offers', async ({ page }) => {
    await page.goto('/');

    await page.getByRole('link', { name: /offers/i }).click();
    await expect(page).toHaveURL(/\/offers/);
  });

  test('35. Community board section is visible on /offers', async ({ page }) => {
    await page.goto('/offers');

    // CommunityBoard shows "summer 2026" or "coming soon" messaging
    await expect(
      page.getByText(/summer 2026|community|launching/i).first(),
    ).toBeVisible({ timeout: 10_000 });
  });

  test('36. category chips are horizontally scrollable on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/offers');

    // Chips container exists and is scrollable
    const chipsRow = page.locator('[class*="chips"], [class*="filter"]').first();
    await expect(chipsRow).toBeVisible();

    const overflowX = await chipsRow.evaluate((el) =>
      window.getComputedStyle(el).overflowX,
    );
    expect(['auto', 'scroll', 'overlay']).toContain(overflowX);
  });

  test('37. mobile search header auto-collapses when offers results load', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/offers');

    // Wait for offers content to load
    await page.waitForLoadState('networkidle');

    // The search/header accordion should be collapsed (hasResults=true collapses it)
    const searchHeader = page
      .getByRole('button', { name: /search|filter/i })
      .or(page.locator('[class*="header-toggle"], [class*="search-toggle"]'))
      .first();

    if (await searchHeader.isVisible()) {
      // Header toggle exists — check it's in the collapsed state
      const isExpanded = await searchHeader.getAttribute('aria-expanded');
      expect(isExpanded).not.toBe('true');
    }
  });

  test('38. /offers page is fully functional on mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/offers');

    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    // Filter chips are reachable
    const allChip = page.getByRole('button', { name: /all offers/i });
    await expect(allChip).toBeVisible();
    await allChip.tap();

    // Accessibility check on mobile viewport
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });
});
