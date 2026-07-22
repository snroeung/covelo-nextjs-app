import * as cheerio from "cheerio";
import { chromium, type Browser } from "@playwright/test";
import { isAllowed } from "./robots";

// Generic, non-identifying browser UA — never name Covelo. Anonymous scraping
// per the plan's risk-mitigation call: no login/session, no custom bot UA.
export const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

const MIN_DELAY_MS = 8_000;
const MAX_DELAY_MS = 15_000;

const lastFetchByDomain = new Map<string, number>();

// One in-flight request per domain, randomized 8-15s delay since we saw no
// Crawl-delay directive on any of the 9 checked sites (self-imposed limit).
async function throttle(url: string): Promise<void> {
  const { origin } = new URL(url);
  const last = lastFetchByDomain.get(origin);
  const now = Date.now();
  const wait = MIN_DELAY_MS + Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS);

  if (last !== undefined) {
    const elapsed = now - last;
    if (elapsed < wait) {
      await new Promise((resolve) => setTimeout(resolve, wait - elapsed));
    }
  }
  lastFetchByDomain.set(origin, Date.now());
}

function htmlToText(html: string): string {
  const $ = cheerio.load(html);
  $("script, style, nav, footer, header, noscript, svg, iframe, form").remove();
  const article = $("article");
  const scope = article.length > 0 ? article : $("body");
  return scope.text().replace(/\s+/g, " ").trim();
}

export interface FetchResult {
  text: string;
  fetchedUrl: string;
}

export async function fetchStatic(url: string): Promise<FetchResult | null> {
  if (!(await isAllowed(url, USER_AGENT))) return null;
  await throttle(url);

  console.log(`[fetch:static] GET ${url}`);
  let res: Response;
  try {
    res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[fetch:static] network error for ${url}: ${message}`);
    throw err;
  }
  if (!res.ok) {
    console.error(`[fetch:static] ${url} → HTTP ${res.status} ${res.statusText}`);
    return null;
  }
  return { text: htmlToText(await res.text()), fetchedUrl: url };
}

let sharedBrowser: Browser | null = null;

async function getBrowser(): Promise<Browser> {
  if (!sharedBrowser) sharedBrowser = await chromium.launch({ headless: true });
  return sharedBrowser;
}

// Fresh context per call — no cookies/session persisted across requests.
export async function fetchRendered(url: string): Promise<FetchResult | null> {
  if (!(await isAllowed(url, USER_AGENT))) return null;
  await throttle(url);

  console.log(`[fetch:rendered] GET ${url}`);
  const browser = await getBrowser();
  const context = await browser.newContext({ userAgent: USER_AGENT });
  try {
    const page = await context.newPage();
    // "load" not "networkidle" — marketing pages with chat/analytics widgets
    // never go network-idle, causing every fetch to hit the timeout. Grace
    // period below gives late-hydrating JS a chance without hard-failing.
    const response = await page.goto(url, { waitUntil: "load", timeout: 30_000 });
    if (response && !response.ok()) {
      console.error(`[fetch:rendered] ${url} → HTTP ${response.status()} ${response.statusText()}`);
    }
    await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => {
      console.warn(`[fetch:rendered] ${url} never reached networkidle within 5s, proceeding anyway`);
    });
    const html = await page.content();
    return { text: htmlToText(html), fetchedUrl: url };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[fetch:rendered] failed for ${url}: ${message}`);
    throw err;
  } finally {
    await context.close();
  }
}

export interface SectionSpec {
  label: string;
  selector: string;
}

// For SPA tab widgets where every panel is already in the DOM (just
// hidden="" on the inactive ones) — no clicking needed, just read each
// panel's textContent directly (bypasses the hidden attr, unlike
// page.innerText which respects CSS visibility). Keeps each section's text
// under its own "== label ==" marker so the extraction prompt can attribute
// properties to the right tab/category instead of one flattened blob.
export async function fetchRenderedSections(
  url: string,
  sections: SectionSpec[],
): Promise<FetchResult | null> {
  if (!(await isAllowed(url, USER_AGENT))) return null;
  await throttle(url);

  console.log(`[fetch:rendered-sections] GET ${url} (${sections.length} sections)`);
  const browser = await getBrowser();
  const context = await browser.newContext({ userAgent: USER_AGENT });
  try {
    const page = await context.newPage();
    const response = await page.goto(url, { waitUntil: "load", timeout: 30_000 });
    if (response && !response.ok()) {
      console.error(`[fetch:rendered-sections] ${url} → HTTP ${response.status()} ${response.statusText()}`);
    }
    await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => {
      console.warn(`[fetch:rendered-sections] ${url} never reached networkidle within 5s, proceeding anyway`);
    });

    const blocks: string[] = [];
    for (const section of sections) {
      const raw = await page
        .locator(section.selector)
        .first()
        .evaluate((el) => el.textContent ?? "")
        .catch(() => null);
      if (raw === null) {
        console.warn(`[fetch:rendered-sections] selector "${section.selector}" not found, skipping "${section.label}"`);
        continue;
      }
      blocks.push(`== ${section.label} ==\n${raw.replace(/\s+/g, " ").trim()}`);
    }

    if (blocks.length === 0) {
      console.error(`[fetch:rendered-sections] all ${sections.length} section selectors missed for ${url}`);
      return null;
    }
    return { text: blocks.join("\n\n"), fetchedUrl: url };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[fetch:rendered-sections] failed for ${url}: ${message}`);
    throw err;
  } finally {
    await context.close();
  }
}

// Same-process cache for fetchClickThroughPanels, keyed by the exact
// (url, triggerSelector, resultSelector) tuple. Two source configs that
// scrape the same accordion for different recordTypes (e.g. Citi ThankYou
// transfer_partner + transfer_bonus) share one click-through pass instead of
// paying the 8-15s throttle + N clicks twice in the same run.
const clickThroughCache = new Map<string, Promise<FetchResult | null>>();

// For single-open accordions where content only renders after a real click
// (unlike fetchRenderedSections, which reads DOM already present but
// CSS-hidden). `triggerSelector` is a single CSS selector matching every
// tile's trigger element (e.g. a shared data-attribute suffix) — panels are
// discovered at runtime instead of a hardcoded per-partner list, so new/
// removed tiles on the source site need no code change. Clicks each match
// in order and reads the shared result container after each click — the
// accordion auto-collapses the previous panel, so no separate "close" step
// is needed.
export async function fetchClickThroughPanels(
  url: string,
  triggerSelector: string,
  resultSelector: string,
): Promise<FetchResult | null> {
  const cacheKey = `${url}::${triggerSelector}::${resultSelector}`;
  const cached = clickThroughCache.get(cacheKey);
  if (cached) return cached;

  const promise = fetchClickThroughPanelsUncached(url, triggerSelector, resultSelector);
  clickThroughCache.set(cacheKey, promise);
  return promise;
}

async function fetchClickThroughPanelsUncached(
  url: string,
  triggerSelector: string,
  resultSelector: string,
): Promise<FetchResult | null> {
  if (!(await isAllowed(url, USER_AGENT))) return null;
  await throttle(url);

  console.log(`[fetch:click-through] GET ${url} (triggers: "${triggerSelector}")`);
  const browser = await getBrowser();
  const context = await browser.newContext({ userAgent: USER_AGENT });
  try {
    const page = await context.newPage();
    const response = await page.goto(url, { waitUntil: "load", timeout: 30_000 });
    if (response && !response.ok()) {
      console.error(`[fetch:click-through] ${url} → HTTP ${response.status()} ${response.statusText()}`);
    }
    await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => {
      console.warn(`[fetch:click-through] ${url} never reached networkidle within 5s, proceeding anyway`);
    });

    const triggerCount = await page.locator(triggerSelector).count();
    console.log(`[fetch:click-through] found ${triggerCount} trigger(s) matching "${triggerSelector}"`);

    const blocks: string[] = [];
    for (let i = 0; i < triggerCount; i++) {
      const trigger = page.locator(triggerSelector).nth(i);
      const label =
        (await trigger.evaluate((el) => el.textContent ?? "").catch(() => ""))
          .replace(/\s+/g, " ")
          .trim() || `panel ${i + 1}`;

      const clicked = await trigger
        .click({ timeout: 5_000 })
        .then(() => true)
        .catch(() => false);
      if (!clicked) {
        console.warn(`[fetch:click-through] trigger ${i} ("${label}") could not be clicked, skipping`);
        continue;
      }
      await page.waitForTimeout(800);

      const raw = await page
        .locator(resultSelector)
        .first()
        .evaluate((el) => el.textContent ?? "")
        .catch(() => null);
      if (raw === null) {
        console.warn(`[fetch:click-through] result selector "${resultSelector}" not found after clicking "${label}"`);
        continue;
      }
      blocks.push(`== ${label} ==\n${raw.replace(/\s+/g, " ").trim()}`);
    }

    if (blocks.length === 0) {
      console.error(`[fetch:click-through] all ${triggerCount} trigger(s) missed for ${url}`);
      return null;
    }
    return { text: blocks.join("\n\n"), fetchedUrl: url };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[fetch:click-through] failed for ${url}: ${message}`);
    throw err;
  } finally {
    await context.close();
  }
}

export async function closeBrowser(): Promise<void> {
  if (sharedBrowser) {
    await sharedBrowser.close();
    sharedBrowser = null;
  }
}
