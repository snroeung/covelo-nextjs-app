'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useIsOfferSaved, useToggleSavedOffer } from '@/hooks/useSavedOffers';
import { useRequireSignIn } from '@/hooks/useBoard';
import { btn } from '@/components/ui/button';
import type { SpendingBonus, TransferBonus } from '@/lib/types/offers';

type Offer = TransferBonus | SpendingBonus;

export function BookmarkIcon({ filled, size = 14 }: { filled: boolean; size?: number }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 3h12v18l-6-4-6 4Z" />
    </svg>
  );
}

interface Props {
  offer: Offer;
  /** `icon`: a bookmark on a list row. `full`: a labelled button (the offer's detail view). */
  variant?: 'icon' | 'full';
}

/**
 * Save an offer for later. Members only: a visitor gets the sign-in prompt
 * instead, and the server refuses a save without a session either way.
 */
export function SaveOfferButton({ offer, variant = 'icon' }: Props) {
  const { user, loading } = useAuth();
  const saved = useIsOfferSaved(offer);
  const toggle = useToggleSavedOffer();
  const requireSignIn = useRequireSignIn();
  const full = variant === 'full';
  const cls = full ? btn('secondary') : btn('quiet', 'icon', 'shrink-0');

  // A visitor gets the same "sign in" prompt as saving a board post
  if (!user && !loading) {
    return (
      <button type="button" aria-label="Save offer" title="Sign in to save offers" onClick={(e) => { e.stopPropagation(); requireSignIn(() => {}, 'save offers'); }} className={cls}>
        <BookmarkIcon filled={false} />
        {full && 'Save offer'}
      </button>
    );
  }

  const failure = toggle.isError ? (toggle.error instanceof Error ? toggle.error.message : 'Couldn’t save that offer.') : null;
  return (
    <>
      <button
        type="button"
        aria-pressed={saved}
        aria-label={saved ? 'Remove from saved offers' : 'Save offer'}
        title={failure ?? (saved ? 'Saved — click to remove' : 'Save for later')}
        disabled={loading || toggle.isPending}
        onClick={(e) => { e.stopPropagation(); toggle.mutate({ offer, saved: !saved }); }}
        className={cls}
      >
        <BookmarkIcon filled={saved} />
        {full && (saved ? 'Saved' : 'Save offer')}
      </button>
      {failure && <span role="alert" className="sr-only">{failure}</span>}
    </>
  );
}
