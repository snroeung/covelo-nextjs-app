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
});
