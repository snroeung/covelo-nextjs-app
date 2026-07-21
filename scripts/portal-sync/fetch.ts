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

export async function closeBrowser(): Promise<void> {
  if (sharedBrowser) {
    await sharedBrowser.close();
    sharedBrowser = null;
  }
}
