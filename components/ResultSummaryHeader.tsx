'use client';

import type { ReactNode } from 'react';

interface Props {
  /** Small mono eyebrow — 'ROUND TRIP · 2 ROUTES' */
  eyebrow: string;
  /** Headline identity — the operating airline */
  title: string;
  /** AddToTripButton and friends */
  trailing?: ReactNode;
  /** Circular brand mark shown ahead of the title — the airline badge */
  mark?: ReactNode;
  /** False when a CollectionBanner sits above and owns the card's top corners */
  roundedTop?: boolean;
  /** Optional data-testid on the title element, for callers that need to read it back in tests */
  titleTestId?: string;
  isDark: boolean;
}

/**
 * Neutral summary strip at the top of a result card: what was searched, and who
 * is flying it. The winning redemption lives in the card's BestRedemptionBar at the
 * bottom, next to the toggle that opens the full comparison.
 */
export function ResultSummaryHeader({
  eyebrow, title, trailing, mark, roundedTop = true, titleTestId, isDark,
}: Props) {
  const surface = isDark ? 'bg-gph-dark-linesoft' : 'bg-gray-200';
  const inkCls = isDark ? 'text-gph-dark-ink' : 'text-gray-900';
  // gray-500 on gray-100 lands at 4.39:1 — below the AA floor for this 9px eyebrow.
  const mutedCls = isDark ? 'text-gph-dark-muted' : 'text-gray-600';

  return (
    <div className={`px-5 py-4 ${roundedTop ? 'rounded-t-xl' : ''} ${surface}`}>
      <div className="flex items-center justify-between gap-4">

        {/* Left — what was searched */}
        <div className="flex items-center gap-3 min-w-0">
          {mark}
          <div className="min-w-0">
            <p className={`text-[9px] font-bold font-mono uppercase tracking-widest ${mutedCls}`}>
              {eyebrow}
            </p>
            <p data-testid={titleTestId} className={`text-lg md:text-xl font-bold leading-tight mt-0.5 truncate ${inkCls}`}>
              {title}
            </p>
          </div>
        </div>

        {trailing && <div className="shrink-0">{trailing}</div>}
      </div>
    </div>
  );
}
