'use client';

import { useEffect, useRef } from 'react';
import { pageNumbers, pageRange, totalPages } from '@/lib/pagination';

export const FEATURED_PER_PAGE = 2;

interface FeaturedPaginationProps {
  /** Already clamped by the caller — this component never corrects it. */
  page: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  isDark: boolean;
  /** Singular noun for the range summary: 'flight' | 'hotel'. */
  itemLabel: string;
  /** Unique per page, so two mounted instances can't share a nav label. */
  idPrefix: string;
}

/**
 * Fixed 2-per-page pager for the Featured flights / Featured hotels strips —
 * a separate control from the regular-results Pagination, no per-page
 * selector, since the featured strip is a small highlight, not a full list.
 */
export function FeaturedPagination({
  page,
  totalItems,
  onPageChange,
  isDark,
  itemLabel,
  idPrefix,
}: FeaturedPaginationProps) {
  const navRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (document.activeElement === document.body) {
      navRef.current?.focus({ preventScroll: true });
    }
  }, [page]);

  // Everything fits on one page — no control needed.
  if (totalItems <= FEATURED_PER_PAGE) return null;

  const last = totalPages(totalItems, FEATURED_PER_PAGE);
  const { from, to, total } = pageRange(totalItems, page, FEATURED_PER_PAGE);

  const btn = `inline-flex items-center justify-center min-h-11 min-w-11 px-3 rounded-lg border text-sm font-semibold transition-colors`;
  const idle = isDark
    ? 'border-gph-dark-line text-gph-dark-muted hover:border-gph-dark-action hover:text-gph-dark-ink'
    : 'border-gray-300 text-gray-600 hover:border-gray-400 hover:text-gray-900';
  const active = isDark
    ? 'border-gph-dark-action bg-gph-dark-action text-gph-dark-bg'
    : 'border-gray-900 bg-gray-900 text-white';
  const mutedCls = isDark ? 'text-gph-dark-muted' : 'text-gray-600';

  function step(delta: number) {
    onPageChange(Math.min(last, Math.max(1, page + delta)));
  }

  return (
    <nav
      ref={navRef}
      tabIndex={-1}
      aria-label={`Featured ${itemLabel} pagination`}
      data-testid={`${idPrefix}-featured-pagination`}
      className={`flex flex-col-reverse sm:flex-row sm:items-center justify-between gap-3 pt-3 mt-1 border-t outline-none ${
        isDark ? 'border-gph-dark-line' : 'border-gray-200'
      }`}
    >
      <p role="status" className={`text-[10px] font-bold font-mono uppercase tracking-widest ${mutedCls}`}>
        Showing {from}–{to} of {total} {itemLabel}
        {total !== 1 ? 's' : ''}
      </p>

      <div className="flex items-center gap-1.5 self-end sm:self-auto">
        <button
          type="button"
          onClick={() => step(-1)}
          disabled={page <= 1}
          aria-label="Previous featured page"
          className={`${btn} ${idle} disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          ‹ Prev
        </button>

        <span className="hidden sm:flex items-center gap-1.5">
          {pageNumbers(page, last).map((p, i) =>
            p === 'gap' ? (
              <span key={`gap-${i}`} aria-hidden="true" className={`px-1 ${mutedCls}`}>
                …
              </span>
            ) : (
              <button
                key={p}
                type="button"
                onClick={() => onPageChange(p)}
                aria-label={`Featured page ${p}`}
                aria-current={p === page ? 'page' : undefined}
                className={`${btn} ${p === page ? active : idle}`}
              >
                {p}
              </button>
            ),
          )}
        </span>

        <span className={`sm:hidden px-2 text-[10px] font-bold font-mono uppercase tracking-widest ${mutedCls}`}>
          Page {page} of {last}
        </span>

        <button
          type="button"
          onClick={() => step(1)}
          disabled={page >= last}
          aria-label="Next featured page"
          className={`${btn} ${idle} disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          Next ›
        </button>
      </div>
    </nav>
  );
}
