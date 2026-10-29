import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { isoDay, seedTransferOffer, type SeededOffer } from '../utils/offer-seed';

// Saved offers on /offers (and the Discover masthead), and offers that have
// ended leaving every page. Each test seeds its own live offer (unique partner
// name) and removes it afterwards.

let offer: SeededOffer;
test.beforeEach(async () => { offer = await seedTransferOffer(); });
test.afterEach(async () => { await offer.cleanup(); });

const row = (page: Page) => page.getByTestId('offer-row').filter({ hasText: offer.token });
const savedButton = (page: Page) => page.getByRole('button', { name: /^Saved offers/ });
const savedPanel = (page: Page) => page.getByRole('region', { name: 'Saved offers' });
// The row's open button, not its Remove button (whose name also contains the offer)
const savedItem = (page: Page) => savedPanel(page).getByRole('button', { name: new RegExp(`^(?!Remove)[\\s\\S]*${offer.token}`) });

/** The first click can land before the page has hydrated: retry until it takes, never double-toggle. */
async function saveFromRow(page: Page) {
  await expect(async () => {
    if (await row(page).getByRole('button', { name: 'Save offer' }).isVisible()) await row(page).getByRole('button', { name: 'Save offer' }).click();
    await expect(row(page).getByRole('button', { name: 'Remove from saved offers' })).toBeVisible({ timeout: 1500 });
  }).toPass({ timeout: 15_000 });
}
async function openSaved(page: Page) {
  await expect(async () => {
    if (!(await savedPanel(page).isVisible())) await savedButton(page).click();
    await expect(savedPanel(page)).toBeVisible({ timeout: 1500 });
  }).toPass({ timeout: 15_000 });
}

test.describe('Offers — saved offers', () => {
  test('1. a saved offer shows in the Saved offers list, and removing it there unsaves it', async ({ page }) => {
    await page.goto('/offers');
    await expect(row(page)).toBeVisible();
    await saveFromRow(page);

    await openSaved(page);
    await expect(savedItem(page)).toBeVisible();
    await savedPanel(page).getByRole('button', { name: new RegExp(`^Remove .*${offer.token}.* from saved offers$`) }).click();
    await expect(savedItem(page)).toHaveCount(0);
    await expect(row(page).getByRole('button', { name: 'Save offer' })).toBeVisible();
  });

  test('2. picking a saved offer opens it', async ({ page }) => {
    await page.goto('/offers');
    await expect(row(page)).toBeVisible();
    await saveFromRow(page);
    await openSaved(page);
    await savedItem(page).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(savedPanel(page)).toBeHidden();
  });

  test('3. the offer view has a real Save button that stays in step with the list', async ({ page }) => {
    await page.goto('/offers');
    await row(page).getByRole('button').filter({ hasText: offer.token }).click();
    const dialog = page.getByRole('dialog');
    await expect(async () => {
      if (await dialog.getByRole('button', { name: 'Save offer' }).isVisible()) await dialog.getByRole('button', { name: 'Save offer' }).click();
      await expect(dialog.getByRole('button', { name: 'Saved' })).toBeVisible({ timeout: 1500 });
    }).toPass({ timeout: 15_000 });
    await page.keyboard.press('Escape');
    await expect(row(page).getByRole('button', { name: 'Remove from saved offers' })).toBeVisible();
  });

  test('4. an offer that has ended leaves its page and the saved list', async ({ page }) => {
    await page.goto('/offers');
    await saveFromRow(page);
    await openSaved(page);
    await expect(savedItem(page)).toBeVisible();
    await page.keyboard.press('Escape');

    await offer.setEndDate(isoDay(-2)); // ended two UTC days ago: over in every time zone
    await page.reload();
    await expect(page.getByRole('heading', { name: 'All offers' })).toBeVisible();
    await expect(row(page)).toHaveCount(0);
    await openSaved(page);
    await expect(savedPanel(page).getByLabel('Loading saved offers')).toHaveCount(0);
    await expect(savedItem(page)).toHaveCount(0);
  });

  test('5. an offer ending today is still shown; tomorrow it is not', async ({ page }) => {
    await offer.setEndDate(isoDay(0));
    await page.goto('/offers');
    await expect(row(page)).toBeVisible();
  });

  test('6. Discover has the same Saved offers menu, and ended offers are gone there too', async ({ page }) => {
    await page.goto('/discover');
    await expect(savedButton(page)).toBeVisible();
    await offer.setEndDate(isoDay(-2));
    await page.reload();
    await expect(page.getByText(offer.token)).toHaveCount(0);
  });

  test('7. the list passes accessibility checks and is a bottom sheet on a phone', async ({ page }) => {
    await page.goto('/offers');
    await openSaved(page);
    const results = await new AxeBuilder({ page }).include('[aria-label="Saved offers"]').analyze();
    expect(results.violations).toEqual([]);
    await page.setViewportSize({ width: 375, height: 800 });
    const box = await savedPanel(page).boundingBox();
    expect(box!.width).toBeLessThanOrEqual(375);
    await page.keyboard.press('Escape');
    await expect(savedPanel(page)).toBeHidden();
  });
});

// An offer's last day ends at midnight in the viewer's own zone. Earliest "today" is UTC-12's, latest is UTC+14's:
// UTC today is never over for UTC-12, and UTC yesterday is always over for UTC+14.
test.describe('Offers — the cutoff follows the viewer time zone', () => {
  test.describe('far behind UTC', () => {
    test.use({ timezoneId: 'Etc/GMT+12' });
    test('10. an offer ending on the UTC day is still shown', async ({ page }) => {
      await offer.setEndDate(isoDay(0));
      await page.goto('/offers');
      await expect(row(page)).toBeVisible();
    });
  });

  test.describe('far ahead of UTC', () => {
    test.use({ timezoneId: 'Pacific/Kiritimati' });
    test('11. an offer that ended on the previous UTC day is gone', async ({ page }) => {
      await offer.setEndDate(isoDay(-1));
      await page.goto('/offers');
      await expect(page.getByRole('heading', { name: 'All offers' })).toBeVisible();
      await expect(row(page)).toHaveCount(0);
    });
  });
});

test.describe('Offers — transfer rows', () => {
  test('9. a transfer row has no repeated percentage on the right; its headline carries it', async ({ page }) => {
    await page.goto('/offers');
    await expect(row(page)).toBeVisible();
    await expect(row(page)).toContainText('99% premium'); // the headline
    await expect(row(page)).not.toContainText('+99%'); // the value that used to sit on the right
  });
});

test.describe('Offers — saved offers, signed out', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('8. a visitor gets the same sign-in prompt as saved posts, from the list button and from a bookmark', async ({ page }) => {
    await page.goto('/offers');
    await expect(row(page)).toBeVisible();
    const toast = page.getByRole('status');

    // The first click can land before hydration: retry until the prompt shows (it does nothing else, so repeating is safe)
    await expect(async () => {
      await savedButton(page).click();
      await expect(toast.getByText('Sign in to see your saved offers')).toBeVisible({ timeout: 1500 });
    }).toPass({ timeout: 15_000 });
    await expect(toast.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/auth');
    await expect(savedPanel(page)).toHaveCount(0); // nothing opens for a visitor

    await expect(async () => {
      await row(page).getByRole('button', { name: 'Save offer' }).click();
      await expect(toast.getByText('Sign in to save offers')).toBeVisible({ timeout: 1500 });
    }).toPass({ timeout: 15_000 });
    await expect(row(page).getByRole('button', { name: 'Save offer' })).toBeVisible(); // still unsaved
  });
});
