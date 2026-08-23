// Pure paging math shared by the /flights and /hotels results lists.
// Every branch lives here so `components/Pagination.tsx` stays a branch-free
// renderer. No React, no I/O — keep this testable in isolation
// (see __tests__/pagination.test.ts).

export const PER_PAGE_OPTIONS = [10, 20, 50, 100] as const;
export type PerPage = (typeof PER_PAGE_OPTIONS)[number];
export const DEFAULT_PER_PAGE: PerPage = 50;
export const PER_PAGE_STORAGE_KEY = 'covelo_results_per_page';

/** Page size values originate from localStorage and <select> strings, so every
 *  entry point normalises before dividing by them. */
function size(perPage: number): number {
  const n = Math.floor(perPage);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_PER_PAGE;
}

function count(totalItems: number): number {
  const n = Math.floor(totalItems);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export function isPerPage(v: unknown): v is PerPage {
  return PER_PAGE_OPTIONS.includes(v as PerPage);
}

/** localStorage value → a safe PerPage; anything unrecognised → DEFAULT_PER_PAGE. */
export function parsePerPage(raw: string | null | undefined): PerPage {
  if (raw == null) return DEFAULT_PER_PAGE;
  const n = Number(raw);
  return isPerPage(n) ? n : DEFAULT_PER_PAGE;
}

/** Always >= 1, so an empty result set still reads as "Page 1 of 1". */
export function totalPages(totalItems: number, perPage: number): number {
  return Math.max(1, Math.ceil(count(totalItems) / size(perPage)));
}

/** NaN / 0 / negative / beyond-last all clamp into [1, totalPages]. */
export function clampPage(page: number, totalItems: number, perPage: number): number {
  const last = totalPages(totalItems, perPage);
  const n = Math.floor(page);
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(n, last);
}

export function paginate<T>(items: readonly T[], page: number, perPage: number): T[] {
  const per = size(perPage);
  const safe = clampPage(page, items.length, per);
  const start = (safe - 1) * per;
  return items.slice(start, start + per);
}

/** 1-indexed inclusive display range; {from:0,to:0,total:0} when empty. */
export function pageRange(
  totalItems: number,
  page: number,
  perPage: number,
): { from: number; to: number; total: number } {
  const total = count(totalItems);
  if (total === 0) return { from: 0, to: 0, total: 0 };
  const per = size(perPage);
  const safe = clampPage(page, total, per);
  const from = (safe - 1) * per + 1;
  return { from, to: Math.min(safe * per, total), total };
}

/** Keep the first item of the current page visible when the page size changes:
 *  item 21 on page 3 of 10 lives on page 1 of 50. */
export function pageForNewPerPage(page: number, perPage: number, next: number): number {
  const per = size(perPage);
  const safe = Math.max(1, Math.floor(page) || 1);
  const firstItemIndex = (safe - 1) * per; // 0-indexed
  return Math.floor(firstItemIndex / size(next)) + 1;
}

/** Windowed page list with first and last always pinned. A gap that would hide
 *  exactly one page collapses to that number — an ellipsis concealing nothing
 *  costs the same width and tells the user less. */
export function pageNumbers(page: number, total: number, window = 1): (number | 'gap')[] {
  const last = Math.max(1, Math.floor(total) || 1);
  const current = clampPage(page, last, 1);
  const span = Math.max(0, Math.floor(window) || 0);

  const wanted = new Set<number>([1, last]);
  for (let p = current - span; p <= current + span; p++) {
    if (p >= 1 && p <= last) wanted.add(p);
  }

  const sorted = [...wanted].sort((a, b) => a - b);
  const out: (number | 'gap')[] = [];
  sorted.forEach((p, i) => {
    const prev = sorted[i - 1];
    if (prev !== undefined) {
      if (p - prev === 2) out.push(prev + 1); // gap of one → show the number
      else if (p - prev > 2) out.push('gap');
    }
    out.push(p);
  });
  return out;
}
