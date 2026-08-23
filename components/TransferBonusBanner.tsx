'use client';

import { useState } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { useLiveTransferBonus, formatBonusEndDate, ISSUER_LOYALTY_NAME } from '@/lib/points/transferBonus';
import type { PointsResult } from '@/lib/points/types';

/**
 * Amber notice strip shown between the card's summary header and its itinerary,
 * only when a live promotion actually changes the redemption maths.
 */
export function TransferBonusBanner({
  result,
  rounded = true,
  scopeNote = 'applies to the complete booking',
}: {
  result: PointsResult | null;
  rounded?: boolean;
  /** Clarifies what the promo covers — 'applies to the complete round trip' */
  scopeNote?: string;
}) {
  const { isDark } = useTheme();
  const bonus = useLiveTransferBonus(result);
  const [open, setOpen]     = useState(false);
  const [pinned, setPinned] = useState(false);
  if (!bonus) return null;

  function close() { setOpen(false); setPinned(false); }
  function toggle() { if (pinned) { close(); } else { setPinned(true); setOpen(true); } }

  const surface = isDark
    ? 'bg-cv-amber-900 text-cv-amber-200 border-cv-amber-700'
    : 'bg-cv-amber-50 text-cv-amber-900 border-cv-amber-200';
  const iconCls = isDark ? 'border-cv-amber-200' : 'border-cv-amber-700';

  const headline = bonus.bonus_pct != null
    ? `${bonus.bonus_pct}% transfer bonus to ${bonus.transfer_partner}`
    : `${bonus.min_transfer_points}+ pts to ${bonus.transfer_partner}`;

  return (
    <div className={`relative flex flex-wrap items-center gap-x-2.5 gap-y-1 px-5 py-2.5 border-b ${rounded ? 'rounded-t-xl' : ''} ${surface}`}>
      <span className="text-sm font-semibold">
        {headline} through {formatBonusEndDate(bonus.end_date)} · {scopeNote}
      </span>

      <span className="text-[10px] font-bold font-mono tracking-widest uppercase px-1.5 py-0.5 rounded whitespace-nowrap bg-cv-amber-400 text-cv-amber-900">
        Limited time
      </span>

      {bonus.for_status_transfer && (
        <span className={`text-[10px] font-bold font-mono tracking-widest uppercase px-1.5 py-0.5 rounded border whitespace-nowrap ${iconCls}`}>
          Status boost
        </span>
      )}

      <span
        className="relative flex items-center shrink-0"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => { if (!pinned) setOpen(false); }}
      >
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); toggle(); }}
          aria-label="View transfer bonus details"
          className="flex items-center justify-center min-h-11 min-w-11 -my-4 shrink-0"
        >
          <span className={`flex items-center justify-center w-4 h-4 rounded-full border text-[10px] leading-none ${iconCls}`}>i</span>
        </button>

        {open && (
          <div className="absolute left-full top-1/2 -translate-y-1/2 pl-1.5 z-50">
            <div className={`w-72 rounded-lg border shadow-lg px-3 py-2 text-xs font-normal leading-relaxed whitespace-normal ${
              isDark ? 'border-gph-dark-line bg-gph-dark-card text-gph-dark-ink' : 'border-gray-200 bg-white text-gray-900'
            }`}>
              Transfer from {ISSUER_LOYALTY_NAME[bonus.issuer]} to {bonus.transfer_partner} · Ends {formatBonusEndDate(bonus.end_date)}
            </div>
          </div>
        )}
      </span>
    </div>
  );
}
