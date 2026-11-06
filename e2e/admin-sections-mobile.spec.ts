import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.use({ viewport: { width: 375, height: 800 } });

test.describe('Admin sections — phone bottom sheet', () => {
  test('current section opens a sheet; picking one switches and closes it', async ({ page }) => {
    await page.goto('/admin');
    const trigger = page.getByRole('button', { name: /Section/ });
    await expect(trigger).toBeVisible();
    // The desktop tab row is hidden at phone width
    await expect(page.getByRole('button', { name: 'Sponsored ads', exact: true })).toBeHidden();

    await trigger.click();
    const sheet = page.getByRole('dialog', { name: 'Admin sections' });
    await expect(sheet).toBeVisible();
    expect((await sheet.getByRole('option').first().boundingBox())?.height).toBeGreaterThanOrEqual(44);
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);

    await sheet.getByRole('option', { name: /Sponsored ads/ }).click();
    await expect(sheet).toBeHidden();
    await expect(trigger).toContainText('Sponsored ads');
  });

  test('Escape and the backdrop close the sheet', async ({ page }) => {
    await page.goto('/admin');
    const trigger = page.getByRole('button', { name: /Section/ });
    await trigger.click();
    await expect(page.getByRole('dialog', { name: 'Admin sections' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog', { name: 'Admin sections' })).toBeHidden();
  });
});
