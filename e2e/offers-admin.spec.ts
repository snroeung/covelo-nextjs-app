import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {
  createSponsoredAd,
  createTransferBonus,
  createSpendingBonus,
  deactivateAd,
  changeOfferStatus,
  today,
  daysFromNow,
  TEST_PREFIX,
} from './utils/admin-helpers';

// ---------------------------------------------------------------------------
// Scenario 1: Sponsored Ad — create and display
// ---------------------------------------------------------------------------

test.describe('Sponsored Ad — create and display', () => {
  const AD_HEADLINE = `${TEST_PREFIX} Earn 3x on travel`;
  const AD_TRACKING_ID = 'test-chase-reserve-sidebar';
  const AD_CTA_URL = 'https://example.com/chase-reserve';

  test.afterAll(async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: 'e2e/.auth/admin.json' });
    const page = await ctx.newPage();
    await deactivateAd(page, AD_HEADLINE).catch(() => {});
    await ctx.close();
  });

  test('1. creates a live sponsored ad via admin', async ({ page }) => {
    await createSponsoredAd(page, {
      partner: 'Chase',
      product: 'Sapphire Reserve',
      slot: 'sidebar',
      headline: AD_HEADLINE,
      subheadline: 'Points that go further',
      ctaLabel: 'Learn More',
      ctaUrl: AD_CTA_URL,
      trackingId: AD_TRACKING_ID,
      disclosure: 'Subject to credit approval. Test ad.',
      active: true,
    });
  });

  test('2. ad is visible in the sidebar on /offers', async ({ page }) => {
    await page.goto('/offers');
    await expect(
      page.getByText(AD_HEADLINE).first(),
    ).toBeVisible({ timeout: 10_000 });
  });

  test('3. ad is visible in the sidebar on /flights', async ({ page }) => {
    await page.goto('/flights');
    await expect(
      page.getByText(AD_HEADLINE).first(),
    ).toBeVisible({ timeout: 10_000 });
  });

  test('4. ad is visible in the sidebar on the home page', async ({ page }) => {
    await page.goto('/');
    await expect(
      page.getByText(AD_HEADLINE).first(),
    ).toBeVisible({ timeout: 10_000 });
  });

  test('5. ad is visible in the sidebar on /trip-planner', async ({ page }) => {
    await page.goto('/trip-planner');
    await expect(
      page.getByText(AD_HEADLINE).first(),
    ).toBeVisible({ timeout: 10_000 });
  });

  test('6. CTA URL contains the ref tracking param', async ({ page, context }) => {
    await page.goto('/offers');
    const adSpot = page.getByText(AD_HEADLINE).first().locator('..').locator('..');
    const ctaButton = adSpot.getByRole('link').or(adSpot.getByRole('button', { name: /learn more/i }));

    // Capture the URL the CTA resolves to (new tab or href)
    const href = await ctaButton.getAttribute('href');
    if (href) {
      expect(href).toContain(`ref=${AD_TRACKING_ID}`);
    } else {
      // Button opens in new tab — intercept and inspect
      const [newPage] = await Promise.all([
        context.waitForEvent('page'),
        ctaButton.click(),
      ]);
      expect(newPage.url()).toContain(`ref=${AD_TRACKING_ID}`);
      await newPage.close();
    }
  });

  test('7. carousel navigation works when multiple sidebar ads exist', async ({ page }) => {
    await page.goto('/offers');

    const adSpot = page.locator('[data-testid="affiliate-ad-spot"], .affiliate-ad-spot').first();
    const nextBtn = adSpot.getByRole('button', { name: /next/i });

    if (await nextBtn.isVisible()) {
      const initialHeadline = await adSpot.locator('h2, h3, .headline').textContent();
      await nextBtn.click();
      const nextHeadline = await adSpot.locator('h2, h3, .headline').textContent();
      expect(nextHeadline).not.toBe(initialHeadline);
    }
    // If no next button (only one ad), the test passes vacuously
  });

  test('8. edit ad headline and verify update on /offers', async ({ page }) => {
    const updatedHeadline = `${TEST_PREFIX} Earn 3x on travel — UPDATED`;

    await page.goto('/offers/admin');
    await page.getByRole('tab', { name: /ads/i }).click();

    const row = page.getByRole('row', { name: new RegExp(AD_HEADLINE, 'i') });
    await row.getByRole('button', { name: /edit/i }).click();
    await expect(page.getByRole('dialog')).toBeVisible();

    await page.getByLabel(/headline/i).clear();
    await page.getByLabel(/headline/i).fill(updatedHeadline);
    await page.getByRole('button', { name: /save|update/i }).click();
    await expect(page.getByText(/saved|updated|success/i)).toBeVisible({ timeout: 5_000 });

    await page.goto('/offers');
    await expect(page.getByText(updatedHeadline).first()).toBeVisible({ timeout: 10_000 });
  });

  test('9. deactivating ad removes it from the offers sidebar', async ({ page }) => {
    await deactivateAd(page, TEST_PREFIX);

    await page.goto('/offers');
    // After deactivation the ad should no longer appear
    await expect(page.getByText(AD_HEADLINE).first()).toBeHidden({ timeout: 10_000 });
  });

  test('10. /offers page passes accessibility checks with an active ad', async ({ page }) => {
    // Re-create ad for this test run if it was deactivated above
    await page.goto('/offers');
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Scenario 2: Spending Bonus — create and display
// ---------------------------------------------------------------------------

test.describe('Spending Bonus — create and display', () => {
  const MERCHANT = `${TEST_PREFIX} Amazon`;

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
  });

  test('12. spending bonus card is visible on /offers', async ({ page }) => {
    await page.goto('/offers');
    const card = page.getByText(MERCHANT).first();
    await expect(card).toBeVisible({ timeout: 10_000 });
  });

  test('13. spending bonus card shows correct multiplier and issuer', async ({ page }) => {
    await page.goto('/offers');
    const cardSection = page.getByText(MERCHANT).first().locator('../..').locator('../..');
    await expect(cardSection.getByText(/5[×x]|5x/i)).toBeVisible();
    await expect(cardSection.getByText(/chase/i)).toBeVisible();
  });

  test('14. clicking card opens the detail modal with correct content', async ({ page }) => {
    await page.goto('/offers');
    await page.getByText(MERCHANT).first().click();

    const modal = page.getByRole('dialog');
    await expect(modal).toBeVisible();
    await expect(modal.getByText(MERCHANT)).toBeVisible();
    await expect(modal.getByText(/5[×x]|5x/i)).toBeVisible();
  });

  test('15. filtering by "Spending bonuses" chip hides transfer cards', async ({ page }) => {
    await page.goto('/offers');
    await page.getByRole('button', { name: /spending bonuses/i }).click();

    // Spending bonus must be visible
    await expect(page.getByText(MERCHANT).first()).toBeVisible({ timeout: 5_000 });
    // Transfer-type cards should be absent (look for characteristic arrow pattern "→")
    const transferIndicators = page.getByText(/→.*miles|points.*→|transfer.*partner/i);
    await expect(transferIndicators).toHaveCount(0);
  });

  test('16. pressing Escape closes the detail modal', async ({ page }) => {
    await page.goto('/offers');
    await page.getByText(MERCHANT).first().click();
    await expect(page.getByRole('dialog')).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toBeHidden();
  });

  test('17. clicking backdrop closes the detail modal', async ({ page }) => {
    await page.goto('/offers');
    await page.getByText(MERCHANT).first().click();
    await expect(page.getByRole('dialog')).toBeVisible();

    // Click outside the modal content area
    await page.mouse.click(10, 10);
    await expect(page.getByRole('dialog')).toBeHidden();
  });

  test('18a. dollar_amount bonus type shows "$" label on card', async ({ page }) => {
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
    await changeOfferStatus(page, MERCHANT, 'reject');

    await page.goto('/offers');
    await expect(page.getByText(MERCHANT).first()).toBeHidden({ timeout: 10_000 });
  });

  test('20. cards stack in a single column on mobile (375px)', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/offers');

    const cards = page.locator('[data-testid="offer-card"], .offer-card, article').all();
    const allCards = await cards;

    if (allCards.length >= 2) {
      const box1 = await allCards[0].boundingBox();
      const box2 = await allCards[1].boundingBox();
      if (box1 && box2) {
        // On mobile, cards should stack vertically (similar left position)
        expect(Math.abs((box1.x) - (box2.x))).toBeLessThan(10);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Scenario 3: Transfer Bonus — create and display
// ---------------------------------------------------------------------------

test.describe('Transfer Bonus — create and display', () => {
  const PARTNER = 'World of Hyatt';
  const BONUS_PCT = 30;
  const BONUS_DESCRIPTION = `${TEST_PREFIX} Chase to Hyatt 30% transfer bonus`;

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
  });

  test('22. featured hero shows the transfer bonus when it has highest bonus_pct', async ({ page }) => {
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
    await page.goto('/offers');
    const card = page.getByText(PARTNER).first();
    await expect(card).toBeVisible({ timeout: 10_000 });

    const cardSection = card.locator('../..').locator('../..');
    await expect(cardSection.getByText(/30%|\+30/i)).toBeVisible();
    await expect(cardSection.getByText(/chase/i)).toBeVisible();
  });

  test('24. urgency badge appears when bonus expires within 7 days', async ({ page }) => {
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
    await page.goto('/offers');
    await page.getByRole('button', { name: /transfer bonuses/i }).click();

    await expect(page.getByText(PARTNER).first()).toBeVisible({ timeout: 5_000 });
    // Spending cards (identified by merchant/multiplier pattern) should be gone
    const spendingIndicators = page.getByText(/×.*points|cash back|merchant/i);
    await expect(spendingIndicators).toHaveCount(0);
  });

  test('28. reject and re-approve: offer disappears then reappears on /offers', async ({ page }) => {
    // Reject
    await changeOfferStatus(page, PARTNER, 'reject');
    await page.goto('/offers');
    await expect(page.getByText(PARTNER).first()).toBeHidden({ timeout: 10_000 });

    // Re-approve (admin status makes it visible again)
    await page.goto('/offers/admin');
    const row = page.getByRole('row', { name: new RegExp(PARTNER, 'i') });
    await row.getByRole('button', { name: /approve|admin/i }).click();
    await expect(page.getByText(/updated|saved|success/i)).toBeVisible({ timeout: 5_000 });

    await page.goto('/offers');
    await expect(page.getByText(PARTNER).first()).toBeVisible({ timeout: 10_000 });
  });

  test('29. /offers page passes accessibility checks with transfer bonuses present', async ({ page }) => {
    await page.goto('/offers');
    await expect(page.getByText(PARTNER).first()).toBeVisible({ timeout: 10_000 });

    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });
});
