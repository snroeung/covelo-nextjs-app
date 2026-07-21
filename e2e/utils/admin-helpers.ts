import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

// All test records use this prefix so cleanup can target them safely
export const TEST_PREFIX = '[TEST]';

export interface SponsoredAdData {
  partner: string;
  product: string;
  slot: 'hero' | 'grid_inline' | 'below_grid' | 'sidebar'
      | 'flights_inline' | 'hotels_inline' | 'planner_native' | 'trip_strip';
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

export async function navigateToAdminSection(page: Page, tab: 'Offers' | 'Ads') {
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

  // AD SLOT — required; label is linked via htmlFor="adSlot"
  await page.getByLabel(/ad slot/i).selectOption({ value: data.slot });

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

  // Wait for loading overlay, then success popup
  await page.getByRole('status', { name: 'Publishing ad' }).waitFor({ timeout: 5_000 }).catch(() => {});
  const successDialog = page.getByRole('dialog', { name: 'Ad published' });
  await successDialog.waitFor({ timeout: 15_000 });
  await successDialog.getByRole('button', { name: 'Done' }).click();

  // After dismissal the view returns to the ads table — click "Sponsored ads" to confirm
  const sponsoredAdsBtn = page.getByRole('button', { name: 'Sponsored ads' });
  await expect(sponsoredAdsBtn).toBeVisible({ timeout: 10_000 });
  await sponsoredAdsBtn.click();
  // Confirm the new ad row appears with Live or Scheduled status
  const adRow = page.locator('div').filter({ hasText: data.headline }).first();
  await expect(
    adRow.locator('span[class*="rounded-full"]').filter({ hasText: /^Live$/ }).first()
  ).toBeVisible({ timeout: 10_000 });
}

export async function createTransferBonus(page: Page, data: TransferBonusData) {
  await navigateToAdminSection(page, 'Offers');

  // "New offer" opens an inline editor panel (not a dialog)
  await page.getByRole('button', { name: /new offer/i }).click();
  await expect(page.getByText('Create a new offer')).toBeVisible({ timeout: 5_000 });

  // Offer type is a toggle button, not a radio — Transfer Bonus is the default
  await page.getByRole('button', { name: 'Transfer Bonus', exact: true }).click();

  // Labels are not linked to inputs (no htmlFor) — locate by option text
  const issuerSelect = page.locator('select:has(option:text("Select issuer…"))');
  await issuerSelect.selectOption(data.issuer);

  // Transfer partner is a dropdown of real programs from TRANSFER_PARTNERS,
  // populated once an issuer is chosen — value is the program name itself
  const partnerSelect = page.locator('select:has(option:text("Select partner…"))');
  await expect(partnerSelect).toBeEnabled({ timeout: 3_000 });
  await partnerSelect.selectOption(data.partner);

  await page.locator('input[type="number"]').first().fill(String(data.bonusPct));

  const dateInputs = page.locator('input[type="date"]');
  if (data.startDate) await dateInputs.first().fill(data.startDate);
  await dateInputs.last().fill(data.endDate);

  if (data.isTargeted) {
    const targetedRow = page.locator('div').filter({ hasText: /available to all cardholders|not available to all cardholders/i }).last();
    await targetedRow.getByRole('button').click();
  }

  if (data.description) {
    await page.locator('textarea').fill(data.description);
  }

  const publishBtn = page.getByRole('button', { name: /publish offer/i });
  await expect(publishBtn).toBeEnabled({ timeout: 5_000 });
  await publishBtn.click();

  // On success the editor closes and the offers table shows the new row
  await expect(page.getByText('Create a new offer')).toBeHidden({ timeout: 15_000 });
  await expect(page.getByText(data.partner).first()).toBeVisible({ timeout: 10_000 });
}

export async function createSpendingBonus(page: Page, data: SpendingBonusData) {
  await navigateToAdminSection(page, 'Offers');

  // "New offer" opens an inline editor panel (not a dialog)
  await page.getByRole('button', { name: /new offer/i }).click();
  await expect(page.getByText('Create a new offer')).toBeVisible({ timeout: 5_000 });

  // Offer type is a toggle button, not a radio
  await page.getByRole('button', { name: 'Spending Bonus' }).click();

  // Labels are not linked to inputs (no htmlFor) — locate by option text / placeholder
  const issuerSelect = page.locator('select:has(option:text("Select issuer…"))');
  await issuerSelect.selectOption(data.issuer);

  await page.getByPlaceholder(/Restaurants, Gas Stations/i).fill(data.merchant);

  // Select bonus type before filling the value (type changes the value field's label)
  const bonusTypeSelect = page.locator('select:has(option:text("Points Multiplier"))');
  await bonusTypeSelect.selectOption(data.bonusType);

  // BONUS MULTIPLIER / DOLLAR AMOUNT is the first number input in the form
  await page.locator('input[type="number"]').first().fill(String(data.multiplier));

  if (data.spendingMinimum) {
    await page.getByPlaceholder('e.g. 500').fill(String(data.spendingMinimum));
  }

  if (data.description) {
    await page.getByPlaceholder(/Earn 5x points at restaurants/i).fill(data.description);
  }

  // Eligible cards — validation requires at least one; select all
  await page.getByRole('button', { name: 'Select all' }).click();

  // Spending form renders exactly two date inputs: START DATE then END DATE
  const dateInputs = page.locator('input[type="date"]');
  if (data.startDate) await dateInputs.first().fill(data.startDate);
  await dateInputs.last().fill(data.endDate);

  if (data.isTargeted) {
    await page.getByRole('button', { name: /available to all cardholders/i }).click().catch(() => {});
  }

  const publishBtn = page.getByRole('button', { name: /publish offer/i });
  await expect(publishBtn).toBeEnabled({ timeout: 5_000 });
  await publishBtn.click();

  // On success the editor closes and the offers table shows the new row
  await expect(page.getByText('Create a new offer')).toBeHidden({ timeout: 15_000 });
  await expect(page.getByText(data.merchant).first()).toBeVisible({ timeout: 10_000 });
}

/** Set the active/inactive state of an offer row identified by its heading text in the admin table. */
export async function setOfferActive(page: Page, headingText: string, active: boolean) {
  await page.goto('/admin');
  const escaped = headingText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(escaped, 'i');
  const btnRe = active ? /^Reactivate$/ : /^Deactivate$/;

  // Each offer renders as one `div.grid` row (key={offer.id}); scoping to the row
  // avoids matching ancestor wrapper divs, so this is exactly one toggle button per
  // matching offer — no nesting inflation.
  const buttons = () =>
    page.locator('div.grid').filter({ hasText: re }).getByRole('button', { name: btnRe });

  await page.getByText(re).first().waitFor({ timeout: 10_000 }).catch(() => {});

  // Sweep every matching row (failed runs leave duplicates). Clicking toggles the
  // offer, but React reuses the button node and just flips its label
  // (Reactivate ⇄ Deactivate), so waiting for the node to "hide" never fires. Wait
  // for the matching-button count to drop instead — that's the true settle signal.
  for (let i = 0; i < 20; i++) {
    const before = await buttons().count();
    if (before === 0) break;
    if (!active) page.once('dialog', (dialog) => dialog.accept()); // Deactivate triggers window.confirm
    await buttons().last().click();
    await expect
      .poll(() => buttons().count(), { timeout: 15_000, intervals: [150, 250, 400, 700, 1000] })
      .toBeLessThan(before);
  }
}

/** Deactivate a sponsored ad by its headline in the Ads table. */
export async function deactivateAd(page: Page, headline: string) {
  await page.goto('/admin');
  await page.getByRole('button', { name: 'Sponsored ads' }).click();

  // Escape regex special chars so "[TEST]" matches literally, not as char class
  const escaped = headline.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(escaped, 'i');

  // Wait for the table to render before counting
  await page.getByText(re).first().waitFor({ timeout: 10_000 }).catch(() => {});

  // Failed earlier runs can leave duplicate ads with the same headline —
  // deactivate every Live/Scheduled row, not just one, or the ad keeps serving.
  for (let i = 0; i < 20; i++) {
    const liveRows = page.locator('div').filter({
      hasText: re,
      has: page.getByRole('button', { name: /^Edit$/ }),
    }).filter({
      has: page.getByRole('button', { name: /^Deactivate$|^Archive$/ }),
    }).filter({
      has: page.locator('span').filter({ hasText: /^Live$|^Scheduled$/ }),
    });

    if ((await liveRows.count()) === 0) break;

    // .last() = innermost div containing headline + buttons + Live badge
    const row = liveRows.last();
    // Deactivate triggers window.confirm — accept it automatically
    page.once('dialog', (dialog) => dialog.accept());
    await row.getByRole('button', { name: /^Deactivate$|^Archive$/ }).first().click();
    // Wait for the mutation to land before re-counting (or navigating away)
    await row.locator('span').filter({ hasText: /^Live$|^Scheduled$/ }).first()
      .waitFor({ state: 'hidden', timeout: 10_000 }).catch(() => {});
  }
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

/**
 * Fills a LocationSearch field (fieldLabel="From"/"To"/"Location") by label text,
 * types the query, waits for the autocomplete dropdown, and clicks the first suggestion.
 */
async function fillLocationSearch(page: Page, fieldLabel: string, query: string) {
  // Find the label span, go up exactly one div level to the field-box container,
  // then target the combobox within it — avoids ancestor bleed across sibling fields.
  const labelSpan = page.locator('span')
    .filter({ hasText: new RegExp(`^${fieldLabel}$`, 'i') })
    .filter({ visible: true })
    .first();
  const fieldBox = labelSpan.locator('xpath=ancestor::div[1]');
  const input = fieldBox.locator('[role="combobox"]');
  await input.click();
  await input.fill(query);
  // Wait for autocomplete suggestions and pick the first one
  const option = page.getByRole('option').first();
  await option.waitFor({ timeout: 8_000 });
  await option.click();
}

/**
 * Submits a flight search on /flights using the real From/To LocationSearch fields.
 * Returns true if the search was submitted successfully.
 */
export async function searchFlights(
  page: Page,
  origin: string,
  destination: string,
  departureDateOffset = 14,
) {
  await page.goto('/flights');

  // Wait for the search form — combobox inputs render after React hydration
  await page.locator('[role="combobox"]').filter({ visible: true }).first().waitFor({ timeout: 15_000 });

  await fillLocationSearch(page, 'From', origin);
  await fillLocationSearch(page, 'To', destination);

  // Trip type — open the "Trip type" dropdown and select "One way"
  await page.getByRole('button', { name: /Trip type/i }).filter({ visible: true }).first().click();
  await page.getByRole('button', { name: /One way/i }).click();

  // Depart date — find visible "Depart" label span, go up one div, grab the date input inside
  const departLabel = page.locator('span, label').filter({ hasText: /^Depart$/i }).filter({ visible: true }).first();
  const departInput = departLabel.locator('xpath=ancestor::div[1]').locator('input[type="date"]').first();
  await departInput.fill(daysFromNow(departureDateOffset));

  await page.getByRole('button', { name: /^Search\s*→/i }).filter({ visible: true }).first().click();
  return true;
}

/**
 * Submits a hotel search on /hotels using the real Location LocationSearch field.
 * Returns true if submitted successfully.
 */
export async function searchHotels(
  page: Page,
  city: string,
  checkInOffset = 14,
  nights = 2,
) {
  await page.goto('/hotels');

  await page.locator('[role="combobox"]').filter({ visible: true }).first().waitFor({ timeout: 15_000 });

  await fillLocationSearch(page, 'Location', city);

  // Check-in / Check-out — find visible label span, go up one div, grab date input
  const checkInLabel  = page.locator('span, label').filter({ hasText: /^Check-in$/i }).filter({ visible: true }).first();
  const checkInInput  = checkInLabel.locator('xpath=ancestor::div[1]').locator('input[type="date"]').first();
  const checkOutLabel = page.locator('span, label').filter({ hasText: /^Check-out$/i }).filter({ visible: true }).first();
  const checkOutInput = checkOutLabel.locator('xpath=ancestor::div[1]').locator('input[type="date"]').first();

  await checkInInput.fill(daysFromNow(checkInOffset));
  await checkOutInput.fill(daysFromNow(checkInOffset + nights));

  await page.getByRole('button', { name: /^Search\s*→/i }).filter({ visible: true }).first().click();
  return true;
}

/**
 * Looks for the `[TEST] Test trip` rail card on /trip-planner and, if found,
 * clicks into it and returns its URL. Trip cards are plain divs (no <a href>),
 * so this clicks through rather than reading an href attribute.
 */
export async function getExistingTestTripUrl(page: Page): Promise<string | null> {
  const card = await test.step(`Check for existing "${TEST_PREFIX} Test trip"`, async () => {
    await page.goto('/trip-planner');
    const el = page.locator('[data-testid="trip-rail-card"]').filter({ hasText: `${TEST_PREFIX} Test trip` }).first();
    // isVisible() ignores its timeout option and returns immediately — must use waitFor
    const found = await el.waitFor({ state: 'visible', timeout: 15_000 }).then(() => true).catch(() => false);
    return found ? el : null;
  });

  if (!card) {
    return test.step('No existing test trip found', async () => null);
  }

  return test.step('Existing test trip found, reusing it', async () => {
    await card.click();
    await page.waitForURL(/\/trip-planner\/.+/, { timeout: 10_000 });
    return page.url();
  });
}

/** Creates a minimal test trip and returns its URL. Used when no existing trip is found. */
export async function createTestTrip(page: Page): Promise<string | null> {
  await page.goto('/trip-planner');

  // Type a destination into the LocationSearch to reveal the create form
  const destInput = page.locator('[role="combobox"]').filter({ visible: true }).first();
  await destInput.waitFor({ timeout: 10_000 });
  await destInput.click();
  await destInput.fill('Paris');
  const option = page.getByRole('option').first();
  await option.waitFor({ timeout: 8_000 });
  await option.click();

  // A prior run's trip in the same area triggers a dupe-warning screen instead
  // of the create form — dismiss it so creation is idempotent across runs.
  const createAnyway = page.getByRole('button', { name: 'Create anyway' });
  const hasDupeWarning = await createAnyway
    .waitFor({ state: 'visible', timeout: 3_000 })
    .then(() => true)
    .catch(() => false);
  if (hasDupeWarning) {
    await createAnyway.click();
  }

  // Fill dates — 30 days out, 3-night stay
  const startDate = daysFromNow(30);
  const endDate   = daysFromNow(33);
  const dateInputs = page.locator('input[type="date"]').filter({ visible: true });
  await dateInputs.first().fill(startDate);
  await dateInputs.last().fill(endDate);

  // Trip name
  await page.getByPlaceholder(/give your trip a name/i).fill(`${TEST_PREFIX} Test trip`);

  // Submit
  await page.getByRole('button', { name: /start planning/i }).click();

  // Wait for navigation to the trip detail page
  await page.waitForURL(/\/trip-planner\/.+/, { timeout: 15_000 });
  return page.url().replace(page.context().pages()[0]?.url() ?? '', '') || page.url();
}

/** Deletes the `[TEST] Test trip` rail card on /trip-planner, if present. No-op if not found. */
export async function deleteTestTrip(page: Page): Promise<void> {
  await page.goto('/trip-planner');
  // Fresh contexts (e.g. browser.newContext() in afterAll) can race client-side
  // session/trip-list hydration on the very first navigation — wait for the rail
  // to finish loading before searching, and reload once if the card still isn't
  // there, rather than trusting a single cold-start render.
  await page.waitForLoadState('networkidle');

  const card = page
    .locator('[data-testid="trip-rail-card"]')
    .filter({ hasText: `${TEST_PREFIX} Test trip` })
    .first();

  let found = await card
    .waitFor({ state: 'visible', timeout: 10_000 })
    .then(() => true)
    .catch(() => false);

  if (!found) {
    await page.reload();
    await page.waitForLoadState('networkidle');
    found = await card
      .waitFor({ state: 'visible', timeout: 10_000 })
      .then(() => true)
      .catch(() => false);
  }

  if (!found) return;
  await card.getByRole('button', { name: 'Remove trip' }).click();
  await card.waitFor({ state: 'hidden', timeout: 10_000 }).catch(() => {});
}
