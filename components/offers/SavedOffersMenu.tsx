'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useSavedOffers, useToggleSavedOffer } from '@/hooks/useSavedOffers';
import { useRequireSignIn } from '@/hooks/useBoard';
import { buildStoryCopy, isTransfer } from '@/lib/discover/offerCopy';
import { describeError } from '@/lib/board/errors';
import { btn } from '@/components/ui/button';
import { SavedPopover } from '@/components/ui/SavedPopover';
import type { SpendingBonus, TransferBonus } from '@/lib/types/offers';
import { BookmarkIcon } from './SaveOfferButton';

type Offer = TransferBonus | SpendingBonus;

/**
 * "Saved offers": the member's saved offers that are still live, in a list that
 * opens from a button. Picking one opens it in the page's own offer view. A
 * visitor gets the same "sign in" prompt as the board's saved posts.
 */
export function SavedOffersMenu({ onOpen }: { onOpen: (offer: Offer) => void }) {
  const { user } = useAuth();
  const requireSignIn = useRequireSignIn();
  const saved = useSavedOffers();
  const count = user ? saved.data?.length : undefined;
  return (
    <SavedPopover
      label="Saved offers"
      suffix={count ? <span className="font-mono">· {count}</span> : null}
      icon={(open) => <BookmarkIcon filled={open} size={13} />}
      beforeOpen={(open) => requireSignIn(open, 'see your saved offers')}
    >
      {(close) => <SavedList onOpen={(o) => { close(); onOpen(o); }} />}
    </SavedPopover>
  );
}

function SavedList({ onOpen }: { onOpen: (offer: Offer) => void }) {
  const saved = useSavedOffers();
  const toggle = useToggleSavedOffer();

  if (saved.isPending) {
    return (
      <ul aria-busy="true" aria-label="Loading saved offers" className="flex flex-col gap-1 px-1 pb-1">
        {[0, 1, 2].map((i) => <li key={i} className="h-14 animate-pulse rounded-lg bg-gph-linesoft" />)}
      </ul>
    );
  }
  if (saved.isError) {
    return (
      <div role="alert" className="px-3 py-5 text-center text-[13px] text-gph-muted">
        <p className="mb-2">{describeError(saved.error).message}</p>
        <button type="button" onClick={() => saved.refetch()} className={btn('secondary')}>Try again</button>
      </div>
    );
  }
  const offers = saved.data ?? [];
  if (offers.length === 0) {
    return (
      <p className="px-3 py-6 text-center text-[13px] leading-relaxed text-gph-muted">
        Nothing saved yet. Tap the bookmark on an offer to keep it here. Offers drop off this list when they end.
      </p>
    );
  }

  return (
    <ul className="flex flex-col">
      {offers.map((offer) => {
        const copy = buildStoryCopy(offer);
        return (
          <li key={offer.id} className="flex items-stretch gap-1 rounded-lg hover:bg-gph-linesoft">
            <button type="button" onClick={() => onOpen(offer)} className="min-w-0 flex-1 rounded-lg px-2.5 py-2 text-left focus-visible:outline-2 focus-visible:outline-gph-ink">
              <span className="flex items-baseline justify-between gap-2">
                <span className="font-mono text-[10px] font-extrabold tracking-[0.12em] text-gph-action">{copy.cat}</span>
                {!isTransfer(offer) && <span className="font-mono text-[13px] font-extrabold text-gph-ink">{copy.value}</span>}
              </span>
              <span className="mt-0.5 line-clamp-2 block text-[13.5px] font-bold leading-snug text-gph-ink">{copy.headline}</span>
              <span className="mt-1 block font-mono text-[10px] font-extrabold tracking-[0.1em] text-gph-muted">{copy.time}</span>
            </button>
            <button
              type="button"
              onClick={() => toggle.mutate({ offer, saved: false })}
              aria-label={`Remove “${copy.headline}” from saved offers`}
              className={btn('quiet', 'icon', 'shrink-0')}
            >
              <BookmarkIcon filled />
            </button>
          </li>
        );
      })}
    </ul>
  );
}
