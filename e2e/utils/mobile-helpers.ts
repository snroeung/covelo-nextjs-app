import { expect, type Page } from '@playwright/test';

/** Phone profile for `test.use(...)` — desktop-only config stays; specs opt in per describe block. */
export const MOBILE = {
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
} as const;

/** The page must not be draggable sideways: nothing wider than the viewport. */
export async function expectNoHorizontalScroll(page: Page) {
  const { scrollWidth, innerWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  }));
  expect(scrollWidth).toBeLessThanOrEqual(innerWidth);
}

/** Real touch swipe (Playwright has no gesture API, so go through CDP). */
export async function swipe(page: Page, x: number, y: number, dx: number, dy = 0) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.synthesizeScrollGesture', {
    x, y, xDistance: dx, yDistance: dy, gestureSourceType: 'touch', speed: 800,
  });
  await cdp.detach();
}

/** Bottom tab bar (phone only). */
export const tabBar = (page: Page) => page.getByTestId('mobile-tab-bar');
