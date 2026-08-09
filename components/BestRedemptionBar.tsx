'use client';

import type { ReactNode } from 'react';
import type { PointsResult } from '@/lib/points/types';
import { rankOptions } from '@/lib/points/rankOptions';
import { buildRowView } from '@/lib/points/rowView';

interface Props {
  result: PointsResult;
  expanded: boolean;
  onToggle: () => void;
  /**
   * Show the winning redemption inside the bar. Flights carry it in their
   * summary header already; hotel cards have no header, so it lives here.
   */
  showMetrics?: boolean;
  /** AddToTripButton and friends */
  trailing?: ReactNode;
  /** False while the points grid is expanded below and owns the bottom corners */
  roundedBottom?: boolean;
  isDark: boolean;
}

function Metric({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-[9px] font-bold font-mono uppercase tracking-widest text-cv-navy-400 mb-0.5">
        {label}
      </p>
      {children}
    </div>
  );
}

/**
 * Dark strip that closes a result card: the winning redemption (hotels) plus
 * the toggle that expands the full portal comparison. Keeping the grid behind a
 * toggle keeps a list of results scannable — the card stays one screen tall
 * until the user asks for the breakdown.
 */
export function BestRedemptionBar({
  result, expanded, onToggle, showMetrics, trailing, roundedBottom = true, isDark,
}: Props) {
  const rows = rankOptions(result);
  if (rows.length === 0) return null;

  const best = buildRowView(rows[0], result);
  const count = rows.length;

  return (
    <div className={`flex flex-wrap items-center gap-4 md:gap-7 px-5 py-3 ${roundedBottom ? 'rounded-b-xl' : ''} ${
      isDark ? 'bg-gph-dark-navy' : 'bg-cv-navy-950'
    }`}>
      {showMetrics && (
        <>
          <Metric label={best.kind === 'portal' ? 'Best portal' : 'Best transfer'}>
            <p className="text-sm font-bold text-white leading-tight truncate max-w-56">
              {best.displayName}
            </p>
          </Metric>

          <Metric label="Best value">
            {best.cpp !== null ? (
              <p className="text-lg font-extrabold font-mono tabular-nums text-cv-green-500 leading-none">
                {best.cpp}
                <span className="text-[10px] font-bold ml-0.5">cpp</span>
              </p>
            ) : (
              <p className="text-sm font-bold font-mono text-cv-navy-300 leading-none">check program</p>
            )}
          </Metric>
        </>
      )}

      <div className="ml-auto flex items-center gap-2">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={expanded}
          className="min-h-11 px-4 rounded-lg bg-cv-lime-500 hover:bg-cv-lime-400 text-cv-navy-950 text-xs font-extrabold whitespace-nowrap transition-colors"
        >
          {expanded ? '↑ Hide' : `Compare ${count} portal${count !== 1 ? 's' : ''} →`}
        </button>
        {trailing}
      </div>
    </div>
  );
}
