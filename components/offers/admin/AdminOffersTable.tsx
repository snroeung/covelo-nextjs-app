'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { trpc } from '@/lib/trpc-client';
import type { TransferBonus, SpendingBonus, OfferStatus } from '@/lib/types/offers';

const ISSUER_LABELS: Record<string, string> = {
  chase: 'Chase', amex: 'Amex', c1: 'Capital One', bilt: 'Bilt', citi: 'Citi',
};

type AnyOffer = (TransferBonus & { _type: 'transfer' }) | (SpendingBonus & { _type: 'spending' });

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' });
}

const STATUS_STYLES: Record<OfferStatus, { dot: string; label: string; cls: string }> = {
  admin:    { dot: 'bg-blue-500',   label: 'Admin',    cls: 'bg-blue-100 text-blue-700' },
  approved: { dot: 'bg-green-500',  label: 'Approved', cls: 'bg-green-100 text-green-700' },
  pending:  { dot: 'bg-amber-500',  label: 'Pending',  cls: 'bg-amber-100 text-amber-700' },
  rejected: { dot: 'bg-red-500',    label: 'Rejected', cls: 'bg-red-100 text-red-700' },
};

function StatusPill({ status }: { status: OfferStatus }) {
  const s = STATUS_STYLES[status] ?? STATUS_STYLES.pending;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${s.cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
}

export function isExpired(o: { end_date: string | null }) {
  return !!o.end_date && o.end_date < new Date().toISOString().split('T')[0];
}

interface Props {
  transferBonuses: TransferBonus[];
  spendingBonuses: SpendingBonus[];
  filter: OfferStatus | 'all' | 'expired';
  isDark: boolean;
  onEdit: (offer: AnyOffer) => void;
}

export function AdminOffersTable({ transferBonuses, spendingBonuses, filter, isDark, onEdit }: Props) {
  const queryClient = useQueryClient();

  const { mutate: updateStatus, isPending } = useMutation({
    mutationFn: (args: { id: string; table: 'transfer_bonuses' | 'spending_bonuses'; status: OfferStatus }) =>
      trpc.offers.admin.updateStatus.mutate(args),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['offers.admin.listAll'] }),
  });

  const card   = isDark ? 'bg-gph-dark-card border-gph-dark-line' : 'bg-white border-gray-200';
  const ink    = isDark ? 'text-gph-dark-ink'   : 'text-gray-900';
  const muted  = isDark ? 'text-gph-dark-muted' : 'text-gray-500';
  const rowHov = isDark ? 'hover:bg-white/5' : 'hover:bg-gray-50';
  const divider = isDark ? 'border-gph-dark-line' : 'border-gray-100';
  const headBg  = isDark ? 'bg-gph-dark-bg' : 'bg-gray-50';

  const allOffers: AnyOffer[] = [
    ...transferBonuses.map((o) => ({ ...o, _type: 'transfer' as const })),
    ...spendingBonuses.map((o) => ({ ...o, _type: 'spending' as const })),
  ].filter((o) =>
    filter === 'all' ? true :
    filter === 'expired' ? isExpired(o) :
    o.status === filter)
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
                {ISSUER_LABELS[offer.issuer] ?? offer.issuer} → {partnerLabel}
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
              <StatusPill status={offer.status} />
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => onEdit(offer)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-colors ${
                  isDark
                    ? 'bg-gph-dark-linesoft text-gph-dark-ink hover:bg-white/10'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Edit
              </button>
              {offer.status === 'pending' && (
                <>
                  <button
                    disabled={isPending}
                    onClick={() => updateStatus({ id: offer.id, table, status: 'approved' })}
                    className="px-2.5 py-1 rounded-md text-[11px] font-bold bg-green-100 text-green-700 hover:bg-green-200 transition-colors disabled:opacity-50"
                  >
                    Approve
                  </button>
                  <button
                    disabled={isPending}
                    onClick={() => updateStatus({ id: offer.id, table, status: 'rejected' })}
                    className="px-2.5 py-1 rounded-md text-[11px] font-bold bg-red-100 text-red-700 hover:bg-red-200 transition-colors disabled:opacity-50"
                  >
                    Reject
                  </button>
                </>
              )}
              {(offer.status === 'approved' || offer.status === 'admin') && (
                <button
                  disabled={isPending}
                  onClick={() => updateStatus({ id: offer.id, table, status: 'rejected' })}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-colors disabled:opacity-50 ${
                    isDark ? 'bg-gph-dark-linesoft text-gph-dark-muted hover:text-gph-dark-ink' : 'bg-gray-100 text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Revoke
                </button>
              )}
              {offer.status === 'rejected' && (
                <button
                  disabled={isPending}
                  onClick={() => updateStatus({ id: offer.id, table, status: 'approved' })}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-colors disabled:opacity-50 ${
                    isDark ? 'bg-gph-dark-linesoft text-gph-dark-muted hover:text-gph-dark-ink' : 'bg-gray-100 text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Re-approve
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
