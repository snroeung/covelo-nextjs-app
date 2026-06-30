import { chromium } from '@playwright/test';
import path from 'path';
import fs from 'fs';

const authFile = path.join(__dirname, '.auth/admin.json');

export default async function globalSetup() {
  const email = process.env.PLAYWRIGHT_ADMIN_EMAIL;
  const password = process.env.PLAYWRIGHT_ADMIN_PASSWORD;

  if (!email || !password) {
    throw new Error(
      'PLAYWRIGHT_ADMIN_EMAIL and PLAYWRIGHT_ADMIN_PASSWORD must be set in .env or .env.local',
    );
  }

  fs.mkdirSync(path.dirname(authFile), { recursive: true });

  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto('http://localhost:3000/auth');

  // Switch from default "Create account" tab to "Sign in"
  await page.getByRole('button', { name: 'Sign in' }).click();

  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);

  // Scope to <form> to avoid clicking the "Sign in" tab again
  await page.locator('form').getByRole('button', { name: /^sign in$/i }).click();

  // Successful sign-in redirects to /flights or /onboarding
  await page.waitForURL(/\/(flights|onboarding)/, { timeout: 15_000 });

  await context.storageState({ path: authFile });
  await browser.close();
}
