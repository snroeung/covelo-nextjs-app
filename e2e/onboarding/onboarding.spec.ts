import { test, expect } from '@playwright/test';

test.describe('Onboarding page', () => {
  test('redirects already-onboarded users to /flights', async ({ page }) => {
    // Shared admin fixture (e2e/.auth/admin.json) already completed onboarding.
    await page.goto('/onboarding');
    await expect(page).toHaveURL(/\/flights/, { timeout: 10_000 });
  });

  test('redirects unauthenticated users to /auth', async ({ browser }) => {
    const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await context.newPage();

    await page.goto('/onboarding');
    await expect(page).toHaveURL(/\/auth/, { timeout: 10_000 });

    await context.close();
  });
});
