'use client';

import { Suspense, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { NavBar } from '@/components/NavBar';
import { Footer } from '@/components/Footer';
import { OfferRow } from '@/components/discover/OfferRow';
import { DiscoverOfferModal } from '@/components/discover/DiscoverOfferModal';
import { FilterDropdown, type FilterDropdownOption } from '@/components/discover/FilterDropdown';
import { useTheme } from '@/contexts/ThemeContext';
import { trpc } from '@/lib/trpc-client';
import { ISSUER_LABELS, isTransfer, sortByValueThenRecency } from '@/lib/discover/offerCopy';
import type { TransferBonus, SpendingBonus, Issuer } from '@/lib/types/offers';

type Offer = TransferBonus | SpendingBonus;
type IssuerFilter = Issuer | 'all';
type TypeFilter = 'all' | 'transfer' | 'spending';

const ISSUER_FILTERS: IssuerFilter[] = ['all', 'chase', 'amex', 'c1', 'bilt', 'citi'];

const ISSUER_OPTIONS: FilterDropdownOption<IssuerFilter>[] = ISSUER_FILTERS.map((f) => ({
  value: f,
  label: f === 'all' ? 'All' : ISSUER_LABELS[f],
}));

const TYPE_OPTIONS: FilterDropdownOption<TypeFilter>[] = [
  { value: 'all', label: 'All' },
  { value: 'transfer', label: 'Transfer bonus' },
  { value: 'spending', label: 'Spending bonus' },
];

function OffersPageInner() {
  const { isDark } = useTheme();
  const [issuerFilter, setIssuerFilter] = useState<IssuerFilter>('all');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
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

  const visibleOffers = allOffers
    .filter((o) => issuerFilter === 'all' || o.issuer === issuerFilter)
    .filter((o) => typeFilter === 'all' || (typeFilter === 'transfer') === isTransfer(o));

  return (
    <div className="flex flex-col min-h-screen bg-gph-bg">
      <NavBar />

      <main className="flex-1">
        <div className="max-w-3xl mx-auto mt-6 mb-8 rounded-xl border bg-gph-card border-gph-line">
          <div className="px-4 md:px-7 py-5 flex flex-col gap-5 border-b border-gph-line">
            <h1 className="text-3xl md:text-4xl font-extrabold leading-none tracking-tight text-gph-ink">
              All offers<span className="text-gph-action">.</span>
            </h1>

            <div className="flex flex-wrap gap-2">
              <FilterDropdown label="Card" options={ISSUER_OPTIONS} value={issuerFilter} onChange={setIssuerFilter} />
              <FilterDropdown label="Type" options={TYPE_OPTIONS} value={typeFilter} onChange={setTypeFilter} />
            </div>
          </div>

          <div className="px-4 md:px-7 py-5">
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
