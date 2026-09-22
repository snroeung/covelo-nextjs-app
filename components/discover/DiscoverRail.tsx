'use client';

import type { TransferBonus, SpendingBonus } from '@/lib/types/offers';
import { buildStoryCopy } from '@/lib/discover/offerCopy';

type Offer = TransferBonus | SpendingBonus;

interface Props {
  offers: Offer[];
  isDark: boolean;
  expanded: boolean;
  onToggle: () => void;
  onOpen: (offer: Offer) => void;
}

const COLLAPSED_COUNT = 3;

export function DiscoverRail({ offers, isDark, expanded, onToggle, onOpen }: Props) {
  const line   = isDark ? 'border-gph-dark-line' : 'border-gph-line';
  const rule   = isDark ? 'border-gph-dark-ink'  : 'border-gph-ink';
  const ink    = isDark ? 'text-gph-dark-ink'    : 'text-gph-ink';
  const muted  = isDark ? 'text-gph-dark-muted'  : 'text-gph-muted';
  const accent = isDark ? 'text-gph-dark-action' : 'text-gph-action';
  const ghostCls = isDark
    ? 'bg-gph-dark-card border border-gph-dark-line text-gph-dark-ink hover:bg-gph-dark-linesoft'
    : 'bg-gph-card border border-gph-line text-gph-ink hover:bg-gph-linesoft';

  const visible = expanded ? offers : offers.slice(0, COLLAPSED_COUNT);
  const hasMore = offers.length > COLLAPSED_COUNT;

  if (offers.length === 0) return null;

  return (
    <div>
      <div className={`pb-2 mb-1 border-b-[1.5px] text-[10px] font-mono font-extrabold tracking-[0.14em] ${rule} ${muted}`}>
        MORE OFFERS
      </div>
      {visible.map((offer) => {
        const copy = buildStoryCopy(offer);
        return (
          <div
            key={offer.id}
            role="button"
            tabIndex={0}
            onClick={() => onOpen(offer)}
            onKeyDown={(e) => e.key === 'Enter' && onOpen(offer)}
            className={`py-3 border-b cursor-pointer transition-transform hover:translate-x-1 ${line}`}
          >
            <div className="flex items-baseline justify-between gap-2 mb-1.5">
              <span className={`text-[10px] font-mono font-extrabold tracking-[0.14em] ${accent}`}>{copy.cat}</span>
              <span className={`text-sm font-mono font-extrabold tracking-tight ${ink}`}>{copy.value}</span>
            </div>
            <div className={`text-sm leading-snug font-bold tracking-tight ${ink}`} style={{ textWrap: 'pretty' }}>
              {copy.headline}
            </div>
            <div className={`mt-1.5 text-[9px] font-mono font-extrabold tracking-[0.1em] ${muted}`}>
              {copy.time}
            </div>
          </div>
        );
      })}
      {hasMore && !expanded && (
        <button
          type="button"
          onClick={onToggle}
          className={`flex items-center justify-center gap-1.5 w-full mt-4 px-4 py-2.5 rounded-md text-[11.5px] font-bold transition-colors min-h-11 ${ghostCls}`}
        >
          See all offers
          <svg className="w-2.5 h-2.5" viewBox="0 0 12 12" fill="none">
            <path d="M2 6h8M6.5 2.5L10 6l-3.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      )}
    </div>
  );
}
