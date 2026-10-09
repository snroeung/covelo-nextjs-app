import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('Discover page — general', () => {
  test('30. page loads with the masthead heading and no leftover category chips', async ({ page }) => {
    await page.goto('/discover');

    // Masthead heading
    await expect(page.getByRole('heading', { level: 1, name: /discover/i })).toBeVisible();

    // The old utility-grid category chips are gone from the front page
    await expect(page.getByRole('button', { name: /^all offers$/i })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /^transfer bonuses$/i })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /^spending bonuses$/i })).toHaveCount(0);
  });

  test('31. page passes accessibility checks', async ({ page }) => {
    await page.goto('/discover');
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });

  test('32. masthead "See all offers" opens /offers in a new tab', async ({ page, context }) => {
    await page.goto('/discover');
    const seeAll = page.getByRole('link', { name: /see all offers/i }).first();
    const [popup] = await Promise.all([
      context.waitForEvent('page'),
      seeAll.click(),
    ]);
    await popup.waitForLoadState();
    await expect(popup).toHaveURL(/\/offers/);
  });

  test('33. rail "See all offers" opens /offers in a new tab', async ({ page, context }) => {
    await page.goto('/discover');

    // The rail's own "See all offers" only mounts once there's a
    // remaining-offers pool beyond the collapsed cutoff, after the offers
    // query resolves — count() checks the DOM immediately with no polling,
    // so wait via a (possibly failing) expect and treat a timeout as absence.
    const railHeading = page.getByText(/more offers/i);
    const railMounted = await expect(railHeading).toBeVisible({ timeout: 10_000 }).then(() => true, () => false);
    if (!railMounted) test.skip(true, 'No remaining offers in this environment — nothing to see');

    const seeAll = page.getByRole('link', { name: /see all offers/i }).last();
    if (await seeAll.count() === 0) test.skip(true, 'Rail already shows every offer — no "see all" link to click');
    const [popup] = await Promise.all([
      context.waitForEvent('page'),
      seeAll.click(),
    ]);
    await popup.waitForLoadState();
    await expect(popup).toHaveURL(/\/offers/);
  });

  test('34. Discover link on the homepage navigates to /discover', async ({ page }) => {
    await page.goto('/');

    await page.getByRole('link', { name: /discover/i }).click();
    await expect(page).toHaveURL(/\/discover/);
  });

  test('34b. Discover dropdown lists only "The board" and "All offers"', async ({ page }) => {
    // The homepage's own "Discover" link is a plain dashboard promo card with
    // no NavBar — use a page that renders NavBar (and its dropdown) instead.
    await page.goto('/discover');

    await page.getByRole('link', { name: /^discover$/i }).hover();

    // The dropdown's "All offers" link is identified by its description
    // line, since the masthead's "See all offers · N" link also matches a
    // loose "all offers" name search on this page.
    const allOffersItem = page.getByRole('link').filter({ hasText: 'Every active offer' });

    await expect(page.getByText(/^the board$/i)).toBeVisible();
    await expect(allOffersItem).toBeVisible();
    await expect(page.getByText(/^front page$/i)).toHaveCount(0);

    await allOffersItem.click();
    await expect(page).toHaveURL(/\/offers/);
  });

  test('35. board promo is visible on /discover', async ({ page }) => {
    await page.goto('/discover');

    await expect(page.getByText(/the board/i).first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('link', { name: /open the board/i })).toBeVisible();
  });

  test('36. survives a client-side hop from a results page that warmed the bonuses cache', async ({ page }) => {
    // Regression: flight/hotel cards and this page share the react-query key
    // 'offers.transferBonuses'. When the card side cached an envelope object
    // instead of the bare array, whichever page mounted second spread a
    // non-iterable and the page threw on render.
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));

    const depart = new Date(Date.now() + 21 * 864e5).toISOString().slice(0, 10);
    const params = new URLSearchParams({
      origin: 'PHL',
      originName: 'Philadelphia International Airport',
      destinationCode: 'SFO',
      destination: 'San Francisco International Airport',
      tripType: 'oneway',
      departDate: depart,
      adults: '1',
      cabinClass: 'economy',
    });
    await page.goto(`/flights?${params.toString()}`);
    await page
      .getByRole('main')
      .getByText(/flights? · PHL → SFO|No flights found for this route and date|Flight search failed/)
      .waitFor({ timeout: 30_000 });

    // Client-side nav keeps the query cache — a full page load would not.
    await page.getByRole('link', { name: /^discover$/i }).first().click();
    await expect(page).toHaveURL(/\/discover/);
    await expect(page.getByRole('heading', { level: 1, name: /discover/i })).toBeVisible();

    expect(errors).toEqual([]);
  });

});
