'use client';

import { Suspense, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { NavBar } from '@/components/NavBar';
import { FeaturedOfferHero } from '@/components/offers/FeaturedOfferHero';
import { OffersGrid } from '@/components/offers/OffersGrid';
import { OfferCategoryChips } from '@/components/offers/OfferCategoryChips';
import { AffiliateAdSpot } from '@/components/offers/AffiliateAdSpot';
import { CommunityBoard } from '@/components/offers/CommunityBoard';
import { useTheme } from '@/contexts/ThemeContext';
import { trpc } from '@/lib/trpc-client';
import type { OfferCategory } from '@/components/offers/OfferCategoryChips';
import type { Issuer } from '@/lib/types/offers';

function OffersPageInner() {
  const { isDark } = useTheme();
  const [filter, setFilter] = useState<OfferCategory>('all');
  const [issuer, setIssuer] = useState<Issuer | 'all'>('all');

  const { data: transferBonuses = [], isLoading: loadingTransfer } = useQuery({
    queryKey: ['offers.transferBonuses'],
    queryFn:  () => trpc.offers.listTransferBonuses.query(),
    staleTime: 15 * 60 * 1000,
  });

  const { data: spendingBonuses = [], isLoading: loadingSpending } = useQuery({
    queryKey: ['offers.spendingBonuses'],
    queryFn:  () => trpc.offers.listSpendingBonuses.query(),
    staleTime: 15 * 60 * 1000,
  });

  const isLoading = loadingTransfer || loadingSpending;

  // Pick the highest-bonus transfer as the featured offer
  const featuredOffer = transferBonuses.length > 0
    ? [...transferBonuses].sort((a, b) => b.bonus_pct - a.bonus_pct)[0]
    : null;

  // Everything except the featured offer goes in the grid
  const gridTransferAll = featuredOffer
    ? transferBonuses.filter((o) => o.id !== featuredOffer.id)
    : transferBonuses;

  // Issuers present across all offers → dropdown options
  const availableIssuers = Array.from(
    new Set([...transferBonuses, ...spendingBonuses].map((o) => o.issuer))
  );

  const byIssuer = <T extends { issuer: Issuer }>(list: T[]) =>
    issuer === 'all' ? list : list.filter((o) => o.issuer === issuer);

  const gridTransfer = byIssuer(gridTransferAll);
  const gridSpending = byIssuer(spendingBonuses);

  const pageBg  = isDark ? 'bg-gph-dark-bg' : 'bg-gray-100';
  const ink     = isDark ? 'text-gph-dark-ink'   : 'text-gray-900';
  const muted   = isDark ? 'text-gph-dark-muted' : 'text-gray-600';
  const heroBg  = isDark ? 'bg-gph-dark-card border-gph-dark-line' : 'bg-white border-gray-200';
  const filterBg = isDark ? 'bg-gph-dark-card border-gph-dark-line' : 'bg-white border-gray-200';

  const liveCount = transferBonuses.length + spendingBonuses.length;

  return (
    <div className={`flex flex-col min-h-screen ${pageBg}`}>
      <NavBar />

      <main className="flex-1">
        {/* Hero band */}
        <div className={`px-4 md:px-8 py-8 md:py-10 border-b ${heroBg}`}>
          <div className="max-w-5xl mx-auto">
            <div className="flex items-start justify-between gap-6 flex-wrap">
              <div>
                <div className={`text-[10px] font-mono font-bold tracking-widest mb-3 ${muted}`}>
                  OFFERS · {liveCount} LIVE · UPDATED WEEKLY
                </div>
                <h1 className={`text-4xl md:text-5xl font-bold tracking-tight leading-none ${ink}`}>
                  Worth your points<span className={muted}>.</span>
                </h1>
                <p className={`mt-3 text-sm max-w-lg leading-relaxed ${muted}`}>
                  Hand-picked transfer bonuses and spending deals across your active cards.
                  Updated weekly by the Covelo team.
                </p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <a
                  href="#community-board"
                  className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold transition-colors ${
                    isDark
                      ? 'bg-white/10 text-gph-dark-ink hover:bg-white/20'
                      : 'border border-gray-200 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                  Community board
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Category filter bar */}
        <div className={`px-4 md:px-8 py-3 border-b sticky top-0 z-10 ${filterBg}`}>
          <div className="max-w-5xl mx-auto">
            <OfferCategoryChips
              selected={filter}
              onChange={setFilter}
              issuer={issuer}
              onIssuerChange={setIssuer}
              availableIssuers={availableIssuers}
              isDark={isDark}
            />
          </div>
        </div>

        {/* Content */}
        <div className="px-4 md:px-8 py-8 max-w-5xl mx-auto flex flex-col gap-10">
          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className={`h-44 rounded-xl animate-pulse ${
                    isDark ? 'bg-gph-dark-card' : 'bg-white'
                  }`}
                />
              ))}
            </div>
          ) : (
            <>
              {/* Featured offer */}
              {featuredOffer && (filter === 'all' || filter === 'transfer') && (
                <section>
                  <div className={`flex items-baseline justify-between mb-4`}>
                    <h2 className={`text-sm font-bold uppercase tracking-widest ${muted}`}>Featured</h2>
                  </div>
                  <FeaturedOfferHero offer={featuredOffer} isDark={isDark} />
                </section>
              )}

              {/* All offers grid */}
              <section>
                <div className="flex items-baseline justify-between mb-4">
                  <h2 className={`text-xl font-bold tracking-tight ${ink}`}>
                    All offers
                    <span className={`ml-2 text-sm font-mono font-normal ${muted}`}>
                      {(filter === 'all' ? gridTransfer.length + gridSpending.length
                        : filter === 'transfer' ? gridTransfer.length
                        : gridSpending.length)}
                    </span>
                  </h2>
                </div>
                <OffersGrid
                  transferBonuses={filter === 'all' || filter === 'transfer' ? gridTransfer : []}
                  spendingBonuses={filter === 'all' || filter === 'spending' ? gridSpending : []}
                  filter={filter}
                  isDark={isDark}
                />
              </section>

              {/* Sponsored ad */}
              <AffiliateAdSpot slot="below_grid" isDark={isDark} />
            </>
          )}

          {/* Community board */}
          <section id="community-board">
            <CommunityBoard isDark={isDark} />
          </section>
        </div>
      </main>
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
