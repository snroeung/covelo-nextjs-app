import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// The marketing home redirects authenticated users to /search, so these run
// signed out (no stored auth) with reduced motion for deterministic timing
// (the intro is immediately dismissible under reduced motion).
test.use({ storageState: { cookies: [], origins: [] }, reducedMotion: 'reduce' });

const INTRO = /Covelo intro/i;

test.describe('Home — / (signed out)', () => {
  test('intro shows first; NavBar + deck appear after it is dismissed', async ({ page }) => {
    await page.goto('/');

    const intro = page.getByLabel(INTRO);
    await expect(intro).toBeVisible();
    // NavBar Sign in is hidden behind the intro.
    await expect(page.getByRole('button', { name: /^sign in$/i })).toBeHidden();

    await page.getByRole('button', { name: /scroll to continue/i }).click();

    await expect(intro).toBeHidden();
    await expect(page.getByRole('button', { name: /^sign in$/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /everything in one search/i })).toBeVisible();
  });

  test('intro does not reappear after it is dismissed (once per session)', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /scroll to continue/i }).click();
    await expect(page.getByLabel(INTRO)).toBeHidden();

    // A soft re-navigation within the session keeps the intro gone.
    await page.getByRole('button', { name: /^sign in$/i }).first().waitFor();
    await page.goto('/');
    await expect(page.getByLabel(INTRO)).toBeHidden();
  });

  test('deck controls advance the step', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /scroll to continue/i }).click();

    // Pause so autoplay does not race the assertions.
    await page.getByRole('button', { name: /pause walkthrough/i }).click();
    await expect(page.getByText(/STEP 01 \/ 06/)).toBeVisible();
    await page.getByRole('button', { name: /next step/i }).click();
    await expect(page.getByText(/STEP 02 \/ 06/)).toBeVisible();
  });

  test('controls stay reachable with scroll-snap on a short viewport', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');
    await page.getByRole('button', { name: /scroll to continue/i }).click();

    const next = page.getByRole('button', { name: /next step/i });
    await next.scrollIntoViewIfNeeded();
    await expect(next).toBeVisible();
    await next.click();
  });

  test('the account CTA navigates to the auth page', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /scroll to continue/i }).click();

    await page.getByRole('link', { name: /sign in or create account/i }).click();
    await expect(page).toHaveURL(/\/auth/);
    await expect(page.getByPlaceholder('you@example.com')).toBeVisible();
  });

  test('Continue browsing goes straight to search', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /scroll to continue/i }).click();

    await page.getByRole('link', { name: /continue browsing/i }).click();
    await expect(page).toHaveURL(/\/search/);
  });

  test('passes accessibility checks after the intro is dismissed', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /scroll to continue/i }).click();
    await expect(page.getByRole('heading', { name: /everything in one search/i })).toBeVisible();

    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });
});
