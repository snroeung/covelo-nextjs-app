import { test as setup, expect } from '@playwright/test';
import path from 'path';

const authFile = path.join(__dirname, '.auth/admin.json');

setup('authenticate as admin', async ({ page }) => {
  const email = process.env.PLAYWRIGHT_ADMIN_EMAIL;
  const password = process.env.PLAYWRIGHT_ADMIN_PASSWORD;

  if (!email || !password) {
    throw new Error(
      'PLAYWRIGHT_ADMIN_EMAIL and PLAYWRIGHT_ADMIN_PASSWORD must be set in .env.local',
    );
  }

  await page.goto('/');

  // Find and click the sign-in button in the NavBar
  await page.getByRole('button', { name: /sign in/i }).click();

  // Fill in credentials — adjust selectors to match the actual auth modal/page
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(password);
  await page.getByRole('button', { name: /sign in|log in|continue/i }).click();

  // Wait for successful auth — avatar button appears in nav when logged in
  await expect(page.getByRole('button', { name: /avatar|profile|account/i })).toBeVisible({
    timeout: 10_000,
  });

  // Save auth state (cookies + localStorage) for reuse across all tests
  await page.context().storageState({ path: authFile });
});
