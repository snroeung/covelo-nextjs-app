'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { NavBar } from '@/components/NavBar';
import { AdminOffersTable } from '@/components/offers/admin/AdminOffersTable';
import { AdminAdsTable } from '@/components/offers/admin/AdminAdsTable';
import { AdminAdEditor } from '@/components/offers/admin/AdminAdEditor';
import { useTheme } from '@/contexts/ThemeContext';
import { trpc } from '@/lib/trpc-client';
import type { SponsoredAd, OfferStatus } from '@/lib/types/offers';

type Tab = 'offers' | 'ads';
type OfferFilter = OfferStatus | 'all';

const OFFER_TABS: { key: OfferFilter; label: string }[] = [
  { key: 'all',      label: 'All' },
  { key: 'pending',  label: 'Pending' },
  { key: 'approved', label: 'Approved' },
  { key: 'admin',    label: 'Admin' },
  { key: 'rejected', label: 'Rejected' },
];

export function OffersAdminShell() {
  const { isDark } = useTheme();
  const [tab, setTab] = useState<Tab>('offers');
  const [offerFilter, setOfferFilter] = useState<OfferFilter>('all');
  const [editingAd, setEditingAd] = useState<SponsoredAd | null | undefined>(undefined); // undefined = hidden, null = new

  const { data: offersData, isLoading: loadingOffers } = useQuery({
    queryKey: ['offers.admin.listAll'],
    queryFn:  () => trpc.offers.admin.listAll.query(),
  });

  const { data: adsData = [], isLoading: loadingAds } = useQuery({
    queryKey: ['offers.admin.listAds'],
    queryFn:  () => trpc.offers.admin.listAds.query(),
  });

  const pageBg   = isDark ? 'bg-gph-dark-bg' : 'bg-gray-100';
  const ink      = isDark ? 'text-gph-dark-ink'   : 'text-gray-900';
  const muted    = isDark ? 'text-gph-dark-muted' : 'text-gray-500';
  const heroBg   = isDark ? 'bg-gph-dark-card border-gph-dark-line' : 'bg-white border-gray-200';
  const tabBar   = isDark ? 'bg-gph-dark-card border-gph-dark-line' : 'bg-white border-gray-200';

  function navTabCls(active: boolean) {
    const base = 'px-4 py-2 rounded-lg text-sm font-semibold transition-colors';
    if (active) return `${base} ${isDark ? 'bg-white text-gray-900' : 'bg-gray-900 text-white'}`;
    return `${base} ${isDark ? 'text-gph-dark-muted hover:text-gph-dark-ink' : 'text-gray-500 hover:text-gray-900'}`;
  }

  function filterTabCls(active: boolean) {
    const base = 'px-3 py-1.5 rounded-lg text-xs font-bold transition-colors';
    if (active) return `${base} ${isDark ? 'bg-gph-dark-linesoft text-gph-dark-ink' : 'bg-gray-100 text-gray-900'}`;
    return `${base} ${isDark ? 'text-gph-dark-muted hover:text-gph-dark-ink' : 'text-gray-500 hover:text-gray-700'}`;
  }

  const pendingCount = (offersData?.transferBonuses ?? []).filter((o) => o.status === 'pending').length
    + (offersData?.spendingBonuses ?? []).filter((o) => o.status === 'pending').length;

  return (
    <div className={`flex flex-col min-h-screen ${pageBg}`}>
      <NavBar />

      {/* Admin page header */}
      <div className={`px-4 md:px-8 py-6 border-b ${heroBg}`}>
        <div className="max-w-6xl mx-auto flex items-start justify-between gap-6 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-md ${
                isDark ? 'bg-gph-dark-linesoft text-gph-dark-muted' : 'bg-gray-100 text-gray-500'
              }`}>
                ADMIN
              </span>
              <span className={`text-[10px] font-mono font-bold tracking-widest ${muted}`}>· OFFERS MANAGEMENT</span>
            </div>
            <h1 className={`text-3xl font-bold tracking-tight ${ink}`}>
              Offers<span className={muted}>.</span>
            </h1>
            <p className={`text-sm mt-1 ${muted}`}>
              {(offersData?.transferBonuses.length ?? 0) + (offersData?.spendingBonuses.length ?? 0)} total ·{' '}
              {pendingCount > 0 && <span className="text-amber-500 font-semibold">{pendingCount} pending review · </span>}
              {adsData.filter((a) => a.active).length} ads live
            </p>
          </div>
          <div className="flex items-center gap-2">
            {tab === 'ads' && (
              <button
                onClick={() => setEditingAd(null)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-bold transition-colors ${
                  isDark ? 'bg-white text-gray-900 hover:bg-gray-100' : 'bg-gray-900 text-white hover:bg-gray-700'
                }`}
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 12 12" fill="none">
                  <path d="M6 2v8M2 6h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
                New ad
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Section tabs */}
      <div className={`px-4 md:px-8 py-3 border-b ${tabBar}`}>
        <div className="max-w-6xl mx-auto flex items-center gap-1">
          <button onClick={() => setTab('offers')} className={navTabCls(tab === 'offers')}>
            Offers
            {pendingCount > 0 && (
              <span className="ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500 text-white">
                {pendingCount}
              </span>
            )}
          </button>
          <button onClick={() => setTab('ads')} className={navTabCls(tab === 'ads')}>
            Sponsored ads
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 md:px-8 py-8 max-w-6xl mx-auto w-full flex flex-col gap-6">
        {tab === 'offers' && (
          <>
            {/* Offer filter tabs */}
            <div className="flex items-center gap-1 flex-wrap">
              {OFFER_TABS.map((t) => {
                const count = t.key === 'all'
                  ? (offersData?.transferBonuses.length ?? 0) + (offersData?.spendingBonuses.length ?? 0)
                  : (offersData?.transferBonuses.filter((o) => o.status === t.key).length ?? 0)
                    + (offersData?.spendingBonuses.filter((o) => o.status === t.key).length ?? 0);
                return (
                  <button key={t.key} onClick={() => setOfferFilter(t.key)} className={filterTabCls(offerFilter === t.key)}>
                    {t.label}
                    <span className={`ml-1.5 text-[10px] font-mono ${offerFilter === t.key ? '' : muted}`}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            {loadingOffers ? (
              <div className={`h-64 rounded-xl animate-pulse ${isDark ? 'bg-gph-dark-card' : 'bg-white'}`} />
            ) : (
              <AdminOffersTable
                transferBonuses={offersData?.transferBonuses ?? []}
                spendingBonuses={offersData?.spendingBonuses ?? []}
                filter={offerFilter}
                isDark={isDark}
              />
            )}
          </>
        )}

        {tab === 'ads' && (
          <>
            {editingAd !== undefined && (
              <AdminAdEditor
                ad={editingAd ?? undefined}
                onSave={() => setEditingAd(undefined)}
                onCancel={() => setEditingAd(undefined)}
                isDark={isDark}
              />
            )}

            {loadingAds ? (
              <div className={`h-64 rounded-xl animate-pulse ${isDark ? 'bg-gph-dark-card' : 'bg-white'}`} />
            ) : (
              <AdminAdsTable
                ads={adsData}
                onEdit={(ad) => setEditingAd(ad)}
                isDark={isDark}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}
