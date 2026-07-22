'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { trpc } from '@/lib/trpc-client';
import type { TransferBonus, SpendingBonus } from '@/lib/types/offers';
import { adminTableTheme, usePendingApproval, PendingRowActions } from './adminTableShared';

const ISSUER_LABELS: Record<string, string> = {
  chase: 'Chase', amex: 'Amex', c1: 'Capital One', bilt: 'Bilt', citi: 'Citi',
};

type AnyOffer = (TransferBonus & { _type: 'transfer' }) | (SpendingBonus & { _type: 'spending' });
export type OfferStatusFilter = 'all' | 'live' | 'scheduled' | 'expired' | 'paused';

function formatDate(iso: string) {
  // Parse as local calendar date, not UTC — see OfferCard.tsx formatEndDate.
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' });
}

export function isExpired(o: { end_date: string | null }) {
  return !!o.end_date && o.end_date < new Date().toISOString().split('T')[0];
}

// Mirrors adStatus() in AdminAdsTable.tsx — same active/date-derived status set.
export function offerStatus(o: { active: boolean; start_date: string | null; end_date: string | null }): 'live' | 'scheduled' | 'expired' | 'paused' {
  if (!o.active) return 'paused';
  const today = new Date().toISOString().split('T')[0];
  if (o.start_date && o.start_date > today) return 'scheduled';
  if (isExpired(o)) return 'expired';
  return 'live';
}

interface Props {
  transferBonuses: TransferBonus[];
  spendingBonuses: SpendingBonus[];
  filter: OfferStatusFilter;
  isDark: boolean;
  onEdit: (offer: AnyOffer) => void;
}

export function AdminOffersTable({ transferBonuses, spendingBonuses, filter, isDark, onEdit }: Props) {
  const queryClient = useQueryClient();

  const { mutate: updateActive, isPending: isToggling } = useMutation({
    mutationFn: (args: { id: string; table: 'transfer_bonuses' | 'spending_bonuses'; active: boolean }) =>
      trpc.offers.admin.updateActive.mutate(args),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['offers.admin.listAll'] }),
  });

  const { approve, reject, approving, rejecting } = usePendingApproval([['offers.admin.listAll']]);
  const isPending = isToggling || approving || rejecting;

  const { card, ink, muted, rowHov, divider, headBg } = adminTableTheme(isDark);

  const allOffers: AnyOffer[] = [
    ...transferBonuses.map((o) => ({ ...o, _type: 'transfer' as const })),
    ...spendingBonuses.map((o) => ({ ...o, _type: 'spending' as const })),
  ].filter((o) => filter === 'all' ? true : offerStatus(o) === filter)
   .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  return (
    <div className={`rounded-xl border overflow-hidden ${card}`}>
      {/* Table header */}
      <div className={`grid grid-cols-[1fr_auto_auto_auto_auto] gap-4 px-5 py-3 border-b text-[10px] font-mono font-bold tracking-widest ${muted} ${headBg} ${divider}`}>
        <div>OFFER</div>
        <div>TYPE</div>
        <div>ENDS</div>
        <div>STATUS</div>
        <div>ACTIONS</div>
      </div>

      {allOffers.length === 0 && (
        <p className={`px-5 py-8 text-sm text-center ${muted}`}>No offers in this category.</p>
      )}

      {allOffers.map((offer, i) => {
        const isTransfer = offer._type === 'transfer';
        const table = isTransfer ? 'transfer_bonuses' as const : 'spending_bonuses' as const;

        const sp = offer as SpendingBonus;
        const bonusLabel = isTransfer
          ? `+${(offer as TransferBonus).bonus_pct}%`
          : sp.bonus_type === 'dollar_amount'
            ? `$${sp.bonus_multiplier} credit`
            : sp.bonus_type === 'cash_back_pct'
              ? `${sp.bonus_multiplier}% cash back`
              : `${sp.bonus_multiplier}×`;
        const spendMin = !isTransfer && sp.spending_minimum
          ? ` · min. $${sp.spending_minimum}`
          : '';

        const partnerLabel = isTransfer
          ? (offer as TransferBonus).transfer_partner
          : (offer as SpendingBonus).merchant_name;
        const offerLabel = `${ISSUER_LABELS[offer.issuer] ?? offer.issuer} → ${partnerLabel}`;

        return (
          <div
            key={offer.id}
            className={`grid grid-cols-[1fr_auto_auto_auto_auto] gap-4 items-center px-5 py-4 transition-colors ${rowHov} ${
              i < allOffers.length - 1 ? `border-b ${divider}` : ''
            }`}
          >
            {/* Offer info */}
            <div>
              <div className={`text-sm font-semibold ${ink}`}>
                {offerLabel}
              </div>
              <div className={`text-[11px] font-mono mt-0.5 ${muted}`}>
                {bonusLabel}{spendMin} · {offer.upvotes} upvotes · {offer.country ?? 'US'}
                {offer.is_targeted && <span className="ml-2 text-amber-500">TARGETED</span>}
              </div>
            </div>

            {/* Type */}
            <div className={`text-[10px] font-mono font-bold shrink-0 ${muted}`}>
              {isTransfer ? 'TRANSFER' : 'SPENDING'}
            </div>

            {/* End date */}
            <div className={`text-[11px] font-mono shrink-0 ${muted}`}>
              {formatDate(offer.end_date)}
            </div>

            {/* Status */}
            <div className="shrink-0">
              {offer.status === 'pending' ? (
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                  isDark ? 'bg-amber-900/40 text-amber-400' : 'bg-amber-50 text-amber-700'
                }`}>
                  Pending
                </span>
              ) : (() => {
                const s = offerStatus(offer);
                const cls =
                  s === 'live'      ? 'bg-green-100 text-green-700' :
                  s === 'scheduled' ? 'bg-blue-100 text-blue-700' :
                  s === 'expired'   ? 'bg-red-100 text-red-600' :
                  isDark ? 'bg-gph-dark-linesoft text-gph-dark-muted' : 'bg-gray-100 text-gray-500';
                const dot =
                  s === 'live'      ? 'bg-green-500' :
                  s === 'scheduled' ? 'bg-blue-500' :
                  s === 'expired'   ? 'bg-red-400' :
                  'bg-gray-400';
                const label = s === 'live' ? 'Live' : s === 'scheduled' ? 'Scheduled' : s === 'expired' ? 'Expired' : 'Paused';
                return (
                  <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${cls}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
                    {label}
                  </span>
                );
              })()}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 shrink-0">
              <PendingRowActions
                isDark={isDark}
                pending={offer.status === 'pending'}
                disabled={isPending}
                itemLabel={offerLabel}
                onApprove={() => approve({ id: offer.id, table })}
                onReject={() => reject({ id: offer.id, table })}
                onEdit={() => onEdit(offer)}
                active={offer.active}
                onToggleActive={(next) => updateActive({ id: offer.id, table, active: next })}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
