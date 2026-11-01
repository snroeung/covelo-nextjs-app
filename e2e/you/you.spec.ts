import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { MOBILE, expectNoHorizontalScroll, tabBar } from '../utils/mobile-helpers';

// The e2e session is the signed-in admin account (e2e/global-setup.ts).

test.describe('You page — phone', () => {
  test.use(MOBILE);

  test('shows profile, balance, account links and theme, and passes accessibility checks', async ({ page }) => {
    await page.goto('/you');
    await expect(page.getByTestId('you-balance')).toBeVisible();
    await expect(page.getByRole('link', { name: /Settings/ })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible();
    await expect(page.getByRole('group', { name: 'Theme' })).toBeVisible();
    await expectNoHorizontalScroll(page);

    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });

  test('the You tab is active here, and the tab bar moves between Search, Offers and You', async ({ page }) => {
    await page.goto('/you');
    await expect(tabBar(page).getByRole('link', { name: 'You' })).toHaveAttribute('aria-current', 'page');

    await tabBar(page).getByRole('link', { name: 'Search' }).click();
    await expect(page).toHaveURL(/\/search$/);
    await expect(tabBar(page).getByRole('link', { name: 'Search' })).toHaveAttribute('aria-current', 'page');

    await tabBar(page).getByRole('link', { name: 'Offers' }).click();
    await expect(page).toHaveURL(/\/discover$/);
    await expect(tabBar(page).getByRole('link', { name: 'Offers' })).toHaveAttribute('aria-current', 'page');

    await tabBar(page).getByRole('link', { name: 'You' }).click();
    await expect(page).toHaveURL(/\/you$/);
  });

  test('theme toggle switches the page theme', async ({ page }) => {
    await page.goto('/you');
    await page.getByRole('button', { name: 'Dark', exact: true }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await expect(page.getByRole('button', { name: 'Dark', exact: true })).toHaveAttribute('aria-pressed', 'true');

    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);

    await page.getByRole('button', { name: 'Light', exact: true }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  });

  test('the tab bar stays clear of page content and is hidden on /auth', async ({ page }) => {
    await page.goto('/you');
    const bar = (await tabBar(page).boundingBox())!;
    expect(bar.y + bar.height).toBeLessThanOrEqual(844 + 1);
    await expect(tabBar(page).getByRole('link')).toHaveCount(3);

    await page.goto('/auth');
    await expect(tabBar(page)).toBeHidden();
  });
});

test.describe('You page — desktop', () => {
  test('the bottom tab bar is phone-only', async ({ page }) => {
    await page.goto('/search');
    await expect(tabBar(page)).toBeHidden();
  });
});
