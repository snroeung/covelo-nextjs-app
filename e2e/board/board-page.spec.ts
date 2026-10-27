import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('The board — page', () => {
  test('1. loads with heading and filters', async ({ page }) => {
    await page.goto('/discover/board');
    await expect(page.getByRole('heading', { level: 1, name: 'The board' })).toBeVisible();
    await expect(page.getByLabel(/search posts/i)).toBeVisible();
  });

  test('2. search writes q to the URL', async ({ page }) => {
    await page.goto('/discover/board');
    await page.getByLabel(/search posts/i).fill('hyatt');
    await expect(page).toHaveURL(/q=hyatt/);
  });

  test('3. passes accessibility checks', async ({ page }) => {
    await page.goto('/discover/board');
    await expect(page.getByRole('heading', { level: 1, name: 'The board' })).toBeVisible();
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });

  test('4. unknown post id shows not-found state, not a crash', async ({ page }) => {
    await page.goto('/discover/board/00000000-0000-4000-8000-000000000000');
    await expect(page.getByRole('heading', { name: /isn.t available/i })).toBeVisible();
  });

  test('5. ?compose=1 opens the composer; Escape closes it', async ({ page }) => {
    await page.goto('/discover/board?compose=1');
    const dialog = page.getByRole('dialog', { name: 'New post' });
    await expect(dialog).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
  });

  test('6. composer passes accessibility checks', async ({ page }) => {
    await page.goto('/discover/board?compose=1');
    await expect(page.getByRole('dialog', { name: 'New post' })).toBeVisible();
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });

  test('7. composer is usable at 375px', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto('/discover/board?compose=1');
    const dialog = page.getByRole('dialog', { name: 'New post' });
    await expect(dialog).toBeVisible();
    const box = await dialog.boundingBox();
    expect(box!.width).toBeLessThanOrEqual(375);
  });
});
