import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readSeededPost, seedMemberOfferPost, type SeededMemberOffer } from '../utils/board-seed';

// Review & publish: an admin opens a member-created offer from Pending
// review, checks it, corrects the member's post, and publishes it to the
// catalog. Each test seeds its own member offer and removes it afterwards.

let seeded: SeededMemberOffer;

test.beforeEach(async () => {
  seeded = await seedMemberOfferPost();
});
test.afterEach(async () => {
  await seeded.cleanup();
});

async function openReview(page: Page) {
  await page.goto('/admin');
  await page.getByRole('button', { name: /^Pending review/ }).click();
  await page.getByRole('button', { name: /^From the board/ }).click();
  const row = page.locator('div.grid').filter({ hasText: seeded.title }).first();
  await row.getByRole('button', { name: 'Review & publish' }).click();
  await expect(page.getByRole('region', { name: 'Review member offer' })).toBeVisible();
}

test.describe('Review & publish a member offer', () => {
  test('1. shows the member\'s submission and their post, prefilled', async ({ page }) => {
    await openReview(page);
    await expect(page.getByText('SUBMITTED BY LOCAL MEMBER')).toBeVisible();
    await expect(page.getByLabel('POST TITLE')).toHaveValue(seeded.title);
    await expect(page.getByLabel('POST BODY')).toHaveValue('Seeded post body');
    const topicsList = page.getByRole('list', { name: 'Selected topics' });
    for (const name of seeded.topicNames) await expect(topicsList.getByText(name, { exact: false })).toBeVisible();
    await expect(topicsList.getByText('PRIMARY')).toHaveCount(1);
  });

  test('2. has no targeted, active or board-post toggles — the member\'s fields only', async ({ page }) => {
    await openReview(page);
    await expect(page.getByText('Available to all cardholders')).toBeHidden();
    await expect(page.getByText('Active — visible to users')).toBeHidden();
    await expect(page.getByText('Not on the board')).toHaveCount(0);
    await page.getByRole('button', { name: /Show admin extras/ }).click();
    await expect(page.getByText('Available to all cardholders')).toBeHidden(); // still not offered in review
    await expect(page.getByText('TAGS', { exact: false }).first()).toBeVisible();
  });

  test('3. the topics dropdown is a multi-select with a cap, and Publish needs a title and a topic', async ({ page }) => {
    await openReview(page);
    const trigger = page.getByRole('button', { name: /topics selected/ });
    await trigger.click();
    const list = page.getByRole('listbox', { name: 'Topics' });
    await expect(list).toBeVisible();
    expect(await list.getByRole('checkbox').count()).toBeGreaterThan(1);
    // Escape closes the list
    await page.keyboard.press('Escape');
    await expect(list).toBeHidden();
    // Clear every topic: validation asks for one, and Publish waits
    for (const name of seeded.topicNames) await page.getByRole('button', { name: `Remove ${name}` }).click();
    await expect(page.getByText('At least one topic')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Publish & verify' })).toBeDisabled();
  });

  test('4. publishes: the offer joins the catalog and the member\'s corrected post is verified', async ({ page }) => {
    await openReview(page);
    const newTitle = `${seeded.title} (checked)`;
    await page.getByLabel('POST TITLE').fill(newTitle);
    await page.getByLabel('POST BODY').fill('Terms confirmed against the source.');
    // Drop the second topic: only the primary remains
    await page.getByRole('button', { name: `Remove ${seeded.topicNames[1]}` }).click();
    await page.getByRole('button', { name: 'Publish & verify' }).click();
    await expect(page.getByRole('region', { name: 'Review member offer' })).toHaveCount(0, { timeout: 20_000 });

    const { post, topics } = await readSeededPost(seeded.postId);
    expect(post).toMatchObject({ title: newTitle, body: 'Terms confirmed against the source.', review: 'approved', offer_table: 'transfer_bonuses', member_offer_id: null });
    expect(post?.verified_by).toBeTruthy();
    expect(topics).toEqual([{ topic_id: seeded.topicIds[0], is_primary: true }]);
  });

  test('5. the review screen passes accessibility checks', async ({ page }) => {
    await openReview(page);
    // Scoped to what the review screen adds: the submission panel and the member's post
    // fields. The rest of the offer editor has older accessibility debts of its own.
    const results = await new AxeBuilder({ page })
      .include('[aria-label="Submitted by the member"]')
      .include('[aria-label="The member\'s post"]')
      .analyze();
    expect(results.violations).toEqual([]);
  });
});
