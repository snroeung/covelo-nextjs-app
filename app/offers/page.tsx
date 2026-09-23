'use client';

import { Suspense, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { NavBar } from '@/components/NavBar';
import { Footer } from '@/components/Footer';
import { OfferRow } from '@/components/discover/OfferRow';
import { DiscoverOfferModal } from '@/components/discover/DiscoverOfferModal';
import { useTheme } from '@/contexts/ThemeContext';
import { trpc } from '@/lib/trpc-client';
import { ISSUER_LABELS, sortByValueThenRecency } from '@/lib/discover/offerCopy';
import type { TransferBonus, SpendingBonus, Issuer } from '@/lib/types/offers';

type Offer = TransferBonus | SpendingBonus;
type IssuerFilter = Issuer | 'all';

const ISSUER_FILTERS: IssuerFilter[] = ['all', 'chase', 'amex', 'c1', 'bilt', 'citi'];

function OffersPageInner() {
  const { isDark } = useTheme();
  const [issuerFilter, setIssuerFilter] = useState<IssuerFilter>('all');
  const [openOffer, setOpenOffer] = useState<Offer | null>(null);

  const { data: transferBonuses = [], isLoading: loadingTransfer } = useQuery({
    queryKey: ['offers.transferBonuses'],
    queryFn:  () => trpc.offers.listTransferBonuses.query(),
  });

  const { data: spendingBonuses = [], isLoading: loadingSpending } = useQuery({
    queryKey: ['offers.spendingBonuses'],
    queryFn:  () => trpc.offers.listSpendingBonuses.query(),
  });

  const isLoading = loadingTransfer || loadingSpending;

  const allOffers: Offer[] = useMemo(
    () => [...transferBonuses, ...spendingBonuses].sort(sortByValueThenRecency),
    [transferBonuses, spendingBonuses],
  );

  const visibleOffers = issuerFilter === 'all'
    ? allOffers
    : allOffers.filter((o) => o.issuer === issuerFilter);

  function pillCls(active: boolean) {
    const base = 'shrink-0 px-3.5 py-2 rounded-full text-xs font-bold transition-colors min-h-11 flex items-center';
    if (active) return isDark
      ? `${base} bg-gph-dark-action text-gph-dark-bg`
      : `${base} bg-gph-action text-white`;
    return isDark
      ? `${base} bg-gph-dark-card border border-gph-dark-line text-gph-dark-ink hover:bg-gph-dark-linesoft`
      : `${base} bg-gph-card border border-gph-line text-gph-ink hover:bg-gph-linesoft`;
  }

  return (
    <div className="flex flex-col min-h-screen bg-gph-bg">
      <NavBar />

      <main className="flex-1">
        <div className="px-4 md:px-7 py-5 max-w-3xl mx-auto flex flex-col gap-5 border-b bg-gph-card border-gph-line">
          <h1 className="text-3xl md:text-4xl font-extrabold leading-none tracking-tight text-gph-ink">
            All offers<span className="text-gph-action">.</span>
          </h1>

          <div className="flex gap-2 overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0" style={{ WebkitOverflowScrolling: 'touch' }}>
            {ISSUER_FILTERS.map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setIssuerFilter(f)}
                className={pillCls(issuerFilter === f)}
              >
                {f === 'all' ? 'All' : ISSUER_LABELS[f]}
              </button>
            ))}
          </div>
        </div>

        <div className="px-4 md:px-7 py-5 max-w-3xl mx-auto">
          {isLoading ? (
            <div className="flex flex-col gap-3 animate-pulse py-2">
              <div className={`h-3 w-full rounded ${isDark ? 'bg-gph-dark-line' : 'bg-gph-line'}`} />
              <div className={`h-3 w-5/6 rounded ${isDark ? 'bg-gph-dark-line' : 'bg-gph-line'}`} />
              <div className={`h-3 w-2/3 rounded ${isDark ? 'bg-gph-dark-line' : 'bg-gph-line'}`} />
            </div>
          ) : visibleOffers.length === 0 ? (
            <p className="text-sm py-6 text-gph-muted">No offers match this filter right now.</p>
          ) : (
            <div>
              <div className="pb-2 mb-1 border-b-[1.5px] text-[10px] font-mono font-extrabold tracking-[0.14em] border-gph-ink text-gph-muted">
                {visibleOffers.length} OFFER{visibleOffers.length === 1 ? '' : 'S'}
              </div>
              {visibleOffers.map((offer) => (
                <OfferRow key={offer.id} offer={offer} onOpen={setOpenOffer} />
              ))}
            </div>
          )}
        </div>
      </main>
      <Footer />

      {openOffer && (
        <DiscoverOfferModal offer={openOffer} isDark={isDark} onClose={() => setOpenOffer(null)} />
      )}
    </div>
  );
}

export default function OffersPage() {
  return (
    <Suspense>
      <OffersPageInner />
    </Suspense>
  );
}
