import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.use({ viewport: { width: 375, height: 800 } });

function futureDate(daysFromNow: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return d.toISOString().split('T')[0];
}

const QUERY = new URLSearchParams({
  origin: 'PHL',
  originName: 'Philadelphia International Airport',
  destinationCode: 'SFO',
  destination: 'San Francisco International Airport',
  tripType: 'oneway',
  departDate: futureDate(21),
  adults: '1',
  cabinClass: 'economy',
}).toString();

test('Refine opens as a bottom sheet on a phone and Show results closes it', async ({ page }) => {
  await page.goto(`/flights?${QUERY}`);
  const refine = page.getByRole('button', { name: /^Refine/ });
  test.skip(!(await refine.isVisible({ timeout: 40_000 }).catch(() => false)), 'no flight results to refine');

  await refine.click();
  const sheet = page.getByRole('dialog', { name: 'Refine' });
  await expect(sheet).toBeVisible();
  const box = await sheet.getByRole('button', { name: 'Show results' }).boundingBox();
  expect(box?.height).toBeGreaterThanOrEqual(44);
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);

  await sheet.getByRole('button', { name: 'Show results' }).click();
  await expect(sheet).toBeHidden();
});
