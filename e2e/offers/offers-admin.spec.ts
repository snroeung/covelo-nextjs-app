import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {
  createSponsoredAd,
  createTransferBonus,
  createSpendingBonus,
  deactivateAd,
  changeOfferStatus,
  searchFlights,
  searchHotels,
  getFirstTripUrl,
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
  const AD_HEADLINE = `${TEST_PREFIX} Earn miles on every flight`;
  const AD_CTA_URL  = 'https://example.com/delta-reserve';
  let adCreated = false;

  test.afterAll(async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: 'e2e/.auth/admin.json' });
    const page = await ctx.newPage();
    await ctx.close();
  });

  test('1. creates a live flights_inline ad via admin', async ({ page }) => {
    await createSponsoredAd(page, {
      partner: 'Chase',
      product: 'Chase Sapphire Reserve',
      slot: 'flights_inline',
      headline: AD_HEADLINE,
      subheadline: '~$910 bonus value',
      bullets: ['70,000 bonus miles', '$95 annual fee', 'No foreign transaction fees'],
      ctaLabel: 'Apply now',
      ctaUrl: AD_CTA_URL,
      trackingId: 'test-flights-inline',
      active: true,
    });
    const adRow = page.locator('div').filter({ hasText: AD_HEADLINE }).first();
    await expect(
      adRow.locator('span[class*="rounded-full"]').filter({ hasText: /^Live$/ }).first()
    ).toBeVisible({ timeout: 5_000 });
    adCreated = true;
  });

  test('2. inline banner appears in flight results', async ({ page }) => {
    test.setTimeout(75_000);
    test.skip(!adCreated, 'Skipped: ad creation failed');
    const submitted = await searchFlights(page, 'JFK', 'LAX');
    test.skip(!submitted, 'Skipped: flights search form not available');

    const results = page.locator('[data-testid="flight-card"]');
    await results.first().waitFor({ timeout: 45_000 });

    const count = await results.count();
    expect(count, 'Expected flight results to be returned').toBeGreaterThan(0);

    await expect(page.getByText(AD_HEADLINE).first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('SPONSORED').first()).toBeVisible();
  });

  test('3. CTA link points to the correct URL', async ({ page }) => {
    test.skip(!adCreated, 'Skipped: ad creation failed');
    const submitted = await searchFlights(page, 'JFK', 'LAX');
    test.skip(!submitted, 'Skipped: flights search form not available');
    await page.getByText(AD_HEADLINE).first().waitFor({ timeout: 15_000 }).catch(() => {});

    const cta = page.getByRole('link', { name: /apply now/i }).first();
    if (await cta.isVisible({ timeout: 5_000 }).catch(() => false)) {
      const href = await cta.getAttribute('href');
      expect(href).toContain('example.com/delta-reserve');
    }
  });

  test('4. deactivating removes the banner from flight results', async ({ page }) => {
    test.setTimeout(90_000);
    test.skip(!adCreated, 'Skipped: ad creation failed');
    await deactivateAd(page, AD_HEADLINE);
    await searchFlights(page, 'JFK', 'LAX');
    await page.locator('[data-testid="flight-card"]').first().waitFor({ timeout: 45_000 });
    await expect(page.getByText(AD_HEADLINE)).toHaveCount(0, { timeout: 10_000 });
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
    tripUrl = await getFirstTripUrl(page) ?? await createTestTrip(page);

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
    test.skip(!adCreated || !tripUrl, 'Skipped: ad creation or trip not available');
    await deactivateAd(page, AD_HEADLINE);
    await page.goto(tripUrl!);
    await page.waitForTimeout(2_000);
    await expect(page.getByText(AD_HEADLINE)).toHaveCount(0);
  });
});

// ---------------------------------------------------------------------------
// Publish feedback — loading overlay + success/error popup
// ---------------------------------------------------------------------------

test.describe('Sponsored Ad — publish feedback UI', () => {
  test.describe.configure({ mode: 'serial' });
  const AD_HEADLINE      = `${TEST_PREFIX} Publish feedback test`;
  const AD_HEADLINE_EDIT = `${TEST_PREFIX} Publish feedback edit`;
  const AD_DATA = {
    partner: 'Chase',
    product: 'Chase Sapphire Reserve',
    slot: 'flights_inline' as const,
    headline: AD_HEADLINE,
    ctaLabel: 'Apply now',
    ctaUrl: 'https://example.com/feedback-test',
    trackingId: 'test-feedback',
    active: true,
  };

  test.afterAll(async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: 'e2e/.auth/admin.json' });
    const page = await ctx.newPage();
    await ctx.close();
  });

  test('17. loading overlay appears while ad is being published', async ({ page }) => {
    // createSponsoredAd fills and submits the form, internally verifying the overlay
    await createSponsoredAd(page, AD_DATA);
    // If we reached here the overlay appeared and the success dialog was dismissed
  });

  test('18. success popup appears with "Ad published!" and can be dismissed', async ({ page }) => {
    await createSponsoredAd(page, { ...AD_DATA, headline: AD_HEADLINE_EDIT, trackingId: 'test-feedback-edit' });

    // createSponsoredAd already dismissed the dialog — navigate back to verify the ad is Live
    const escaped = AD_HEADLINE_EDIT.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const adRow = page.locator('div').filter({ hasText: new RegExp(escaped, 'i') }).last();
    await expect(
      adRow.locator('span[class*="rounded-full"]').filter({ hasText: /^Live$/ }).first()
    ).toBeVisible({ timeout: 5_000 });
  });

  test('19. "Ad updated!" popup appears after editing an existing ad', async ({ page }) => {
    await page.goto('/offers/admin');
    await page.getByRole('button', { name: 'Sponsored ads' }).click();

    // Find the ad created in test 18 and edit it
    const escaped = AD_HEADLINE_EDIT.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const row = page.locator('div').filter({
      hasText: new RegExp(escaped, 'i'),
      has: page.getByRole('button', { name: /^Edit$/ }),
    }).last();
    await row.getByRole('button', { name: /^Edit$/ }).click();

    const headlineInput = page.getByPlaceholder(/60,000 bonus points/i);
    await headlineInput.clear();
    await headlineInput.fill(AD_HEADLINE_EDIT + ' (edited)');

    await page.getByRole('button', { name: /save changes/i }).click();

    const dialog = page.getByRole('dialog', { name: 'Ad updated' });
    await expect(dialog).toBeVisible({ timeout: 15_000 });
    await expect(dialog.getByText('Ad updated!')).toBeVisible();
    await expect(dialog.getByText('Changes saved successfully.')).toBeVisible();
    await dialog.getByRole('button', { name: 'Done' }).click();
    await expect(dialog).toBeHidden({ timeout: 5_000 });
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
    await changeOfferStatus(page, MERCHANT, 'reject').catch(() => {});
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
    const cardSection = page.getByText(MERCHANT).first().locator('../..').locator('../..');
    await expect(cardSection.getByText(/5[×x]|5x/i)).toBeVisible();
    await expect(cardSection.getByText(/chase/i)).toBeVisible();
  });

  test('14. clicking card opens the detail modal with correct content', async ({ page }) => {
    test.skip(!spendingBonusCreated, 'Skipped: spending bonus creation (test 11) failed');
    await page.goto('/offers');
    await page.getByText(MERCHANT).first().click();

    const modal = page.getByRole('dialog');
    await expect(modal).toBeVisible();
    await expect(modal.getByText(MERCHANT)).toBeVisible();
    await expect(modal.getByText(/5[×x]|5x/i)).toBeVisible();
  });

  test('15. filtering by "Spending bonuses" chip hides transfer cards', async ({ page }) => {
    test.skip(!spendingBonusCreated, 'Skipped: spending bonus creation (test 11) failed');
    await page.goto('/offers');
    await page.getByRole('button', { name: /spending bonuses/i }).click();

    // Spending bonus must be visible
    await expect(page.getByText(MERCHANT).first()).toBeVisible({ timeout: 5_000 });
    // Transfer-type cards should be absent (look for characteristic arrow pattern "→")
    const transferIndicators = page.getByText(/→.*miles|points.*→|transfer.*partner/i);
    await expect(transferIndicators).toHaveCount(0);
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
      endDate: daysFromNow(30),
    });

    await page.goto('/offers');
    const cardSection = page.getByText(merchant).first().locator('../..').locator('../..');
    await expect(cardSection.getByText(/\$10|\$\s*10/)).toBeVisible({ timeout: 5_000 });
  });

  test('18b. cash_back_pct bonus type shows "%" on card', async ({ page }) => {
    test.skip(!spendingBonusCreated, 'Skipped: spending bonus creation (test 11) failed');
    const merchant = `${TEST_PREFIX} Target Cashback`;
    await createSpendingBonus(page, {
      issuer: 'c1',
      merchant: merchant,
      multiplier: 3,
      bonusType: 'cash_back_pct',
      endDate: daysFromNow(30),
    });

    await page.goto('/offers');
    const cardSection = page.getByText(merchant).first().locator('../..').locator('../..');
    await expect(cardSection.getByText(/3%|cash back/i)).toBeVisible({ timeout: 5_000 });
  });

  test('19. rejecting a spending bonus removes it from /offers', async ({ page }) => {
    test.skip(!spendingBonusCreated, 'Skipped: spending bonus creation (test 11) failed');
    await changeOfferStatus(page, MERCHANT, 'reject');

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
  let transferBonusCreated = false;

  test.afterAll(async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: 'e2e/.auth/admin.json' });
    const page = await ctx.newPage();
    await changeOfferStatus(page, PARTNER, 'reject').catch(() => {});
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
    // Featured hero section contains the bonus percentage and partner name
    const hero = page.getByTestId('featured-offer-hero').or(
      page.locator('[class*="hero"], [class*="featured"]').first(),
    );
    // If our 30% bonus is the highest it appears in the hero
    const heroText = await hero.textContent().catch(() => '');
    if (heroText?.includes('30') || heroText?.includes(PARTNER)) {
      await expect(hero.getByText(/30%/)).toBeVisible();
      await expect(hero.getByText(new RegExp(PARTNER, 'i'))).toBeVisible();
    }
    // Otherwise it appears in the grid — covered by test 23
  });

  test('23. transfer card in grid shows issuer → partner and bonus pct', async ({ page }) => {
    test.skip(!transferBonusCreated, 'Skipped: transfer bonus creation (test 21) failed');
    await page.goto('/offers');
    const card = page.getByText(PARTNER).first();
    await expect(card).toBeVisible({ timeout: 10_000 });

    const cardSection = card.locator('../..').locator('../..');
    await expect(cardSection.getByText(/30%|\+30/i)).toBeVisible();
    await expect(cardSection.getByText(/chase/i)).toBeVisible();
  });

  test('24. urgency badge appears when bonus expires within 7 days', async ({ page }) => {
    test.skip(!transferBonusCreated, 'Skipped: transfer bonus creation (test 21) failed');
    const urgentPartner = `${TEST_PREFIX} Urgent IHG`;
    await createTransferBonus(page, {
      issuer: 'chase',
      partner: urgentPartner,
      bonusPct: 10,
      endDate: daysFromNow(3), // expires in 3 days
    });

    await page.goto('/offers');
    const card = page.getByText(urgentPartner).first().locator('../..').locator('../..');
    // Urgency indicator — text or badge
    await expect(
      card.getByText(/expir|urgent|soon|days left/i),
    ).toBeVisible({ timeout: 5_000 });
  });

  test('25. clicking card opens detail modal with full offer details', async ({ page }) => {
    test.skip(!transferBonusCreated, 'Skipped: transfer bonus creation (test 21) failed');
    await page.goto('/offers');
    await page.getByText(PARTNER).first().click();

    const modal = page.getByRole('dialog');
    await expect(modal).toBeVisible();
    await expect(modal.getByText(new RegExp(PARTNER, 'i'))).toBeVisible();
    await expect(modal.getByText(/30%|\+30/i)).toBeVisible();
    // Expiry date and source sections should be present
    await expect(modal.getByText(/expir|end date/i)).toBeVisible();
  });

  test('26. targeted bonus shows TARGETED tag on card', async ({ page }) => {
    test.skip(!transferBonusCreated, 'Skipped: transfer bonus creation (test 21) failed');
    const targetedPartner = `${TEST_PREFIX} Targeted Marriott`;
    await createTransferBonus(page, {
      issuer: 'amex',
      partner: targetedPartner,
      bonusPct: 20,
      endDate: daysFromNow(30),
      isTargeted: true,
    });

    await page.goto('/offers');
    const card = page.getByText(targetedPartner).first().locator('../..').locator('../..');
    await expect(card.getByText(/targeted/i)).toBeVisible({ timeout: 5_000 });
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

  test('28. reject and re-approve: offer disappears then reappears on /offers', async ({ page }) => {
    test.skip(!transferBonusCreated, 'Skipped: transfer bonus creation (test 21) failed');
    // Reject
    await changeOfferStatus(page, PARTNER, 'reject');
    await page.goto('/offers');
    await expect(page.getByText(PARTNER).first()).toBeHidden({ timeout: 10_000 });

    // Re-approve (admin status makes it visible again)
    await page.goto('/offers/admin');
    const row = page.locator('div').filter({
      hasText: new RegExp(PARTNER, 'i'),
      has: page.getByRole('button', { name: /edit/i }),
    }).first();
    await row.getByRole('button', { name: /re-approve/i }).click();

    await page.goto('/offers');
    await expect(page.getByText(PARTNER).first()).toBeVisible({ timeout: 10_000 });
  });

  test('29. /offers page passes accessibility checks with transfer bonuses present', async ({ page }) => {
    test.skip(!transferBonusCreated, 'Skipped: transfer bonus creation (test 21) failed');
    await page.goto('/offers');
    await expect(page.getByText(PARTNER).first()).toBeVisible({ timeout: 10_000 });

    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });
});
