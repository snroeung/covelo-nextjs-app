'use client';

import { useState } from 'react';
import { useLiveTransferBonus, formatBonusEndDate, ISSUER_LOYALTY_NAME } from '@/lib/points/transferBonus';
import type { PointsResult } from '@/lib/points/types';

export function TransferBonusBanner({ result, rounded = true }: { result: PointsResult | null; rounded?: boolean }) {
  const bonus = useLiveTransferBonus(result);
  const [open, setOpen]     = useState(false);
  const [pinned, setPinned] = useState(false);
  if (!bonus) return null;

  function close() { setOpen(false); setPinned(false); }
  function toggle() { if (pinned) { close(); } else { setPinned(true); setOpen(true); } }

  return (
    <div className={`relative flex flex-wrap items-center gap-x-3 gap-y-1 pl-3 pr-4 py-2 ${rounded ? 'rounded-t-xl' : ''} bg-linear-to-r from-cv-navy-900 via-cv-navy-900 to-cv-blue-900 border-b-2 border-cv-amber-400`}>
      <span className="flex items-center justify-center w-5 h-5 rounded shrink-0 bg-cv-amber-400 text-cv-navy-900 text-[11px] font-extrabold leading-none">⚡</span>

      <span className="text-[10px] font-bold font-mono tracking-widest uppercase text-white whitespace-nowrap">
        +{bonus.bonus_pct}% to {bonus.transfer_partner}
      </span>

      <span className="text-[10px] font-bold font-mono tracking-widest uppercase px-1.5 py-0.5 rounded bg-cv-amber-400 text-cv-amber-900 whitespace-nowrap">
        Limited time
      </span>

      <span className="hidden sm:inline-block w-1 h-1 rounded-full bg-cv-navy-400 shrink-0" />

      <span
        className="relative flex items-center shrink-0"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => { if (!pinned) setOpen(false); }}
      >
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); toggle(); }}
          aria-label="View transfer bonus details"
          className="flex items-center justify-center min-h-11 min-w-11 -my-3.5 shrink-0"
        >
          <span className="flex items-center justify-center w-4 h-4 rounded-full border border-white/70 text-[10px] leading-none text-white">i</span>
        </button>

        {open && (
          <div className="absolute left-full top-1/2 -translate-y-1/2 pl-1.5 z-50">
            <div className="w-72 rounded-lg border border-gray-200 bg-white text-gray-900 shadow-lg px-3 py-2 text-xs font-normal leading-relaxed whitespace-normal">
              Transfer from {ISSUER_LOYALTY_NAME[bonus.issuer]} to {bonus.transfer_partner} · Ends {formatBonusEndDate(bonus.end_date)}
            </div>
          </div>
        )}
      </span>
    </div>
  );
}
