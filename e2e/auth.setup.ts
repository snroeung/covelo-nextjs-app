import { test as setup } from '@playwright/test';
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

  // Go directly to the auth page — the home page "/" shows a loading skeleton
  // until AuthContext resolves and has no sign-in button, only a Link to /auth
  await page.goto('/auth');

  // Default mode is "Create account"; switch to "Sign in"
  await page.getByRole('button', { name: 'Sign in' }).click();

  // Fill credentials — labels in /auth/page.tsx are not associated via htmlFor,
  // so we target by input type/placeholder instead of getByLabel
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);

  // Submit via the form button (scoped to <form> to avoid the "Sign in" tab)
  await page.locator('form').getByRole('button', { name: /^sign in$/i }).click();

  // Successful sign-in redirects to /flights or /onboarding
  await page.waitForURL(/\/(flights|onboarding)/, { timeout: 15_000 });

  // Save auth state (cookies + localStorage) for reuse across all tests
  await page.context().storageState({ path: authFile });
});
