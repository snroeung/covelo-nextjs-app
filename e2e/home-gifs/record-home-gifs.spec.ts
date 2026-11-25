import { test, expect, type Page, type BrowserContext, type Locator } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import {
  openFlightCompare,
  createTestTrip,
  deleteTestTrip,
  stubWindowOpen,
  TEST_PREFIX,
} from '../utils/admin-helpers';
import { CARD_NAMES, type CardId } from '../../lib/points/types';
import { seedMemberOfferPost, type SeededMemberOffer } from '../utils/board-seed';

/**
 * Home-page demo-GIF recorder. NOT a CI test — it only runs when RECORD_GIFS=1
 * (set by scripts/record-home-gifs.sh); otherwise every case skips so the normal
 * `npm run test:e2e` run stays green and fast.
 *
 * Each case drives one real flow (reusing the existing e2e helpers + seeding) in
 * its own video-recording context and saves the raw .webm to GIF_RAW_DIR. The
 * shell script then turns each .webm into public/home/<name>.gif.
 *
 * Signed in as the e2e admin (e2e/.auth/admin.json) so the points engine has a
 * wallet and the board seeders can write.
 */

const RECORDING = process.env.RECORD_GIFS === '1';
const RAW_DIR = process.env.GIF_RAW_DIR || path.resolve(process.cwd(), 'public/home/_raw');
const AUTH = 'e2e/.auth/admin.json';
const VIEW = { width: 1200, height: 760 };

// A handful of cards so every comparison has transfer + portal rows to show.
const DEMO_CARDS: CardId[] = ['chase_reserve', 'amex_platinum', 'c1_venture_x', 'citi_strata_premier', 'bilt_obsidian'];

function futureDate(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

const FLIGHT_QUERY = new URLSearchParams({
  origin: 'PHL',
  originName: 'Philadelphia International Airport',
  destinationCode: 'SFO',
  destination: 'San Francisco International Airport',
  tripType: 'roundtrip',
  departDate: futureDate(21),
  returnDate: futureDate(28),
  adults: '1',
  cabinClass: 'economy',
}).toString();

// ── Fake cursor: Playwright videos don't capture the OS pointer, so draw one ──
const CURSOR_SCRIPT = `
  (() => {
    if (window.__demoCursor) return;
    const dot = document.createElement('div');
    dot.id = '__demoCursor';
    Object.assign(dot.style, {
      position: 'fixed', top: '0', left: '0', width: '18px', height: '18px',
      marginLeft: '-5px', marginTop: '-4px', zIndex: '2147483647',
      pointerEvents: 'none', transition: 'opacity .2s',
      background: 'rgba(132,204,22,.55)', border: '2px solid #0c0c0d',
      borderRadius: '50% 50% 50% 2px', boxShadow: '0 1px 4px rgba(0,0,0,.4)',
    });
    document.documentElement.appendChild(dot);
    window.__demoCursor = dot;
    addEventListener('mousemove', (e) => {
      dot.style.left = e.clientX + 'px';
      dot.style.top = e.clientY + 'px';
    }, true);
  })();
`;

async function pause(page: Page, ms: number) {
  await page.waitForTimeout(ms);
}

/** Glide the fake cursor to an element's centre so the click reads on video. */
async function glideTo(page: Page, target: Locator): Promise<void> {
  const box = await target.boundingBox();
  if (!box) return;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 24 });
  await pause(page, 350);
}

async function clickVisible(page: Page, target: Locator): Promise<void> {
  await glideTo(page, target);
  await target.click();
}

interface Recorder {
  context: BrowserContext;
  page: Page;
}

async function openRecorder(browser: import('@playwright/test').Browser, signedIn = true): Promise<Recorder> {
  fs.mkdirSync(RAW_DIR, { recursive: true });
  const context = await browser.newContext({
    viewport: VIEW,
    storageState: signedIn ? AUTH : undefined,
    recordVideo: { dir: RAW_DIR, size: VIEW },
  });
  const page = await context.newPage();
  await page.addInitScript(CURSOR_SCRIPT);
  // Keep the points wallet stocked even if the profile sync lands empty.
  await page.addInitScript(
    ([key, cards]) => {
      try { localStorage.setItem(key as string, JSON.stringify(cards)); } catch { /* ignore */ }
    },
    ['milepath_selected_cards', DEMO_CARDS] as const,
  );
  return { context, page };
}

/** Close the context and rename its single video to <name>.webm. */
async function save(rec: Recorder, name: string): Promise<void> {
  const video = rec.page.video();
  await rec.context.close();
  if (!video) return;
  const src = await video.path();
  const dest = path.join(RAW_DIR, `${name}.webm`);
  fs.copyFileSync(src, dest);
  fs.rmSync(src, { force: true });
  console.log(`[home-gifs] saved ${dest}`);
}

async function gotoFlightResults(page: Page) {
  await page.goto(`/flights?${FLIGHT_QUERY}`);
  await expect(
    page.getByRole('main').getByText(/flights? · PHL → SFO|No flights found for this route and date|Flight search failed/),
  ).toBeVisible({ timeout: 30_000 });
}

// Persist a demo wallet to the admin profile once, so every recorded context
// (which syncs cards from the profile) has portal + transfer rows to compare.
test.beforeAll(async ({ browser }) => {
  test.skip(!RECORDING, 'Set RECORD_GIFS=1 (via scripts/record-home-gifs.sh) to record home-page GIFs');
  const context = await browser.newContext({ viewport: VIEW, storageState: AUTH });
  const page = await context.newPage();
  try {
    await page.goto(`/flights?${FLIGHT_QUERY}`);
    for (const id of DEMO_CARDS) {
      const btn = page.getByRole('button', { name: CARD_NAMES[id], exact: true }).first();
      const seen = await btn.waitFor({ state: 'visible', timeout: 8_000 }).then(() => true).catch(() => false);
      if (!seen) continue;
      if ((await btn.getAttribute('aria-pressed')) !== 'true') await btn.click();
    }
    await page.waitForTimeout(1_000);
  } catch {
    // Non-fatal — the localStorage seed in each recorder still gives a wallet.
  } finally {
    await context.close();
  }
});

test.describe.configure({ mode: 'serial' });

test.describe('home-page demo GIFs', () => {
  test.skip(!RECORDING, 'Set RECORD_GIFS=1 (via scripts/record-home-gifs.sh) to record home-page GIFs');

  // 1 — Flights/hotels: results loading in, then the best-portal panel on a card.
  test('search', async ({ browser }) => {
    const rec = await openRecorder(browser);
    const { page } = rec;
    try {
      await page.goto(`/flights?${FLIGHT_QUERY}`);
      // Linger on the loading state before results stream in.
      await pause(page, 1_200);
      await expect(
        page.getByRole('main').getByText(/flights? · PHL → SFO|No flights found for this route and date|Flight search failed/),
      ).toBeVisible({ timeout: 30_000 });
      const card = page.getByTestId('flight-card').first();
      if (await card.isVisible().catch(() => false)) {
        await card.scrollIntoViewIfNeeded();
        // The grey "Best value" strip (cpp + Compare) is the best-portal panel.
        await page.getByTestId('best-value-cpp').first().waitFor({ state: 'visible', timeout: 15_000 }).catch(() => {});
        await pause(page, 1_600);
        await page.mouse.wheel(0, 320);
        await pause(page, 1_600);
      }
    } finally {
      await save(rec, 'search');
    }
  });

  // 2 — Points comparison: the ranked redemption table in the Compare popup.
  test('compare', async ({ browser }) => {
    const rec = await openRecorder(browser);
    const { page } = rec;
    try {
      await gotoFlightResults(page);
      const card = page.getByTestId('flight-card').first();
      await expect(card).toBeVisible({ timeout: 20_000 });
      const compare = card.getByRole('button', { name: 'Compare →' });
      await compare.waitFor({ state: 'visible', timeout: 15_000 });
      await clickVisible(page, compare);
      const modal = page.getByTestId('compare-modal');
      await expect(modal).toBeVisible({ timeout: 10_000 });
      await expect(modal.getByTestId('redemption-table')).toBeVisible();
      await pause(page, 1_800);
      // Open the grouped alternatives so every portal/partner row shows.
      const more = modal.getByRole('button', { name: /^See \d+ (round-trip|one-way) options?$/ });
      if (await more.isVisible().catch(() => false)) {
        await clickVisible(page, more);
        await pause(page, 1_800);
        const close = modal.getByRole('button', { name: 'Close options' });
        if (await close.isVisible().catch(() => false)) await close.click();
      }
      await pause(page, 1_000);
    } finally {
      await save(rec, 'compare');
    }
  });

  // 3 — User reports: View deal → Submit result → the option's reports list.
  test('reports', async ({ browser }) => {
    const rec = await openRecorder(browser);
    const { page } = rec;
    try {
      await gotoFlightResults(page);
      const card = page.getByTestId('flight-card').first();
      await expect(card).toBeVisible({ timeout: 20_000 });
      const modal = await openFlightCompare(page, card);
      expect(modal).not.toBeNull();
      await stubWindowOpen(page);
      const viewDeal = modal!.getByRole('button', { name: /^View deal on .+$/ }).first();
      await clickVisible(page, viewDeal);
      const leaving = modal!.getByTestId('leaving-panel');
      await expect(leaving).toBeVisible({ timeout: 10_000 });
      await pause(page, 2_000); // show the editable quote + "couldn't find it" check
      const submit = leaving.getByRole('button', { name: 'Submit result' });
      await clickVisible(page, submit);
      await expect(modal!.getByTestId('report-confirmation')).toBeVisible({ timeout: 10_000 });
      await expect(modal!.getByTestId('reports-list').first()).toBeVisible();
      await pause(page, 2_000);
    } finally {
      await save(rec, 'reports');
    }
  });

  // 4 — Trip planner: the saved-trips rail, then a full itinerary.
  test('trip', async ({ browser }) => {
    const rec = await openRecorder(browser);
    const { page } = rec;
    let tripUrl: string | null = null;
    try {
      // Ensure at least one trip exists so the rail isn't empty (unrecorded-ish setup).
      tripUrl = await createTestTrip(page).catch(() => null);
      // Saved searches = the trip rail.
      await page.goto('/trip-planner');
      await page.waitForLoadState('networkidle');
      await pause(page, 1_600);
      const railCard = page
        .locator('[data-testid="trip-rail-card"]')
        .filter({ hasText: `${TEST_PREFIX} Test trip` })
        .first();
      if (await railCard.isVisible().catch(() => false)) {
        await clickVisible(page, railCard);
      } else if (tripUrl) {
        await page.goto(tripUrl);
      }
      // Full itinerary.
      await expect(page.getByRole('heading', { name: /Itinerary/ })).toBeVisible({ timeout: 15_000 });
      await pause(page, 1_600);
      await page.mouse.wheel(0, 300);
      await pause(page, 1_800);
    } finally {
      await save(rec, 'trip');
      await deleteTestTrip(page).catch(() => {});
    }
  });

  // 5 — Discover board: example posts, then expand one to its Covelo deal.
  test('board', async ({ browser }) => {
    const rec = await openRecorder(browser);
    const { page } = rec;
    let seeded: SeededMemberOffer | null = null;
    try {
      seeded = await seedMemberOfferPost({
        body: 'Transfer Bilt points to American AAdvantage at a 30% bonus — great for domestic saver space.',
      });
      const token = seeded.title.split(' ').pop()!;
      await page.goto(`/discover/board?q=${token}`);
      const article = page.locator('article').filter({ hasText: seeded.title }).first();
      await expect(article).toBeVisible({ timeout: 15_000 });
      await article.scrollIntoViewIfNeeded();
      await pause(page, 1_800); // example post with its compact offer preview
      // Expand the post → full Covelo deal on the detail page.
      await clickVisible(page, article);
      await expect(page).toHaveURL(new RegExp(`/discover/board/${seeded.postId}`), { timeout: 10_000 });
      await pause(page, 2_200);
    } finally {
      await save(rec, 'board');
      if (seeded) await seeded.cleanup().catch(() => {});
    }
  });
});
