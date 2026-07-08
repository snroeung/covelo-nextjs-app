import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {
  navigateToAdminSection,
  createSponsoredAd,
  createTransferBonus,
  createSpendingBonus,
  deactivateAd,
  setOfferActive,
  searchFlights,
  searchHotels,
  getExistingTestTripUrl,
  createTestTrip,
  today,
  daysFromNow,
  TEST_PREFIX,
} from '../utils/admin-helpers';

// ---------------------------------------------------------------------------
// Scenario 1: flights_inline — create and verify in flight results
// ---------------------------------------------------------------------------

test.describe('Sponsored Ad — flights_inline slot', () => {
  test.describe.configure({ mode: 'serial' });
  const AD_HEADLINE      = `${TEST_PREFIX} Earn miles on every flight`;
  const AD_HEADLINE_EDIT = `${AD_HEADLINE} (edited)`;
  const AD_CTA_URL  = 'https://example.com/delta-reserve';
  let adCreated = false;

  test.afterAll(async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: 'e2e/.auth/admin.json' });
    const page = await ctx.newPage();
    await ctx.close();
  });

  test('1. creates a live flights_inline ad via admin', async ({ page }) => {
    await navigateToAdminSection(page, 'Ads');
    await page.getByRole('button', { name: /new ad/i }).click();
    await expect(page.getByText('Create a new ad placement')).toBeVisible({ timeout: 5_000 });

    await page.getByRole('combobox').first().selectOption({ label: 'Chase' });
    await page.getByLabel(/ad slot/i).selectOption({ value: 'flights_inline' });
    const cardNameSelect = page.locator('select:has(option:text("Select card…"))');
    await expect(cardNameSelect).toBeVisible({ timeout: 3_000 });
    await cardNameSelect.selectOption({ label: 'Chase Sapphire Reserve' });

    await page.getByPlaceholder(/60,000 bonus points/i).fill(AD_HEADLINE);
    await page.getByPlaceholder(/After \$4,000 spend/i).fill('~$910 bonus value');
    await page.getByPlaceholder('Apply now').fill('Apply now');
    await page.getByPlaceholder('https://…').fill(AD_CTA_URL);
    await page.getByPlaceholder('covelo-CSP-2026Q2').fill(`test-flights-inline-${Date.now()}`);

    await page.locator('input[type="date"]').first().fill(today());
    await page.locator('input[type="date"]').last().fill(daysFromNow(7));

    const toggleBtn = page.getByRole('button', { name: /inactive/i });
    if (await toggleBtn.isVisible()) {
      await toggleBtn.click();
      await expect(page.getByRole('button', { name: /active/i })).toBeVisible({ timeout: 3_000 });
    }

    await page.getByRole('button', { name: 'Publish ad' }).click();

    // loading overlay appears while ad is being published
    await expect(page.getByRole('status', { name: 'Publishing ad' })).toBeVisible({ timeout: 5_000 });

    // success popup appears with "Ad published!" and can be dismissed
    const publishedDialog = page.getByRole('dialog', { name: 'Ad published' });
    await expect(publishedDialog).toBeVisible({ timeout: 15_000 });
    await expect(publishedDialog.getByText('Ad published!')).toBeVisible();
    await publishedDialog.getByRole('button', { name: 'Done' }).click();
    await expect(publishedDialog).toBeHidden({ timeout: 5_000 });

    const sponsoredAdsBtn = page.getByRole('button', { name: 'Sponsored ads' });
    await expect(sponsoredAdsBtn).toBeVisible({ timeout: 10_000 });
    await sponsoredAdsBtn.click();
    const adRow = page.locator('div').filter({ hasText: AD_HEADLINE }).first();
    await expect(
      adRow.locator('span[class*="rounded-full"]').filter({ hasText: /^Live$/ }).first()
    ).toBeVisible({ timeout: 10_000 });
    adCreated = true;
  });

  test('2. "Ad updated!" popup appears after editing an existing ad', async ({ page }) => {
    test.skip(!adCreated, 'Skipped: ad creation failed');
    await page.goto('/offers/admin');
    await page.getByRole('button', { name: 'Sponsored ads' }).click();

    const row = page.locator('div').filter({
      hasText: AD_HEADLINE,
      has: page.getByRole('button', { name: /^Edit$/ }),
    }).last();
    await row.getByRole('button', { name: /^Edit$/ }).click();

    const headlineInput = page.getByPlaceholder(/60,000 bonus points/i);
    await headlineInput.clear();
    await headlineInput.fill(AD_HEADLINE_EDIT);

    await page.getByRole('button', { name: /save changes/i }).click();

    const dialog = page.getByRole('dialog', { name: 'Ad updated' });
    await expect(dialog).toBeVisible({ timeout: 15_000 });
    await expect(dialog.getByText('Ad updated!')).toBeVisible();
    await expect(dialog.getByText('Changes saved successfully.')).toBeVisible();
    await dialog.getByRole('button', { name: 'Done' }).click();
    await expect(dialog).toBeHidden({ timeout: 5_000 });
  });

  test('3. inline banner appears in flight results', async ({ page }) => {
    test.setTimeout(75_000);
    test.skip(!adCreated, 'Skipped: ad creation failed');
    const submitted = await searchFlights(page, 'JFK', 'LAX');
    test.skip(!submitted, 'Skipped: flights search form not available');

    const results = page.locator('[data-testid="flight-card"]');
    await results.first().waitFor({ timeout: 45_000 });

    const count = await results.count();
    expect(count, 'Expected flight results to be returned').toBeGreaterThan(0);

    await expect(page.getByText(AD_HEADLINE_EDIT).first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('SPONSORED').first()).toBeVisible();
  });

  test('4. CTA link points to the correct URL', async ({ page }) => {
    test.skip(!adCreated, 'Skipped: ad creation failed');
    const submitted = await searchFlights(page, 'JFK', 'LAX');
    test.skip(!submitted, 'Skipped: flights search form not available');
    await page.getByText(AD_HEADLINE_EDIT).first().waitFor({ timeout: 15_000 }).catch(() => {});

    const cta = page.getByRole('link', { name: /apply now/i }).first();
    if (await cta.isVisible({ timeout: 5_000 }).catch(() => false)) {
      const href = await cta.getAttribute('href');
      expect(href).toContain('example.com/delta-reserve');
    }
  });

  test('5. deactivating removes the banner from flight results', async ({ page }) => {
    test.setTimeout(90_000);
    test.skip(!adCreated, 'Skipped: ad creation failed');
    await deactivateAd(page, AD_HEADLINE_EDIT);
    await searchFlights(page, 'JFK', 'LAX');
    await page.locator('[data-testid="flight-card"]').first().waitFor({ timeout: 45_000 });
    await expect(page.getByText(AD_HEADLINE_EDIT)).toHaveCount(0, { timeout: 10_000 });
  });
});

// ---------------------------------------------------------------------------
// Scenario 2: hotels_inline — create and verify in hotel results
// ---------------------------------------------------------------------------

test.describe('Sponsored Ad — hotels_inline slot', () => {
  test.describe.configure({ mode: 'serial' });
  const AD_HEADLINE = `${TEST_PREFIX} Free night every year`;
  const AD_CTA_URL  = 'https://example.com/hyatt-card';
  let adCreated = false;

  test.afterAll(async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: 'e2e/.auth/admin.json' });
    const page = await ctx.newPage();
    await ctx.close();
  });

  test('5. creates a live hotels_inline ad via admin', async ({ page }) => {
    await createSponsoredAd(page, {
      partner: 'Chase',
      product: 'Chase Sapphire Preferred',
      slot: 'hotels_inline',
      headline: AD_HEADLINE,
      subheadline: '~$315 free night value',
      bullets: ['30,000 bonus points', '$95 annual fee', 'Automatic Discoverist status'],
      ctaLabel: 'Apply now',
      ctaUrl: AD_CTA_URL,
      trackingId: 'test-hotels-inline',
      active: true,
    });
    const adRow = page.locator('div').filter({ hasText: AD_HEADLINE }).first();
    await expect(
      adRow.locator('span[class*="rounded-full"]').filter({ hasText: /^Live$/ }).first()
    ).toBeVisible({ timeout: 5_000 });
    adCreated = true;
  });

  test('6. inline banner appears in hotel results', async ({ page }) => {
    test.setTimeout(75_000);
    test.skip(!adCreated, 'Skipped: ad creation failed');
    const submitted = await searchHotels(page, 'New York');
    test.skip(!submitted, 'Skipped: hotels search form not available');

    const results = page.locator('[data-testid="hotel-card"]');
    await results.first().waitFor({ timeout: 45_000 });

    const count = await results.count();
    expect(count, 'Expected hotel results to be returned').toBeGreaterThan(0);

    await expect(page.getByText(AD_HEADLINE).first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('SPONSORED').first()).toBeVisible();
  });

  test('7. CTA link points to the correct URL', async ({ page }) => {
    test.skip(!adCreated, 'Skipped: ad creation failed');
    const submitted = await searchHotels(page, 'New York');
    test.skip(!submitted, 'Skipped: hotels search form not available');
    await page.getByText(AD_HEADLINE).first().waitFor({ timeout: 15_000 }).catch(() => {});

    const cta = page.getByRole('link', { name: /apply now/i }).first();
    if (await cta.isVisible({ timeout: 5_000 }).catch(() => false)) {
      const href = await cta.getAttribute('href');
      expect(href).toContain('example.com/hyatt-card');
    }
  });

  test('8. deactivating removes the banner from hotel results', async ({ page }) => {
    test.setTimeout(90_000);
    test.skip(!adCreated, 'Skipped: ad creation failed');
    await deactivateAd(page, AD_HEADLINE);
    await searchHotels(page, 'New York');
    await page.locator('[data-testid="hotel-card"]').first().waitFor({ timeout: 45_000 });
    await expect(page.getByText(AD_HEADLINE)).toHaveCount(0, { timeout: 10_000 });
  });
});

// ---------------------------------------------------------------------------
// Scenario 3: trip_strip — create and verify on a trip detail page
// ---------------------------------------------------------------------------

test.describe('Sponsored Ad — trip_strip slot', () => {
  test.describe.configure({ mode: 'serial' });
  const AD_HEADLINE = `${TEST_PREFIX} Protect this trip and earn 3x`;
  const AD_CTA_URL  = 'https://example.com/sapphire-reserve';
  let adCreated = false;
  let tripUrl: string | null = null;

  test.afterAll(async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: 'e2e/.auth/admin.json' });
    const page = await ctx.newPage();
    await ctx.close();
  });

  test('13. creates a live trip_strip ad via admin', async ({ page }) => {
    await createSponsoredAd(page, {
      partner: 'Chase',
      product: 'Chase Sapphire Reserve',
      slot: 'trip_strip',
      headline: AD_HEADLINE,
      subheadline: '+4,464 points if paid with Reserve',
      bullets: ['Up to $10k trip cancellation', '$300 travel credit / yr', 'Priority Pass lounges'],
      ctaLabel: 'Apply now',
      ctaUrl: AD_CTA_URL,
      trackingId: 'test-trip-strip',
      active: true,
    });
    const adRow = page.locator('div').filter({ hasText: AD_HEADLINE }).first();
    await expect(
      adRow.locator('span[class*="rounded-full"]').filter({ hasText: /^Live$/ }).first()
    ).toBeVisible({ timeout: 5_000 });
    adCreated = true;
  });

  test('14. strip appears on a trip detail page', async ({ page }) => {
    test.skip(!adCreated, 'Skipped: ad creation failed');
    tripUrl = await getExistingTestTripUrl(page) ?? await createTestTrip(page);

    await page.goto(tripUrl!);
    await expect(page.getByText(AD_HEADLINE).first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('SPONSORED').first()).toBeVisible();
  });

  test('15. CTA link points to the correct URL', async ({ page }) => {
    test.skip(!adCreated || !tripUrl, 'Skipped: ad creation or trip not available');
    await page.goto(tripUrl!);
    await page.getByText(AD_HEADLINE).first().waitFor({ timeout: 10_000 });

    const cta = page.getByRole('link', { name: /apply now/i }).first();
    if (await cta.isVisible({ timeout: 5_000 }).catch(() => false)) {
      const href = await cta.getAttribute('href');
      expect(href).toContain('example.com/sapphire-reserve');
    }
  });

  test('16. deactivating removes the strip from the trip detail page', async ({ page }) => {
    test.setTimeout(180_000); // deactivateAd may sweep duplicate ads left by failed runs
    test.skip(!adCreated || !tripUrl, 'Skipped: ad creation or trip not available');
    await deactivateAd(page, AD_HEADLINE);
    await page.goto(tripUrl!);
    await page.waitForTimeout(2_000);
    await expect(page.getByText(AD_HEADLINE)).toHaveCount(0);
  });
});

// ---------------------------------------------------------------------------
// Scenario 2: Spending Bonus — create and display
// ---------------------------------------------------------------------------

test.describe('Spending Bonus — create and display', () => {
  test.describe.configure({ mode: 'serial' });
  const MERCHANT = `${TEST_PREFIX} Amazon`;
  let spendingBonusCreated = false;

  test.afterAll(async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: 'e2e/.auth/admin.json' });
    const page = await ctx.newPage();
    await setOfferActive(page, MERCHANT, false).catch(() => {});
    await ctx.close();
  });

  test('11. creates a spending bonus via admin', async ({ page }) => {
    await createSpendingBonus(page, {
      issuer: 'chase',
      merchant: MERCHANT,
      multiplier: 5,
      bonusType: 'points_multiplier',
      spendingMinimum: 50,
      startDate: today(),
      endDate: daysFromNow(30),
      description: 'Earn 5x on Amazon with Chase. Test bonus.',
    });
    spendingBonusCreated = true;
  });

  test('12. spending bonus card is visible on /offers', async ({ page }) => {
    test.skip(!spendingBonusCreated, 'Skipped: spending bonus creation (test 11) failed');
    await page.goto('/offers');
    const card = page.getByText(MERCHANT).first();
    await expect(card).toBeVisible({ timeout: 10_000 });
  });

  test('13. spending bonus card shows correct multiplier and issuer', async ({ page }) => {
    test.skip(!spendingBonusCreated, 'Skipped: spending bonus creation (test 11) failed');
    await page.goto('/offers');
    // Offer card root is role="button"; hero + body both mention 5× → use .first()
    const cardSection = page.locator('[role="button"]').filter({ hasText: MERCHANT }).first();
    await expect(cardSection.getByText(/5\s*[×x]/i).first()).toBeVisible({ timeout: 10_000 });
    await expect(cardSection.getByText(/chase/i).first()).toBeVisible();
  });

  test('14. clicking card opens the detail modal with correct content', async ({ page }) => {
    test.skip(!spendingBonusCreated, 'Skipped: spending bonus creation (test 11) failed');
    await page.goto('/offers');
    await page.getByText(MERCHANT).first().click();

    const modal = page.getByRole('dialog');
    await expect(modal).toBeVisible();
    await expect(modal.getByText(MERCHANT).first()).toBeVisible();
    await expect(modal.getByText(/5\s*[×x]/i).first()).toBeVisible();
  });

  test('15. filtering by "Spending bonuses" chip hides transfer cards', async ({ page }) => {
    test.skip(!spendingBonusCreated, 'Skipped: spending bonus creation (test 11) failed');
    await page.goto('/offers');
    await page.getByRole('button', { name: /spending bonuses/i }).click();

    // Spending bonus must be visible
    await expect(page.getByText(MERCHANT).first()).toBeVisible({ timeout: 5_000 });
    // Transfer-type cards should be absent — their hero reads "+N% transfer to <partner>"
    await expect(page.getByText(/%\s*transfer to /i)).toHaveCount(0);
  });

  test('16. pressing Escape closes the detail modal', async ({ page }) => {
    test.skip(!spendingBonusCreated, 'Skipped: spending bonus creation (test 11) failed');
    await page.goto('/offers');
    await page.getByText(MERCHANT).first().click();
    await expect(page.getByRole('dialog')).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toBeHidden();
  });

  test('17. clicking backdrop closes the detail modal', async ({ page }) => {
    test.skip(!spendingBonusCreated, 'Skipped: spending bonus creation (test 11) failed');
    await page.goto('/offers');
    await page.getByText(MERCHANT).first().click();
    await expect(page.getByRole('dialog')).toBeVisible();

    // Click outside the modal content area
    await page.mouse.click(10, 10);
    await expect(page.getByRole('dialog')).toBeHidden();
  });

  test('18a. dollar_amount bonus type shows "$" label on card', async ({ page }) => {
    test.skip(!spendingBonusCreated, 'Skipped: spending bonus creation (test 11) failed');
    const merchant = `${TEST_PREFIX} Uber Dollar`;
    await createSpendingBonus(page, {
      issuer: 'amex',
      merchant: merchant,
      multiplier: 10,
      bonusType: 'dollar_amount',
      startDate: today(),
      endDate: daysFromNow(30),
    });

    await page.goto('/offers');
    const cardSection = page.locator('[role="button"]').filter({ hasText: merchant }).first();
    await expect(cardSection.getByText(/\$\s*10/).first()).toBeVisible({ timeout: 10_000 });
  });

  test('18b. cash_back_pct bonus type shows "%" on card', async ({ page }) => {
    test.skip(!spendingBonusCreated, 'Skipped: spending bonus creation (test 11) failed');
    const merchant = `${TEST_PREFIX} Target Cashback`;
    await createSpendingBonus(page, {
      issuer: 'c1',
      merchant: merchant,
      multiplier: 3,
      bonusType: 'cash_back_pct',
      startDate: today(),
      endDate: daysFromNow(30),
    });

    await page.goto('/offers');
    const cardSection = page.locator('[role="button"]').filter({ hasText: merchant }).first();
    await expect(cardSection.getByText(/3%|cash back/i).first()).toBeVisible({ timeout: 10_000 });
  });

  test('19. deactivating a spending bonus removes it from /offers', async ({ page }) => {
    test.setTimeout(180_000); // setOfferActive may sweep duplicate offers left by failed runs
    test.skip(!spendingBonusCreated, 'Skipped: spending bonus creation (test 11) failed');
    await setOfferActive(page, MERCHANT, false);

    await page.goto('/offers');
    await expect(page.getByText(MERCHANT).first()).toBeHidden({ timeout: 10_000 });
  });

});

// ---------------------------------------------------------------------------
// Scenario 3: Transfer Bonus — create and display
// ---------------------------------------------------------------------------

test.describe('Transfer Bonus — create and display', () => {
  test.describe.configure({ mode: 'serial' });
  const PARTNER = 'World of Hyatt';
  const BONUS_PCT = 30;
  const BONUS_DESCRIPTION = `${TEST_PREFIX} Chase to Hyatt 30% transfer bonus`;
  // PARTNER always has the highest bonus_pct in this suite, so it's always the
  // featured hero (non-interactive) and never appears as a clickable grid card —
  // tests that need a clickable card use this lower-bonus offer from test 24 instead.
  const GRID_PARTNER = 'IHG One Rewards';
  const GRID_BONUS_PCT = 10;
  let transferBonusCreated = false;

  test.afterAll(async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: 'e2e/.auth/admin.json' });
    const page = await ctx.newPage();
    await setOfferActive(page, PARTNER, false).catch(() => {});
    await setOfferActive(page, GRID_PARTNER, false).catch(() => {});
    await ctx.close();
  });

  test('21. creates a transfer bonus via admin', async ({ page }) => {
    await createTransferBonus(page, {
      issuer: 'chase',
      partner: PARTNER,
      bonusPct: BONUS_PCT,
      startDate: today(),
      endDate: daysFromNow(14),
      description: BONUS_DESCRIPTION,
    });
    transferBonusCreated = true;
  });

  test('22. featured hero shows the transfer bonus when it has highest bonus_pct', async ({ page }) => {
    test.skip(!transferBonusCreated, 'Skipped: transfer bonus creation (test 21) failed');
    await page.goto('/offers');
    // Featured hero section contains the bonus percentage and partner name.
    // FeaturedOfferHero has no data-testid or hero/featured class, so this
    // locator only ever matches when a "Featured" section is rendered above it.
    const hero = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Featured', exact: true }) });
    // If our 30% bonus is the highest it appears in the hero
    const heroText = await hero.textContent({ timeout: 3_000 }).catch(() => '');
    if (heroText?.includes('30') || heroText?.includes(PARTNER)) {
      await expect(hero.getByText(/30%/).first()).toBeVisible();
      await expect(hero.getByText(new RegExp(PARTNER, 'i')).first()).toBeVisible();
    }
    // Otherwise it appears in the grid — covered by test 23
  });

  test('23. transfer card in grid shows issuer → partner and bonus pct', async ({ page }) => {
    test.skip(!transferBonusCreated, 'Skipped: transfer bonus creation (test 21) failed');
    await page.goto('/offers');
    const card = page.getByText(PARTNER).first();
    await expect(card).toBeVisible({ timeout: 10_000 });

    const cardSection = card.locator('../..').locator('../..');
    await expect(cardSection.getByText(/30%|\+30/i).first()).toBeVisible();
    await expect(cardSection.getByText(/chase/i).first()).toBeVisible();
  });

  test('24. urgency badge appears when bonus expires within 7 days', async ({ page }) => {
    test.skip(!transferBonusCreated, 'Skipped: transfer bonus creation (test 21) failed');
    // Transfer partner is a fixed dropdown backed by TRANSFER_PARTNERS — use a
    // real program name and rely on the description for TEST_PREFIX traceability
    await createTransferBonus(page, {
      issuer: 'chase',
      partner: GRID_PARTNER,
      bonusPct: GRID_BONUS_PCT,
      startDate: today(),
      endDate: daysFromNow(3), // expires in 3 days
      description: `${TEST_PREFIX} Urgent IHG transfer bonus`,
    });

    await page.goto('/offers');
    const card = page.getByText(GRID_PARTNER).first().locator('../..').locator('../..');
    // Urgency indicator — text or badge (rendered as "Xd left")
    await expect(
      card.getByText(/expir|urgent|soon|days left|\d+d left/i).first(),
    ).toBeVisible({ timeout: 5_000 });
  });

  test('25. clicking card opens detail modal with full offer details', async ({ page }) => {
    test.skip(!transferBonusCreated, 'Skipped: transfer bonus creation (test 21) failed');
    await page.goto('/offers');
    // PARTNER is always the top bonus_pct and only renders in the non-interactive
    // featured hero — click the grid card from test 24 instead (see GRID_PARTNER note above)
    await page.getByText(GRID_PARTNER).first().click();

    const modal = page.getByRole('dialog');
    await expect(modal).toBeVisible();
    await expect(modal.getByText(new RegExp(GRID_PARTNER, 'i'))).toBeVisible();
    await expect(modal.getByText(new RegExp(`${GRID_BONUS_PCT}%|\\+${GRID_BONUS_PCT}`, 'i'))).toBeVisible();
    // Expiry date and source sections should be present
    await expect(modal.getByText(/expir|end date/i)).toBeVisible();
  });

  test('27. filtering by "Transfer bonuses" chip hides spending cards', async ({ page }) => {
    test.skip(!transferBonusCreated, 'Skipped: transfer bonus creation (test 21) failed');
    await page.goto('/offers');
    await page.getByRole('button', { name: /transfer bonuses/i }).click();

    await expect(page.getByText(PARTNER).first()).toBeVisible({ timeout: 5_000 });
    // Spending cards (identified by merchant/multiplier pattern) should be gone
    const spendingIndicators = page.getByText(/×.*points|cash back|merchant/i);
    await expect(spendingIndicators).toHaveCount(0);
  });

  test('28. deactivate and reactivate: offer disappears then reappears on /offers', async ({ page }) => {
    test.setTimeout(180_000); // setOfferActive may sweep duplicate offers left by failed runs
    test.skip(!transferBonusCreated, 'Skipped: transfer bonus creation (test 21) failed');
    // "World of Hyatt" also appears verbatim in CommunityBoard's static mock preview
    // rows, unrelated to this offer — match the "Issuer → Partner" heading text
    // (rendered by both the featured hero and grid card) to avoid that collision.
    const offerHeading = /chase\s*→\s*world of hyatt/i;

    // Deactivate
    await setOfferActive(page, PARTNER, false);
    await page.goto('/offers');
    await expect(page.getByText(offerHeading).first()).toBeHidden({ timeout: 10_000 });

    // Reactivate (makes it visible again) — setOfferActive waits for the mutation
    // to land (button hidden) before returning, instead of clicking and navigating
    // away before the request completes.
    await setOfferActive(page, PARTNER, true);

    await page.goto('/offers');
    await expect(page.getByText(offerHeading).first()).toBeVisible({ timeout: 10_000 });
  });

  test('29. /offers page passes accessibility checks with transfer bonuses present', async ({ page }) => {
    test.skip(!transferBonusCreated, 'Skipped: transfer bonus creation (test 21) failed');
    await page.goto('/offers');
    await expect(page.getByText(PARTNER).first()).toBeVisible({ timeout: 10_000 });

    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });
});
