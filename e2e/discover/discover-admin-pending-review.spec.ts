import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// Scope note: approve/reject, inline-edit-then-approve, and populated Sync
// Runs Log assertions are intentionally NOT covered here. Both tables only
// ever show rows with status='pending'/source='cron', and today only the
// real portal-sync scraper (scripts/portal-sync/run.ts) writes those — there
// is no UI path to create one, and no e2e helper seeds Supabase directly.
// These tests cover only what's reachable through the UI as-is. Add
// approve/reject/edit-in-place coverage once a seeding mechanism (e.g. a
// direct Supabase test helper) is agreed on.

test.describe('Pending Review admin tab', () => {
  test('1. renders with the empty-queue state when there are no pending records', async ({ page }) => {
    await page.goto('/admin');
    await page.getByRole('button', { name: 'Pending review' }).click();

    // If a real cron run has left pending rows in this environment, this
    // assertion legitimately doesn't apply — skip rather than fail.
    const emptyState = page.getByText('No pending records — the sync queue is clear.');
    const pendingRow = page.locator('div.grid').filter({ has: page.getByRole('button', { name: /^Approve$/ }) }).first();
    await emptyState.or(pendingRow).waitFor({ timeout: 10_000 });

    const isEmpty = await emptyState.isVisible();
    test.skip(!isEmpty, 'Environment has real pending rows from a cron run — empty state does not apply');

    await expect(emptyState).toBeVisible();
  });

  test('2. Sync Runs Log renders its column headers regardless of row content', async ({ page }) => {
    await page.goto('/admin');
    await page.getByRole('button', { name: 'Pending review' }).click();

    // getByText does a case-insensitive substring match by default, and
    // "WHEN"/"STATUS" are common substrings inside real offer/collection
    // descriptions elsewhere on the page (e.g. "Room upgrade when
    // available…") — use exact matching to target only the column headers.
    await expect(page.getByText('WHEN', { exact: true })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('SOURCE', { exact: true }).last()).toBeVisible();
    await expect(page.getByText('STATUS', { exact: true })).toBeVisible();
    await expect(page.getByText('FOUND / WRITTEN', { exact: true })).toBeVisible();
    await expect(page.getByText('TOKENS', { exact: true })).toBeVisible();

    // Either the empty state or real historical rows — both are valid, this
    // just confirms the table finished loading one way or the other.
    const emptyState = page.getByText('No sync runs recorded yet.');
    const hasEmptyState = await emptyState.isVisible().catch(() => false);
    if (!hasEmptyState) {
      await expect(page.locator('div.grid').first()).toBeVisible({ timeout: 10_000 });
    }
  });

  test('3. Pending review tab passes accessibility checks', async ({ page }) => {
    await page.goto('/admin');
    await page.getByRole('button', { name: 'Pending review' }).click();
    await expect(page.getByText('WHEN', { exact: true })).toBeVisible({ timeout: 10_000 });

    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });

  // Editing a pending transfer/spending bonus navigates to the Offers tab
  // and opens it in the exact same AdminOfferEditor a published offer uses
  // — not a copy of that editor rendered inline in Pending review, and not
  // the single-field inline edit the other pending-review tables still fall
  // back to. No real save is triggered here (see the scope note above on
  // seeding).
  test('4. Edit on a pending transfer or spending bonus opens the published-offer edit page', async ({ page }) => {
    await page.goto('/admin');
    await page.getByRole('button', { name: 'Pending review' }).click();

    const emptyState = page.getByText('No pending records — the sync queue is clear.');
    const bonusRow = page.locator('div.grid').filter({
      has: page.getByText(/^(Transfer bonus|Spending bonus)$/),
    }).first();
    await emptyState.or(bonusRow).waitFor({ timeout: 10_000 });

    const hasBonusRow = await bonusRow.isVisible().catch(() => false);
    test.skip(!hasBonusRow, 'No pending transfer/spending bonus row in this environment to edit');

    await bonusRow.getByRole('button', { name: 'Edit', exact: true }).click();

    // Navigated to the Offers tab — the same tab/editor a published offer uses.
    await expect(page.getByRole('button', { name: 'Offers', exact: true })).toHaveClass(/bg-gray-900/);
    await expect(page.getByText('EDIT OFFER', { exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Edit offer' })).toBeVisible();
    // Type toggle is locked to the record's own type while editing.
    await expect(page.getByText('Type is locked when editing')).toBeVisible();
    // Scrolled back to the top so the editor (rendered above the tab's own
    // long, unpaginated list) isn't left off-screen at whatever scroll
    // position Pending review was at.
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);

    // Publish saves the form and approves the row in one action, replacing
    // the old round trip back to Pending review's Approve button — only
    // offered while the row is still status: pending.
    await expect(page.getByRole('button', { name: 'Publish', exact: true })).toBeVisible();
  });

  // The Publish shortcut only makes sense for a row still awaiting review —
  // an already-live offer has nothing to approve, so its edit page must not
  // show it. No save is triggered here.
  test('5. Edit on an already-published offer has no Publish button', async ({ page }) => {
    await page.goto('/admin');

    const liveFilter = page.getByRole('button', { name: /^Live/ });
    await liveFilter.waitFor({ timeout: 10_000 });
    await liveFilter.click();

    const editButtons = page.getByRole('button', { name: 'Edit', exact: true });
    const hasLiveOffer = await editButtons.first().isVisible().catch(() => false);
    test.skip(!hasLiveOffer, 'No live/published offer in this environment to edit');

    await editButtons.first().click();

    await expect(page.getByRole('heading', { name: 'Edit offer' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Save changes', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Publish', exact: true })).toHaveCount(0);
  });
});
