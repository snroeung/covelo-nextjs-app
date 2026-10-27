'use client';

import Link from 'next/link';
import type { BoardOffer } from '@/lib/board/types';
import { BTN_GHOST, BTN_PRIMARY } from '@/components/ui/button';
import { Dialog, DialogBody, DialogFooter } from '@/components/board/shared/Dialog';
import { BoardIcon } from '@/components/board/shared/icons';

const isHttp = (url: string | null): url is string => !!url && /^https?:\/\//i.test(url);

export function OfferModal({ offer, onClose }: { offer: BoardOffer; onClose: () => void }) {
  const rows = [
    ['From', offer.from],
    ['To', offer.to],
    ['Details', offer.detail],
    ['Ends', offer.ends && `${offer.ends}${offer.endsIn && offer.endsIn !== offer.ends ? ` · ${offer.endsIn}` : ''}`],
  ].filter((r): r is [string, string] => !!r[1]);

  return (
    <Dialog label={offer.title} onClose={onClose} width="sm">
      {/* Always dark, like the other offer headers — the lime value is built for it */}
      <div className="relative bg-gph-navy px-5 pb-5 pt-4 text-[#f3f3f1]">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-1 top-1 grid min-h-11 min-w-11 place-items-center rounded-full text-[#a1a1a6] hover:text-white focus-visible:outline-2 focus-visible:outline-white"
        >
          <BoardIcon name="x" size={16} />
        </button>
        <div className="mb-3.5 pr-10 font-mono text-[10px] font-extrabold tracking-[0.12em] text-[#a1a1a6]">
          {offer.source === 'member' ? 'MEMBER-SUBMITTED OFFER' : 'COVELO OFFER'} · {offer.type}
        </div>
        <div className="font-mono text-[44px] font-extrabold leading-none tracking-tighter text-[#84cc16]">{offer.value}</div>
        <h2 className="mt-3 text-lg font-extrabold leading-snug tracking-tight" style={{ textWrap: 'pretty' }}>{offer.title}</h2>
      </div>

      <DialogBody className="py-1.5">
        <dl>
          {rows.map(([k, v]) => (
            <div key={k} className="grid grid-cols-[84px_minmax(0,1fr)] gap-3 border-b border-gph-linesoft py-2.5 text-[13px]">
              <dt className="pt-0.5 font-mono text-[9.5px] font-extrabold tracking-[0.12em] text-gph-muted">{k.toUpperCase()}</dt>
              <dd className="font-semibold">{v}</dd>
            </div>
          ))}
        </dl>
        {offer.terms && <p className="my-3 text-xs leading-relaxed text-gph-muted">{offer.terms}</p>}
        {offer.source === 'member' && (
          <p className="my-3 text-xs leading-relaxed text-gph-muted">
            A member created this offer. It isn&apos;t in covelo&apos;s offer catalog yet — an admin will review it.
          </p>
        )}
      </DialogBody>

      <DialogFooter>
        <button type="button" onClick={onClose} className={BTN_GHOST}>Close</button>
        {offer.source === 'member' ? (
          isHttp(offer.url) && (
            <a href={offer.url} target="_blank" rel="noopener noreferrer" className={BTN_PRIMARY}>
              Open source <BoardIcon name="ext" size={12} />
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
          )
        ) : (
          <Link href="/offers" className={BTN_PRIMARY}>
            See all offers <BoardIcon name="ext" size={12} />
          </Link>
        )}
      </DialogFooter>
    </Dialog>
  );
}
