import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { uuid } from 'zod/v4-mini';

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

async function navigateToAdminSection(page: Page, tab: 'Offers' | 'Ads') {
  // 1. Go to /offers
  await page.goto('/offers');
  // 2. Open profile popup
  await page.getByRole('button', { name: /open profile|profile/i }).click();
  // 3. Click "Offers Admin" in the popup
  await page.getByRole('link', { name: /offers admin/i })
    .or(page.getByRole('button', { name: /offers admin/i }))
    .click();
  // 4. Click the correct tab
  if (tab === 'Ads') {
    await page.getByRole('button', { name: 'Sponsored ads' }).click();
  } else {
    await page.getByRole('button', { name: 'Offers' }).click();
  }
}

export async function createSponsoredAd(page: Page, data: SponsoredAdData) {
  await navigateToAdminSection(page, 'Ads');

  // 5. Click "New ad" — form opens inline (not a dialog)
  await page.getByRole('button', { name: /new ad/i }).click();
  await expect(page.getByText('Create a new ad placement')).toBeVisible({ timeout: 5_000 });

  // 6. Section 1 — Partner & Product
  // CARD ISSUER combobox (first combobox on the page)
  await page.getByRole('combobox').first().selectOption({ label: data.partner });
  // After selecting an issuer a CARD NAME select appears (identified by its "Select card…" placeholder)
  const cardNameSelect = page.locator('select:has(option:text("Select card…"))');
  await expect(cardNameSelect).toBeVisible({ timeout: 3_000 });
  await cardNameSelect.selectOption({ label: data.product });

  // 6. Section 2 — Creative
  // HEADLINE — placeholder: "60,000 bonus points + $50 hotel credit"
  await page.getByPlaceholder(/60,000 bonus points/i).fill(data.headline);

  if (data.subheadline) {
    // SUBHEADLINE — placeholder: "After $4,000 spend in your first 3 months…"
    await page.getByPlaceholder(/After \$4,000 spend/i).fill(data.subheadline);
  }

  // 6. Section 3 — CTA & Tracking
  // CTA LABEL — placeholder: "Apply now"
  await page.getByPlaceholder('Apply now').fill(data.ctaLabel);
  // DESTINATION URL — placeholder: "https://…"
  await page.getByPlaceholder('https://…').fill(data.ctaUrl);
  // TRACKING ID — placeholder: "covelo-CSP-2026Q2"
  await page.getByPlaceholder('covelo-CSP-2026Q2').fill(`${data.trackingId}-${Date.now()}`);

  if (data.disclosure) {
    // DISCLOSURE — large textarea; locate by proximity to "DISCLOSURE" text
    await page.locator('textarea').filter({ hasText: /advertiser disclosure/i })
      .or(page.getByPlaceholder(/advertiser disclosure/i))
      .fill(data.disclosure);
  }

  // 6. Section 4 — Schedule & Targeting
  const startInput = page.locator('input[type="date"]').first();
  const endInput = page.locator('input[type="date"]').last();
  await startInput.fill(today());
  await endInput.fill(daysFromNow(7));

  // Toggle to Active (default state is Inactive)
  if (data.active !== false) {
    const toggleBtn = page.getByRole('button', { name: /inactive/i });
    if (await toggleBtn.isVisible()) {
      await toggleBtn.click();
      await expect(page.getByRole('button', { name: /active/i })).toBeVisible({ timeout: 3_000 });
    }
  }

  // 7. Publish
  await page.getByRole('button', { name: 'Publish ad' }).click();
  // After publish the form closes and the view returns to the ads table — click "Sponsored ads" to confirm
  const sponsoredAdsBtn = page.getByRole('button', { name: 'Sponsored ads' });
  await expect(sponsoredAdsBtn).toBeVisible({ timeout: 10_000 });
  await sponsoredAdsBtn.click();
  // Confirm the new ad row appears with Live or Scheduled status
  const adRow = page.locator('div').filter({ hasText: data.headline }).first();
  await expect(adRow.getByText(/^(Live)$/)).toBeVisible({ timeout: 10_000 });

  // 8. Go back to /offers
  await page.goto('/offers');
}

export async function createTransferBonus(page: Page, data: TransferBonusData) {
  await navigateToAdminSection(page, 'Offers');
  await page.getByRole('button', { name: /new offer/i }).click();
  await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5_000 });

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
  await navigateToAdminSection(page, 'Offers');
  await page.getByRole('button', { name: /new offer/i }).click();
  await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5_000 });

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
  // Rows are CSS grid divs — find by content text + presence of Edit button
  const row = page.locator('div').filter({
    hasText: new RegExp(headingText, 'i'),
    has: page.getByRole('button', { name: /edit/i }),
  }).first();
  await row.getByRole('button', { name: new RegExp(action, 'i') }).click();
}

/** Deactivate a sponsored ad by its headline in the Ads table. */
export async function deactivateAd(page: Page, headline: string) {
  await page.goto('/offers/admin');
  await page.getByRole('button', { name: 'Sponsored ads' }).click();

  // Rows are CSS grid divs — find the one containing the headline and an Edit button
  const row = page.locator('div').filter({
    hasText: new RegExp(headline, 'i'),
    has: page.getByRole('button', { name: /edit/i }),
  }).first();

  // Deactivate triggers window.confirm — accept it automatically
  page.once('dialog', (dialog) => dialog.accept());
  await row.getByRole('button', { name: /deactivate|archive/i }).click();
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
