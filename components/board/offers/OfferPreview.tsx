'use client';

import { useState } from 'react';
import type { BoardOffer } from '@/lib/board/types';
import { BoardIcon } from '@/components/board/shared/icons';
import { OfferModal } from './OfferModal';

/** The offer a post is about, as a card that opens its details. */
export function OfferPreview({ offer, compact = false }: { offer: BoardOffer; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const route = offer.from + (offer.to ? ` → ${offer.to}` : '');
  const meta = [route, offer.detail, offer.ends && `ends ${offer.ends}`].filter(Boolean).join(' · ');

  return (
    <>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen(true); }}
        aria-haspopup="dialog"
        className={`grid w-full min-h-11 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3.5 rounded-lg border border-gph-line bg-gph-bg text-left text-gph-ink transition-colors hover:border-gph-muted focus-visible:outline-2 focus-visible:outline-gph-ink ${
          compact ? 'px-3 py-2.5' : 'px-4 py-3.5'
        }`}
      >
        <span className={`border-r border-gph-line pr-3.5 font-mono font-extrabold leading-none tracking-tighter ${compact ? 'min-w-14 text-lg' : 'min-w-[72px] text-2xl'}`}>
          {offer.value}
        </span>
        <span className="min-w-0">
          <span className="mb-1 block font-mono text-[9px] font-extrabold tracking-[0.12em] text-gph-muted">
            {offer.type}{offer.source === 'member' ? ' · MEMBER-SUBMITTED' : ''}
          </span>
          <span className={`block text-[14px] font-bold leading-snug tracking-tight ${compact ? 'truncate' : ''}`}>{offer.title}</span>
          {!compact && <span className="mt-1.5 block font-mono text-[11px] font-semibold text-gph-muted">{meta}</span>}
        </span>
        <span className="inline-flex items-center gap-1 whitespace-nowrap text-[11px] font-bold">
          <span className={compact ? 'sr-only' : 'hidden sm:inline'}>View offer</span>
          <BoardIcon name="chev-r" size={12} />
        </span>
      </button>
      {open && <OfferModal offer={offer} onClose={() => setOpen(false)} />}
    </>
  );
}
