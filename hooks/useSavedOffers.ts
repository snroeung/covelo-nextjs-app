'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { trpc } from '@/lib/trpc-client';
import { useAuth } from '@/contexts/AuthContext';
import { isTransfer } from '@/lib/discover/offerCopy';
import { refreshAfterWrite } from '@/lib/refreshAfterWrite';
import type { SpendingBonus, TransferBonus } from '@/lib/types/offers';

type Offer = TransferBonus | SpendingBonus;

const SAVED_ROOT = ['offers.saved'] as const;
export const savedOffersKey = (userId: string | null) => ['offers.saved', userId] as const;

export const offerTable = (offer: Offer) => (isTransfer(offer) ? 'transfer_bonuses' : 'spending_bonuses') as 'transfer_bonuses' | 'spending_bonuses';

/**
 * The signed-in member's saved offers that are still live (the server drops
 * ended ones). Also tells every offer card whether it is saved. Never runs for
 * a visitor: saving needs an account.
 */
export function useSavedOffers() {
  const { user } = useAuth();
  return useQuery({
    queryKey: savedOffersKey(user?.id ?? null),
    queryFn: () => trpc.offers.saved.query(),
    enabled: !!user,
    staleTime: 15_000,
  });
}

export function useIsOfferSaved(offer: Offer): boolean {
  const saved = useSavedOffers();
  return !!saved.data?.some((o) => o.id === offer.id);
}

/** Save or unsave. The card flips at once and rolls back if the server says no. */
export function useToggleSavedOffer() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const key = savedOffersKey(user?.id ?? null);
  return useMutation({
    mutationFn: (v: { offer: Offer; saved: boolean }) =>
      trpc.offers.save.mutate({ table: offerTable(v.offer), id: v.offer.id, saved: v.saved }),
    onMutate: async (v) => {
      await qc.cancelQueries({ queryKey: SAVED_ROOT });
      const previous = qc.getQueryData<Offer[]>(key);
      qc.setQueryData<Offer[]>(key, (list = []) => (v.saved ? [v.offer, ...list.filter((o) => o.id !== v.offer.id)] : list.filter((o) => o.id !== v.offer.id)));
      return { previous };
    },
    onError: (_err, _v, ctx) => qc.setQueryData(key, ctx?.previous),
    // The list can be opened and fetched before the write lands: refetch after it (see refreshAfterWrite)
    onSettled: () => refreshAfterWrite(qc, SAVED_ROOT),
  });
}
