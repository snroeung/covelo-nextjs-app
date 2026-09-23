'use client';

import { Suspense, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { NavBar } from '@/components/NavBar';
import { Footer } from '@/components/Footer';
import { DiscoverMasthead } from '@/components/discover/DiscoverMasthead';
import { DiscoverLead } from '@/components/discover/DiscoverLead';
import { DiscoverSecondary } from '@/components/discover/DiscoverSecondary';
import { DiscoverRail } from '@/components/discover/DiscoverRail';
import { DiscoverCreatorBanner } from '@/components/discover/DiscoverCreatorBanner';
import { DiscoverBoardPromo } from '@/components/discover/DiscoverBoardPromo';
import { DiscoverOfferModal } from '@/components/discover/DiscoverOfferModal';
import { AffiliateAdSpot } from '@/components/offers/AffiliateAdSpot';
import { useTheme } from '@/contexts/ThemeContext';
import { trpc } from '@/lib/trpc-client';
import { sortByValueThenRecency } from '@/lib/discover/offerCopy';
import type { TransferBonus, SpendingBonus } from '@/lib/types/offers';

type Offer = TransferBonus | SpendingBonus;

function DiscoverPageInner() {
  const { isDark } = useTheme();
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

  // Pick the highest-bonus transfer as the lead story
  const featuredOffer = transferBonuses.length > 0
    ? [...transferBonuses].sort((a, b) => (b.bonus_pct ?? 0) - (a.bonus_pct ?? 0))[0]
    : null;

  const remainingTransfer = featuredOffer
    ? transferBonuses.filter((o) => o.id !== featuredOffer.id)
    : transferBonuses;

  const remainingPool: Offer[] = [...remainingTransfer, ...spendingBonuses].sort(sortByValueThenRecency);
  const secondaryOffers = remainingPool.slice(0, 2);
  const railOffers = remainingPool.slice(2);

  return (
    <div className="flex flex-col min-h-screen bg-gph-bg">
      <NavBar />

      <main className="flex-1">
        <div className="px-4 md:px-7 py-5 max-w-5xl mx-auto flex flex-col gap-7 border-b bg-gph-card border-gph-line">
          <DiscoverMasthead isDark={isDark} offerCount={remainingPool.length} />

          {isLoading ? (
            <div className="flex flex-col gap-3 animate-pulse py-2">
              <div className={`h-3 w-1/3 rounded ${isDark ? 'bg-gph-dark-line' : 'bg-gph-line'}`} />
              <div className={`h-8 w-2/3 rounded ${isDark ? 'bg-gph-dark-line' : 'bg-gph-line'}`} />
              <div className={`h-3 w-full rounded ${isDark ? 'bg-gph-dark-line' : 'bg-gph-line'}`} />
              <div className={`h-3 w-5/6 rounded ${isDark ? 'bg-gph-dark-line' : 'bg-gph-line'}`} />
            </div>
          ) : featuredOffer ? (
            <DiscoverLead offer={featuredOffer} isDark={isDark} onOpen={() => setOpenOffer(featuredOffer)} />
          ) : (
            <p className="text-sm py-6 text-gph-muted">No featured offer right now — check back soon.</p>
          )}

          {!isLoading && remainingPool.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_0.95fr] gap-6 md:gap-0 scroll-mt-6">
              <DiscoverSecondary offers={secondaryOffers} onOpen={setOpenOffer} />
              <DiscoverRail offers={railOffers} isDark={isDark} onOpen={setOpenOffer} />
            </div>
          )}
        </div>

        <div className="px-4 md:px-7 py-6 max-w-5xl mx-auto">
          <AffiliateAdSpot slot="below_grid" isDark={isDark} variant="editorial" />
        </div>

        <div className="px-4 md:px-7 pb-7 max-w-5xl mx-auto">
          <DiscoverCreatorBanner isDark={isDark} />
        </div>

        <div className="px-4 md:px-7 pb-8 max-w-5xl mx-auto">
          <DiscoverBoardPromo isDark={isDark} />
        </div>
      </main>
      <Footer />

      {openOffer && (
        <DiscoverOfferModal offer={openOffer} isDark={isDark} onClose={() => setOpenOffer(null)} />
      )}
    </div>
  );
}

export default function DiscoverPage() {
  return (
    <Suspense>
      <DiscoverPageInner />
    </Suspense>
  );
}
