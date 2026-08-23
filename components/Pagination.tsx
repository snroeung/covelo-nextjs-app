'use client';

import { useEffect, useRef } from 'react';
import {
  PER_PAGE_OPTIONS,
  pageNumbers,
  pageRange,
  totalPages,
  type PerPage,
} from '@/lib/pagination';

interface PaginationProps {
  /** Already clamped by the caller — this component never corrects it. */
  page: number;
  perPage: number;
  /** Length of the filtered + sorted list being paged. */
  totalItems: number;
  onPageChange: (page: number) => void;
  onPerPageChange: (perPage: PerPage) => void;
  isDark: boolean;
  /** Singular noun for the range summary: 'flight' | 'hotel'. */
  itemLabel: string;
  /** Unique per page, so two mounted instances can't share a <select> id. */
  idPrefix: string;
}

export function Pagination({
  page,
  perPage,
  totalItems,
  onPageChange,
  onPerPageChange,
  isDark,
  itemLabel,
  idPrefix,
}: PaginationProps) {
  const navRef = useRef<HTMLElement>(null);

  // Clicking Next onto the last page disables the button under the cursor and
  // focus falls to <body>. Pull it back to the nav so keyboard users aren't
  // dumped at the top of the document. preventScroll is mandatory: without it
  // the browser scrolls this bottom-anchored nav into view and undoes the
  // caller's scroll-to-top.
  useEffect(() => {
    if (document.activeElement === document.body) {
      navRef.current?.focus({ preventScroll: true });
    }
  }, [page]);

  // Below the smallest page size neither control means anything, and small
  // result sets stay visually identical to before pagination existed.
  if (totalItems <= PER_PAGE_OPTIONS[0]) return null;

  const last = totalPages(totalItems, perPage);
  const { from, to, total } = pageRange(totalItems, page, perPage);

  const btn = `inline-flex items-center justify-center min-h-11 min-w-11 px-3 rounded-lg border text-sm font-semibold transition-colors`;
  const idle = isDark
    ? 'border-gph-dark-line text-gph-dark-muted hover:border-gph-dark-action hover:text-gph-dark-ink'
    : 'border-gray-300 text-gray-600 hover:border-gray-400 hover:text-gray-900';
  const active = isDark
    ? 'border-gph-dark-action bg-gph-dark-action text-gph-dark-bg'
    : 'border-gray-900 bg-gray-900 text-white';
  const mutedCls = isDark ? 'text-gph-dark-muted' : 'text-gray-600';
  const surfaceCls = isDark
    ? 'bg-gph-dark-card text-gph-dark-ink border-gph-dark-line'
    : 'bg-white text-gray-900 border-gray-300';

  function step(delta: number) {
    onPageChange(Math.min(last, Math.max(1, page + delta)));
  }

  return (
    <nav
      ref={navRef}
      tabIndex={-1}
      aria-label={`${itemLabel} results pagination`}
      className={`flex flex-col-reverse sm:flex-row sm:items-center justify-between gap-3 pt-4 mt-2 border-t outline-none ${
        isDark ? 'border-gph-dark-line' : 'border-gray-200'
      }`}
    >
      <div className="flex items-center gap-3 flex-wrap">
        <p role="status" className={`text-[10px] font-bold font-mono uppercase tracking-widest ${mutedCls}`}>
          Showing {from}–{to} of {total} {itemLabel}
          {total !== 1 ? 's' : ''}
        </p>
        <div className="flex items-center gap-2">
          <label
            htmlFor={`${idPrefix}-per-page`}
            className={`text-[10px] font-bold font-mono uppercase tracking-widest ${mutedCls}`}
          >
            Per page
          </label>
          <select
            id={`${idPrefix}-per-page`}
            value={perPage}
            onChange={(e) => onPerPageChange(Number(e.target.value) as PerPage)}
            className={`min-h-11 rounded-lg border pl-3 pr-2 text-sm font-semibold ${surfaceCls}`}
          >
            {PER_PAGE_OPTIONS.map((n) => (
              // Chrome renders <option> against the select's own background, so
              // an unset option colour is invisible in dark mode.
              <option key={n} value={n} className={surfaceCls}>
                {n}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex items-center gap-1.5 self-end sm:self-auto">
        <button
          type="button"
          onClick={() => step(-1)}
          disabled={page <= 1}
          aria-label="Previous page"
          className={`${btn} ${idle} disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          ‹ Prev
        </button>

        {/* Seven 44px targets plus gaps don't fit 375px — collapse to a label. */}
        <span className={`sm:hidden px-2 text-[10px] font-bold font-mono uppercase tracking-widest ${mutedCls}`}>
          Page {page} of {last}
        </span>

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
                aria-label={`Page ${p}`}
                aria-current={p === page ? 'page' : undefined}
                className={`${btn} ${p === page ? active : idle}`}
              >
                {p}
              </button>
            ),
          )}
        </span>

        <button
          type="button"
          onClick={() => step(1)}
          disabled={page >= last}
          aria-label="Next page"
          className={`${btn} ${idle} disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          Next ›
        </button>
      </div>
    </nav>
  );
}
