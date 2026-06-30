import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';

// All test records use this prefix so cleanup can target them safely
export const TEST_PREFIX = '[TEST]';

export interface SponsoredAdData {
  partner: string;
  product: string;
  slot: 'hero' | 'grid_inline' | 'below_grid' | 'sidebar';
  headline: string;
  subheadline?: string;
  bullets?: string[];
  ctaLabel: string;
  ctaUrl: string;
  trackingId: string;
  disclosure?: string;
  active?: boolean;
}

export interface TransferBonusData {
  issuer: string;
  partner: string;
  bonusPct: number;
  startDate?: string;
  endDate: string;
  isTargeted?: boolean;
  description?: string;
}

export interface SpendingBonusData {
  issuer: string;
  merchant: string;
  multiplier: number;
  bonusType: 'points_multiplier' | 'cash_back_pct' | 'dollar_amount';
  spendingMinimum?: number;
  startDate?: string;
  endDate: string;
  isTargeted?: boolean;
  description?: string;
}

async function openAdminModal(page: Page, tab: 'Offers' | 'Ads', buttonLabel: string) {
  await page.goto('/offers/admin');
  // Switch to the correct tab if needed
  if (tab === 'Ads') {
    await page.getByRole('tab', { name: /ads/i }).click();
  }
  await page.getByRole('button', { name: new RegExp(buttonLabel, 'i') }).click();
  // Wait for the modal to open
  await expect(page.getByRole('dialog')).toBeVisible();
}

export async function createSponsoredAd(page: Page, data: SponsoredAdData) {
  await openAdminModal(page, 'Ads', 'new ad');

  await page.getByLabel(/partner/i).fill(data.partner);
  await page.getByLabel(/product/i).fill(data.product);

  // Slot selector
  await page.getByLabel(/slot/i).selectOption(data.slot);

  await page.getByLabel(/headline/i).fill(data.headline);

  if (data.subheadline) {
    await page.getByLabel(/subheadline/i).fill(data.subheadline);
  }

  await page.getByLabel(/cta label|button label/i).fill(data.ctaLabel);
  await page.getByLabel(/cta url|destination url/i).fill(data.ctaUrl);
  await page.getByLabel(/tracking id/i).fill(data.trackingId);

  if (data.disclosure) {
    await page.getByLabel(/disclosure/i).fill(data.disclosure);
  }

  if (data.active !== false) {
    const activeToggle = page.getByLabel(/active/i);
    if (!(await activeToggle.isChecked())) {
      await activeToggle.check();
    }
  }

  await page.getByRole('button', { name: /save|create|submit/i }).click();

  // Wait for success confirmation
  await expect(
    page.getByText(/saved|created|success/i).or(page.getByRole('status')),
  ).toBeVisible({ timeout: 10_000 });
}

export async function createTransferBonus(page: Page, data: TransferBonusData) {
  await openAdminModal(page, 'Offers', 'new offer');

  // Select "Transfer" type if there's a toggle
  await page.getByRole('radio', { name: /transfer/i }).check();

  // Issuer selector
  await page.getByLabel(/issuer/i).selectOption(data.issuer);

  // Transfer partner — may be a dropdown or text input
  const partnerField = page.getByLabel(/transfer partner|partner program/i);
  await partnerField.fill(data.partner);

  await page.getByLabel(/bonus.*(percent|%|pct)/i).fill(String(data.bonusPct));
  await page.getByLabel(/end date/i).fill(data.endDate);

  if (data.startDate) {
    await page.getByLabel(/start date/i).fill(data.startDate);
  }

  if (data.isTargeted) {
    await page.getByLabel(/targeted/i).check();
  }

  if (data.description) {
    await page.getByLabel(/description/i).fill(data.description);
  }

  await page.getByRole('button', { name: /save|create|submit/i }).click();

  await expect(
    page.getByText(/saved|created|success/i).or(page.getByRole('status')),
  ).toBeVisible({ timeout: 10_000 });
}

export async function createSpendingBonus(page: Page, data: SpendingBonusData) {
  await openAdminModal(page, 'Offers', 'new offer');

  // Select "Spending" type
  await page.getByRole('radio', { name: /spending/i }).check();

  await page.getByLabel(/issuer/i).selectOption(data.issuer);
  await page.getByLabel(/merchant/i).fill(data.merchant);
  await page.getByLabel(/bonus.*multiplier|multiplier value/i).fill(String(data.multiplier));
  await page.getByLabel(/bonus type/i).selectOption(data.bonusType);
  await page.getByLabel(/end date/i).fill(data.endDate);

  if (data.startDate) {
    await page.getByLabel(/start date/i).fill(data.startDate);
  }

  if (data.spendingMinimum) {
    await page.getByLabel(/spending minimum|min.*spend/i).fill(String(data.spendingMinimum));
  }

  if (data.isTargeted) {
    await page.getByLabel(/targeted/i).check();
  }

  if (data.description) {
    await page.getByLabel(/description/i).fill(data.description);
  }

  await page.getByRole('button', { name: /save|create|submit/i }).click();

  await expect(
    page.getByText(/saved|created|success/i).or(page.getByRole('status')),
  ).toBeVisible({ timeout: 10_000 });
}

/** Change status of an offer row identified by its heading text in the admin table. */
export async function changeOfferStatus(
  page: Page,
  headingText: string,
  action: 'approve' | 'reject' | 'revoke',
) {
  await page.goto('/offers/admin');
  const row = page.getByRole('row', { name: new RegExp(headingText, 'i') });
  await row.getByRole('button', { name: new RegExp(action, 'i') }).click();
  await expect(page.getByText(/updated|saved|success/i)).toBeVisible({ timeout: 5_000 });
}

/** Deactivate a sponsored ad by its headline in the Ads table. */
export async function deactivateAd(page: Page, headline: string) {
  await page.goto('/offers/admin');
  await page.getByRole('tab', { name: /ads/i }).click();
  const row = page.getByRole('row', { name: new RegExp(headline, 'i') });
  await row.getByRole('button', { name: /deactivate|archive/i }).click();
  await expect(page.getByText(/deactivated|archived|saved/i)).toBeVisible({ timeout: 5_000 });
}

/** Returns today's date as YYYY-MM-DD */
export function today(): string {
  return new Date().toISOString().split('T')[0];
}

/** Returns a date N days from now as YYYY-MM-DD */
export function daysFromNow(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().split('T')[0];
}
