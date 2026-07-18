import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('Settings page', () => {
  test('loads and passes accessibility checks', async ({ page }) => {
    await page.goto('/settings');
    await expect(page.getByRole('heading', { name: 'Account Settings' })).toBeVisible();

    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });

  test("shows the logged-in user's email", async ({ page }) => {
    const email = process.env.PLAYWRIGHT_ADMIN_EMAIL;
    test.skip(!email, 'PLAYWRIGHT_ADMIN_EMAIL not set');

    await page.goto('/settings');
    await expect(page.getByText(email!)).toBeVisible();
  });

  test('updates display name and shows success banner', async ({ page }) => {
    await page.goto('/settings');

    // The "Display name" <label> has no htmlFor/id association (real a11y gap
    // in app/settings/page.tsx), so target the input structurally.
    const nameInput = page.locator('input[type="text"]');
    const original = await nameInput.inputValue();

    await nameInput.fill('E2E Test Name');
    await page.getByRole('button', { name: 'Save name' }).click();
    await expect(page.getByText('Display name updated.')).toBeVisible();

    // Restore original value so the shared admin fixture is left unchanged.
    await nameInput.fill(original);
    await page.getByRole('button', { name: 'Save name' }).click();
    await expect(page.getByText('Display name updated.')).toBeVisible();
  });

  test('password mismatch shows validation error without submitting', async ({ page }) => {
    await page.goto('/settings');

    const passwordInputs = page.locator('input[type="password"]');
    await passwordInputs.nth(0).fill('password1234');
    await passwordInputs.nth(1).fill('password5678');
    await page.getByRole('button', { name: 'Update password' }).click();

    await expect(page.getByText('Passwords do not match.')).toBeVisible();
  });
});
