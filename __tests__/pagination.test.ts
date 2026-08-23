import { describe, it, expect } from 'vitest';
import {
  clampPage,
  isPerPage,
  pageForNewPerPage,
  pageNumbers,
  pageRange,
  paginate,
  parsePerPage,
  totalPages,
} from '@/lib/pagination';

describe('totalPages', () => {
  it('returns 1 for an empty or exactly-full page', () => {
    expect(totalPages(0, 50)).toBe(1);
    expect(totalPages(50, 50)).toBe(1);
  });

  it('rounds up for a partial extra page', () => {
    expect(totalPages(51, 50)).toBe(2);
    expect(totalPages(237, 100)).toBe(3);
  });

  it('falls back to the default page size for 0/NaN instead of dividing by zero', () => {
    expect(totalPages(237, 0)).toBe(totalPages(237, 50));
    expect(totalPages(237, NaN)).toBe(totalPages(237, 50));
  });
});

describe('clampPage', () => {
  it('clamps below the valid range up to 1', () => {
    expect(clampPage(0, 30, 10)).toBe(1);
    expect(clampPage(-3, 30, 10)).toBe(1);
    expect(clampPage(NaN, 30, 10)).toBe(1);
  });

  it('clamps beyond the last page down to the last page', () => {
    expect(clampPage(9, 30, 10)).toBe(3);
  });

  it('passes through an in-range page unchanged', () => {
    expect(clampPage(2, 30, 10)).toBe(2);
  });

  it('treats an empty list as a single page', () => {
    expect(clampPage(1, 0, 50)).toBe(1);
  });
});

describe('paginate', () => {
  const items = Array.from({ length: 25 }, (_, i) => i + 1);

  it('slices the first page', () => {
    expect(paginate(items, 1, 10)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it('slices a middle page', () => {
    expect(paginate(items, 2, 10)).toEqual([11, 12, 13, 14, 15, 16, 17, 18, 19, 20]);
  });

  it('slices a short last page', () => {
    expect(paginate(items, 3, 10)).toEqual([21, 22, 23, 24, 25]);
  });

  it('returns an empty array for an empty input', () => {
    expect(paginate([], 1, 10)).toEqual([]);
  });

  it('clamps an out-of-range page instead of returning empty', () => {
    expect(paginate(items, 99, 10)).toEqual([21, 22, 23, 24, 25]);
  });

  it('does not mutate the input array', () => {
    const copy = [...items];
    paginate(items, 2, 10);
    expect(items).toEqual(copy);
  });
});

describe('pageRange', () => {
  it('reports a middle page range', () => {
    expect(pageRange(237, 5, 50)).toEqual({ from: 201, to: 237, total: 237 });
  });

  it('reports the first page range', () => {
    expect(pageRange(237, 1, 50)).toEqual({ from: 1, to: 50, total: 237 });
  });

  it('reports all-zero for an empty list', () => {
    expect(pageRange(0, 1, 50)).toEqual({ from: 0, to: 0, total: 0 });
  });
});

describe('pageForNewPerPage', () => {
  it('keeps the first visible item visible across page-size changes', () => {
    // page 3 of size 10 starts at item 21 (0-indexed 20) -> page 1 of size 50
    expect(pageForNewPerPage(3, 10, 50)).toBe(1);
    // page 2 of size 50 starts at item 51 (0-indexed 50) -> page 6 of size 10
    expect(pageForNewPerPage(2, 50, 10)).toBe(6);
  });

  it('page 1 stays page 1 regardless of size change', () => {
    expect(pageForNewPerPage(1, 10, 100)).toBe(1);
    expect(pageForNewPerPage(1, 100, 10)).toBe(1);
  });
});

describe('pageNumbers', () => {
  it('handles a single page', () => {
    expect(pageNumbers(1, 1)).toEqual([1]);
  });

  it('shows every page when the total is small', () => {
    expect(pageNumbers(1, 3)).toEqual([1, 2, 3]);
  });

  it('windows around the current page with gaps', () => {
    expect(pageNumbers(5, 10, 1)).toEqual([1, 'gap', 4, 5, 6, 'gap', 10]);
  });

  it('collapses a one-page gap to the number instead of an ellipsis', () => {
    expect(pageNumbers(3, 5, 1)).toEqual([1, 2, 3, 4, 5]);
  });

  it('always includes first and last', () => {
    const result = pageNumbers(4, 20, 1);
    expect(result[0]).toBe(1);
    expect(result[result.length - 1]).toBe(20);
  });

  it('never duplicates a page number and stays monotonically increasing', () => {
    const numeric = pageNumbers(6, 20, 1).filter((p): p is number => p !== 'gap');
    expect(new Set(numeric).size).toBe(numeric.length);
    for (let i = 1; i < numeric.length; i++) {
      expect(numeric[i]).toBeGreaterThan(numeric[i - 1]);
    }
  });
});

describe('isPerPage / parsePerPage', () => {
  it('accepts the known options', () => {
    expect(isPerPage(10)).toBe(true);
    expect(isPerPage(20)).toBe(true);
    expect(isPerPage(50)).toBe(true);
    expect(isPerPage(100)).toBe(true);
  });

  it('rejects unknown values', () => {
    expect(isPerPage(75)).toBe(false);
    expect(isPerPage(0)).toBe(false);
    expect(isPerPage('50')).toBe(false);
  });

  it('parses valid string values', () => {
    expect(parsePerPage('10')).toBe(10);
    expect(parsePerPage('50')).toBe(50);
    expect(parsePerPage('100')).toBe(100);
  });

  it('falls back to the default for null, unrecognised, or malformed input', () => {
    expect(parsePerPage(null)).toBe(50);
    expect(parsePerPage(undefined)).toBe(50);
    expect(parsePerPage('0')).toBe(50);
    expect(parsePerPage('75')).toBe(50);
    expect(parsePerPage('abc')).toBe(50);
  });
});
