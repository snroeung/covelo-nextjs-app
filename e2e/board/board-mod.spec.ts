import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// Moderator tools on the board page. The e2e session is the admin account
// (e2e/global-setup.ts). These only open and navigate the dialogs — nothing
// here takes content down or changes a topic.

async function firstPostWithModMenu(page: Page) {
  await page.goto('/discover/board');
  await expect(page.getByRole('heading', { level: 1, name: 'The board' })).toBeVisible();
  const article = page.locator('article').first();
  test.skip((await article.count()) === 0, 'No posts on the board to moderate');
  const mod = article.getByRole('button', { name: 'Mod', exact: true });
  await expect(mod).toBeVisible();
  return mod;
}

test.describe('The board — moderator tools', () => {
  test('1. admin sees Mod on a post and it opens the moderation dialog', async ({ page }) => {
    const mod = await firstPostWithModMenu(page);
    await mod.click();
    const dialog = page.getByRole('dialog', { name: 'Moderate this post' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Take down…' })).toBeVisible();
    await expect(dialog.getByRole('button', { name: /lock comments/i })).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Change topic…' })).toBeVisible();
  });

  test('2. Take down needs a reason before it can be submitted, and Back returns', async ({ page }) => {
    await (await firstPostWithModMenu(page)).click();
    await page.getByRole('button', { name: 'Take down…' }).click();
    const dialog = page.getByRole('dialog', { name: 'Take down' });
    const submit = dialog.getByRole('button', { name: 'Take down', exact: true });
    await expect(submit).toBeDisabled();
    await dialog.getByLabel('Spam').check();
    await expect(submit).toBeEnabled();
    await dialog.getByRole('button', { name: 'Back' }).click();
    await expect(page.getByRole('dialog', { name: 'Moderate this post' })).toBeVisible();
  });

  test('3. moderation dialog passes accessibility checks', async ({ page }) => {
    await (await firstPostWithModMenu(page)).click();
    await expect(page.getByRole('dialog', { name: 'Moderate this post' })).toBeVisible();
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });

  test('4. moderation dialog is usable at 375px and Escape closes it', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await (await firstPostWithModMenu(page)).click();
    const dialog = page.getByRole('dialog', { name: 'Moderate this post' });
    await expect(dialog).toBeVisible();
    expect((await dialog.boundingBox())!.width).toBeLessThanOrEqual(375);
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
  });

  test('5. picking a topic chip offers topic tools to the admin', async ({ page }) => {
    await page.goto('/discover/board');
    const chips = page.getByRole('group', { name: 'Filter by topic' });
    const topic = chips.getByRole('button', { pressed: false }).nth(1);
    test.skip((await topic.count()) === 0, 'No topic chips to select');
    await topic.click();
    const manage = page.getByRole('button', { name: /^Manage/ });
    await expect(manage).toBeVisible();
    await manage.click();
    const dialog = page.getByRole('dialog', { name: /^Manage topic/ });
    await expect(dialog.getByLabel('RENAME')).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Merge' })).toBeDisabled();
  });
});
