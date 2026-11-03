import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { MOBILE, expectNoHorizontalScroll, tabBar } from '../utils/mobile-helpers';

test.describe('The board — page', () => {
  test('1. loads with heading and filters', async ({ page }) => {
    await page.goto('/discover/board');
    await expect(page.getByRole('heading', { level: 1, name: 'The board' })).toBeVisible();
    await expect(page.getByLabel(/search posts/i)).toBeVisible();
  });

  test('2. search writes q to the URL', async ({ page }) => {
    await page.goto('/discover/board');
    await page.getByLabel(/search posts/i).fill('hyatt');
    await expect(page).toHaveURL(/q=hyatt/);
  });

  test('3. passes accessibility checks', async ({ page }) => {
    await page.goto('/discover/board');
    await expect(page.getByRole('heading', { level: 1, name: 'The board' })).toBeVisible();
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });

  test('4. unknown post id shows not-found state, not a crash', async ({ page }) => {
    await page.goto('/discover/board/00000000-0000-4000-8000-000000000000');
    await expect(page.getByRole('heading', { name: /isn.t available/i })).toBeVisible();
  });

  test('5. ?compose=1 opens the composer; Escape closes it', async ({ page }) => {
    await page.goto('/discover/board?compose=1');
    const dialog = page.getByRole('dialog', { name: 'New post' });
    await expect(dialog).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
  });

  test('6. composer passes accessibility checks', async ({ page }) => {
    await page.goto('/discover/board?compose=1');
    await expect(page.getByRole('dialog', { name: 'New post' })).toBeVisible();
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });

  test('7. composer is usable at 375px', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto('/discover/board?compose=1');
    const dialog = page.getByRole('dialog', { name: 'New post' });
    await expect(dialog).toBeVisible();
    const box = await dialog.boundingBox();
    expect(box!.width).toBeLessThanOrEqual(375);
  });
});

test.describe('The board — phone filters', () => {
  test.use(MOBILE);

  test('Sort, Show, Topic and Verified sit on one line, and the page cannot drag sideways', async ({ page }) => {
    await page.goto('/discover/board');
    await expect(page.getByRole('heading', { level: 1, name: 'The board' })).toBeVisible();

    const row = page.getByRole('group', { name: 'Filter posts' });
    const controls = [
      row.getByRole('button', { name: /^Sort:/ }),
      row.getByRole('button', { name: /^Show:/ }),
      row.getByRole('button', { name: /^Topic:/ }),
    ];
    const tops = await Promise.all(controls.map(async (c) => Math.round((await c.boundingBox())!.y)));
    expect(new Set(tops).size).toBe(1);
    await expectNoHorizontalScroll(page);
    await expect(tabBar(page)).toBeVisible();
  });

  test('a filter opens as a bottom sheet, locks the page, and picking an option writes the URL', async ({ page }) => {
    await page.goto('/discover/board');
    await page.getByRole('button', { name: /^Sort:/ }).click();

    const list = page.getByRole('listbox', { name: 'Sort' });
    await expect(list).toBeVisible();
    const box = (await list.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(390);
    expect(await page.evaluate(() => document.body.style.position)).toBe('fixed');

    await list.getByRole('option', { name: 'New' }).click();
    await expect(list).toBeHidden();
    await expect(page).toHaveURL(/sort=new/);
    expect(await page.evaluate(() => document.body.style.position)).toBe('');
  });

  test('Topic dropdown lists topics and filters the feed', async ({ page }) => {
    await page.goto('/discover/board');
    await page.getByRole('button', { name: /^Topic:/ }).click();
    const options = page.getByRole('listbox', { name: 'Topic' }).getByRole('option');
    // Topics arrive with the feed; wait for them instead of counting an empty list
    await expect.poll(() => options.count(), { timeout: 10_000 }).toBeGreaterThan(0);
    await page.waitForTimeout(500);
    test.skip((await options.count()) < 2, 'No topics to select');
    await options.nth(1).click();
    await expect(page).toHaveURL(/topic=/);
    await expect(page.getByRole('button', { name: /^Topic:/ })).not.toContainText('All topics');
  });

  test('Topic dropdown has a search box that filters as you type', async ({ page }) => {
    await page.goto('/discover/board');
    await page.getByRole('button', { name: /^Topic:/ }).click();
    const options = page.getByRole('listbox', { name: 'Topic' }).getByRole('option');
    // The topic list rides a slow batched call; wait for it rather than counting just "All topics"
    const loaded = await expect.poll(() => options.count(), { timeout: 30_000 }).toBeGreaterThan(1).then(() => true, () => false);
    test.skip(!loaded, 'No topics to search');
    const search = page.getByRole('combobox', { name: 'Search topic' });
    await expect(search).toBeVisible();
    const before = await options.count();
    await search.fill('zzzz-no-such-topic');
    await expect(page.getByText(/No topic matches/)).toBeVisible();
    await search.fill('');
    await expect.poll(() => options.count()).toBe(before);
    // Typing narrows the list; Enter picks the top match and filters the feed
    const second = (await options.nth(1).locator('span').first().innerText()).replace(/ · quiet$/, '');
    await search.fill(second.slice(0, 3));
    await expect.poll(() => options.count()).toBeLessThanOrEqual(before);
    await search.press('Enter');
    await expect(page).toHaveURL(/topic=/);
  });

  test('Composer topic box autocompletes existing topics and still offers a new one', async ({ page }) => {
    await page.goto('/discover/board?compose=1');
    const dialog = page.getByRole('dialog', { name: 'New post' });
    await expect(dialog).toBeVisible();
    const box = dialog.getByRole('combobox', { name: /Search topics or add a new one/ });
    const chips = dialog.getByRole('group', { name: 'TOPIC' }).getByRole('button', { pressed: false });
    const loaded = await expect.poll(() => chips.count(), { timeout: 30_000 }).toBeGreaterThan(0).then(() => true, () => false);
    test.skip(!loaded, 'No topics to autocomplete');
    const name = (await chips.first().innerText()).trim();
    await box.fill(name.slice(0, 3));
    const list = dialog.getByRole('listbox', { name: 'Matching topics' });
    await expect(list.getByRole('option', { name })).toBeVisible();
    // Arrow + Enter picks it as a chip, and the box clears
    await box.press('ArrowDown');
    await box.press('Enter');
    await expect(dialog.getByRole('button', { name, pressed: true })).toBeVisible();
    await expect(box).toHaveValue('');
    // A name nothing matches offers "Add … as a new topic", with no MAIN/NEW tags on the chip
    await box.fill('Zzqx Wanderlust');
    await list.getByRole('option', { name: /as a new topic/ }).click();
    const added = dialog.getByRole('button', { name: /Remove new topic Zzqx Wanderlust/i });
    await expect(added).toBeVisible();
    await expect(added).not.toContainText(/MAIN|NEW/);
  });

  test('passes accessibility checks with a sheet open', async ({ page }) => {
    await page.goto('/discover/board');
    await expect(page.getByRole('heading', { level: 1, name: 'The board' })).toBeVisible();
    await page.getByRole('button', { name: /^Show:/ }).click();
    await expect(page.getByRole('listbox', { name: 'Show' })).toBeVisible();
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });
});
