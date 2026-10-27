import { test, expect, type Page } from '@playwright/test';

// The board's side of the admin console: the Pending review queue's board
// rows and the offer editor's "Board post" section. The e2e session is the admin account.

async function openAdminTab(page: Page, tab: string) {
  await page.goto('/admin');
  await page.getByRole('button', { name: tab, exact: true }).first().click();
}

test.describe('Admin console — board', () => {
  test('1. Pending review has a "From the board" filter with a reason picker', async ({ page }) => {
    await openAdminTab(page, 'Pending review');
    const boardTab = page.getByRole('button', { name: /^From the board/ });
    await expect(boardTab).toBeVisible();
    await boardTab.click();
    const reasons = page.getByLabel('Filter board items by reason');
    await expect(reasons).toBeVisible();
    await expect(reasons.locator('option')).toHaveText(['All reasons', 'Offer to verify', 'Held', 'Reported']);
  });

  test('2. the admin console has no Board tab', async ({ page }) => {
    await page.goto('/admin');
    await expect(page.getByRole('button', { name: 'Pending review', exact: false }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Board', exact: true })).toHaveCount(0);
  });

  test('3. the offer editor has a Board post section that asks for a title and topic when switched on', async ({ page }) => {
    await openAdminTab(page, 'Offers');
    await page.getByRole('button', { name: /new offer/i }).click();
    await expect(page.getByText('4 · BOARD POST')).toBeVisible();
    await expect(page.getByLabel('POST TITLE')).toHaveCount(0);

    await page.getByRole('switch', { name: 'Post this offer to the board' }).click();
    await expect(page.getByText('POST TITLE', { exact: true })).toBeVisible();
    await expect(page.getByText('Board post title filled')).toBeVisible();
    await expect(page.getByText('Board topic picked')).toBeVisible();
  });

  test('4. every dropdown keeps room for its arrow on the right', async ({ page }) => {
    await openAdminTab(page, 'Offers');
    await page.getByRole('button', { name: /new offer/i }).click();
    const select = page.locator('select').first();
    await expect(select).toBeVisible();
    const paddingRight = await select.evaluate((el) => parseFloat(getComputedStyle(el).paddingRight));
    expect(paddingRight).toBeGreaterThanOrEqual(40);
  });
});
