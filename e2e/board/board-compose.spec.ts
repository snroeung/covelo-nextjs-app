import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// The composer's "Create new offer" form takes the same structured fields as
// the admin offer editor. These only fill the form in — nothing is posted.

async function openNewOfferForm(page: Page) {
  await page.goto('/discover/board?compose=1');
  const dialog = page.getByRole('dialog', { name: 'New post' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('group', { name: 'What are you posting?' }).getByRole('button', { name: /^Offer/ }).click();
  await dialog.getByRole('button', { name: 'Create new offer' }).click();
  await expect(dialog.getByRole('group', { name: 'Offer type' })).toBeVisible();
  return dialog;
}

test.describe('The board — composer new offer', () => {
  test('1. shows the structured offer fields, not free-text type/value/name', async ({ page }) => {
    const dialog = await openNewOfferForm(page);
    await expect(dialog.getByText('1 · ISSUER & PARTNER')).toBeVisible();
    await expect(dialog.getByText('2 · ELIGIBLE CARDS')).toBeVisible();
    await expect(dialog.getByText('3 · TAGS, DATES & FLAGS')).toBeVisible();
    await expect(dialog.getByLabel('ISSUER')).toBeVisible();
    await expect(dialog.getByLabel('TRANSFER PARTNER')).toBeEnabled();
    await expect(dialog.getByLabel('BONUS %')).toBeVisible();
    await expect(dialog.getByText('EFFECTIVE RATIO')).toBeVisible();
    await expect(dialog.getByLabel(/MIN TRANSFER PTS/)).toBeVisible();
    await expect(dialog.getByLabel('OFFER NAME')).toHaveCount(0);
  });

  test('2. picking an issuer enables partners; Specific cards lists that issuer\'s cards', async ({ page }) => {
    const dialog = await openNewOfferForm(page);
    await dialog.getByLabel('ISSUER').selectOption('chase');
    await expect(dialog.getByLabel('TRANSFER PARTNER')).toBeEnabled();
    await expect(dialog.getByRole('button', { name: 'All cards' })).toHaveAttribute('aria-pressed', 'true');
    await dialog.getByRole('button', { name: 'Specific cards' }).click();
    expect(await dialog.getByRole('checkbox').count()).toBeGreaterThan(1);
    await dialog.getByRole('button', { name: 'All cards' }).click();
    await expect(dialog.getByRole('checkbox', { name: /Sapphire/ })).toHaveCount(0);
  });

  test('2b. a transfer partner can be picked before any issuer', async ({ page }) => {
    const dialog = await openNewOfferForm(page);
    const partner = dialog.getByLabel('TRANSFER PARTNER');
    await expect.poll(async () => partner.locator('option').count()).toBeGreaterThan(5);
    await partner.selectOption({ index: 1 });
    await expect(partner).not.toHaveValue('');
    // Picking the issuer afterwards keeps the partner only if that issuer reaches it
    await dialog.getByLabel('ISSUER').selectOption({ index: 1 });
    await expect(dialog.getByLabel('ISSUER')).not.toHaveValue('');
  });

  test('3. switching to a spending bonus swaps the fields', async ({ page }) => {
    const dialog = await openNewOfferForm(page);
    await dialog.getByRole('button', { name: 'Spending bonus' }).click();
    await expect(dialog.getByText('1 · ISSUER & MERCHANT')).toBeVisible();
    await expect(dialog.getByLabel('MERCHANT NAME')).toBeVisible();
    await expect(dialog.getByLabel('TRANSFER PARTNER')).toHaveCount(0);
  });

  test('4a. the validation checklist updates as fields are filled, and the effective ratio follows the bonus', async ({ page }) => {
    const dialog = await openNewOfferForm(page);
    const checklist = dialog.getByRole('region', { name: 'Validation and preview' });
    await expect(checklist.getByText('Issuer selected')).toBeVisible();
    await expect(checklist.getByText('REQUIRED')).toHaveCount(6 - 1); // source URL is valid while blank
    await dialog.getByLabel('ISSUER').selectOption('amex');
    await dialog.getByLabel('BONUS %').fill('30');
    await expect(dialog.getByLabel('Effective ratio 1.3000 to 1')).toHaveText('1.3000:1');
    await dialog.getByLabel('START DATE').fill('2026-11-01');
    await dialog.getByLabel('END DATE').fill('2026-12-31');
    await expect(checklist.getByText('REQUIRED')).toHaveCount(1); // only the partner is left
  });

  test('4b. tags and the status-deal switch toggle', async ({ page }) => {
    const dialog = await openNewOfferForm(page);
    const tag = dialog.getByRole('button', { name: 'Transfer bonus', exact: true });
    await tag.click();
    await expect(tag).toHaveAttribute('aria-pressed', 'true');
    await expect(dialog.getByRole('switch', { name: /cardholders/ })).toHaveCount(0);
    const status = dialog.getByRole('switch', { name: 'Not a status deal' });
    await status.click();
    await expect(dialog.getByRole('switch', { name: 'Status deal' })).toHaveAttribute('aria-checked', 'true');
  });

  test('4. an unfinished offer keeps Post disabled', async ({ page }) => {
    const dialog = await openNewOfferForm(page);
    await dialog.getByLabel(/title/i).fill('Test offer');
    await expect(dialog.getByRole('button', { name: /^Post/ })).toBeDisabled();
  });

  test('5. the new offer form passes accessibility checks and fits 375px', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    const dialog = await openNewOfferForm(page);
    expect((await dialog.boundingBox())!.width).toBeLessThanOrEqual(375);
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });
});
