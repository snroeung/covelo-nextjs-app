'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { NavBar } from '@/components/NavBar';
import { AdminOffersTable, offerStatus } from '@/components/offers/admin/AdminOffersTable';
import { AdminAdsTable, adStatus } from '@/components/offers/admin/AdminAdsTable';
import { AdminAdEditor } from '@/components/offers/admin/AdminAdEditor';
import { AdminOfferEditor } from '@/components/offers/admin/AdminOfferEditor';
import { PendingReviewTable } from '@/components/offers/admin/PendingReviewTable';
import { SyncRunsLog } from '@/components/offers/admin/SyncRunsLog';
import { AdminTransferPartnerEditor } from '@/components/offers/admin/AdminTransferPartnerEditor';
import { AdminHotelCollectionEditor } from '@/components/offers/admin/AdminHotelCollectionEditor';
import { AdminTransferPartnersTable, partnerStatus } from '@/components/offers/admin/AdminTransferPartnersTable';
import { AdminTravelCollectionsTable, collectionStatus } from '@/components/offers/admin/AdminTravelCollectionsTable';
import { StatusFilterTabs, IssuerFilterSelect, ISSUER_FILTER_OPTIONS, type StatusFilter, type IssuerFilter } from '@/components/offers/admin/adminTableShared';
import { useTheme } from '@/contexts/ThemeContext';
import { trpc } from '@/lib/trpc-client';
import type { SponsoredAd, TransferBonus, SpendingBonus } from '@/lib/types/offers';
import type { TransferPartnerRow, TravelCollection } from '@/lib/types/portalData';

type Tab = 'offers' | 'ads' | 'pending' | 'partners' | 'collections';
type OfferTypeFilter = 'all' | 'transfer' | 'spending';

const OFFER_TYPE_TABS: { key: OfferTypeFilter; label: string }[] = [
  { key: 'all',      label: 'All' },
  { key: 'transfer', label: 'Transfer bonuses' },
  { key: 'spending', label: 'Spending bonuses' },
];

// Sponsored ads carry no structured issuer column, only a free-text
// `partner` string — match it against the issuer label as a best effort.
function adMatchesIssuer(ad: { partner: string }, issuer: IssuerFilter): boolean {
  if (issuer === 'all') return true;
  const label = ISSUER_FILTER_OPTIONS.find((o) => o.key === issuer)?.label ?? '';
  return ad.partner.toLowerCase().includes(label.toLowerCase());
}

function statusCounts<T>(items: T[], statusOf: (item: T) => StatusFilter): Record<StatusFilter, number> {
  const counts = { all: items.length, live: 0, scheduled: 0, expired: 0, paused: 0 };
  for (const item of items) counts[statusOf(item)]++;
  return counts;
}

export function OffersAdminShell() {
  const { isDark } = useTheme();
  const [tab, setTab] = useState<Tab>('offers');
  const [offerFilter, setOfferFilter] = useState<StatusFilter>('all');
  const [offerTypeFilter, setOfferTypeFilter] = useState<OfferTypeFilter>('all');
  const [offerIssuerFilter, setOfferIssuerFilter] = useState<IssuerFilter>('all');
  const [adFilter, setAdFilter] = useState<StatusFilter>('all');
  const [adIssuerFilter, setAdIssuerFilter] = useState<IssuerFilter>('all');
  const [partnerStatusFilter, setPartnerStatusFilter] = useState<StatusFilter>('all');
  const [collectionStatusFilter, setCollectionStatusFilter] = useState<StatusFilter>('all');
  const [editingAd, setEditingAd] = useState<SponsoredAd | null | undefined>(undefined); // undefined = hidden, null = new
  const [editingOffer, setEditingOffer] = useState<
    null | { mode: 'new' } | { mode: 'transfer'; offer: TransferBonus } | { mode: 'spending'; offer: SpendingBonus }
  >(null);
  const [editingPartner, setEditingPartner] = useState<TransferPartnerRow | null | undefined>(undefined); // undefined = hidden, null = new
  const [editingCollection, setEditingCollection] = useState<TravelCollection | null | undefined>(undefined); // undefined = hidden, null = new
  const [partnerFilter, setPartnerFilter] = useState<IssuerFilter>('all');
  const [collectionFilter, setCollectionFilter] = useState<IssuerFilter>('all');

  const { data: offersData, isLoading: loadingOffers } = useQuery({
    queryKey: ['offers.admin.listAll'],
    queryFn:  () => trpc.offers.admin.listAll.query(),
  });

  const { data: adsData = [], isLoading: loadingAds } = useQuery({
    queryKey: ['offers.admin.listAds'],
    queryFn:  () => trpc.offers.admin.listAds.query(),
  });

  const { data: pendingRows = [], isLoading: loadingPending } = useQuery({
    queryKey: ['portalData.admin.listAll'],
    queryFn:  () => trpc.portalData.admin.listAll.query(),
    enabled:  tab === 'pending',
  });

  const { data: syncRuns = [], isLoading: loadingSyncRuns } = useQuery({
    queryKey: ['portalData.admin.listSyncRuns'],
    queryFn:  () => trpc.portalData.admin.listSyncRuns.query(),
    enabled:  tab === 'pending',
  });

  const { data: allTransferPartners = [], isLoading: loadingPartners } = useQuery({
    queryKey: ['portalData.listTransferPartners'],
    queryFn:  () => trpc.portalData.admin.listTransferPartners.query(),
    enabled:  tab === 'partners',
  });

  // Admin-scoped query (not the public listTravelCollections, which filters
  // to active:true — that would drop a row from this table entirely the
  // moment it's deactivated, with no way to find it again to reactivate).
  const { data: hotelCollections = [], isLoading: loadingCollections } = useQuery({
    queryKey: ['portalData.listTravelCollections'],
    queryFn:  () => trpc.portalData.admin.listTravelCollections.query(),
    enabled:  tab === 'collections',
  });

  const pageBg   = isDark ? 'bg-gph-dark-bg' : 'bg-gray-100';
  const ink      = isDark ? 'text-gph-dark-ink'   : 'text-gray-900';
  const muted    = isDark ? 'text-gph-dark-muted' : 'text-gray-600';
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
    return `${base} ${isDark ? 'text-gph-dark-muted hover:text-gph-dark-ink' : 'text-gray-600 hover:text-gray-700'}`;
  }

  const liveAdsCount = adsData.filter((a) => adStatus(a) === 'live').length;
  const filteredAds = adsData
    .filter((a) => adFilter === 'all' || adStatus(a) === adFilter)
    .filter((a) => adMatchesIssuer(a, adIssuerFilter));
  const filteredTransferBonuses = (offersData?.transferBonuses ?? [])
    .filter((o) => offerIssuerFilter === 'all' || o.issuer === offerIssuerFilter);
  const filteredSpendingBonuses = (offersData?.spendingBonuses ?? [])
    .filter((o) => offerIssuerFilter === 'all' || o.issuer === offerIssuerFilter);
  const filteredPartners = allTransferPartners
    .filter((p) => partnerFilter === 'all' || p.portal_id === partnerFilter)
    .filter((p) => partnerStatusFilter === 'all' || partnerStatus(p) === partnerStatusFilter);
  const filteredCollections = hotelCollections
    .filter((c) => collectionFilter === 'all' || c.issuer === collectionFilter)
    .filter((c) => collectionStatusFilter === 'all' || collectionStatus(c) === collectionStatusFilter);

  return (
    <div className={`flex flex-col min-h-screen ${pageBg}`}>
      <NavBar />

      <main>
      {/* Admin page header */}
      <div className={`px-4 md:px-8 py-6 border-b ${heroBg}`}>
        <div className="max-w-6xl mx-auto flex items-start justify-between gap-6 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-md ${
                isDark ? 'bg-gph-dark-linesoft text-gph-dark-muted' : 'bg-gray-100 text-gray-600'
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
              {liveAdsCount} ads live
            </p>
          </div>
          <div className="flex items-center gap-2">
            {tab === 'offers' && (
              <button
                onClick={() => setEditingOffer({ mode: 'new' })}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-bold transition-colors ${
                  isDark ? 'bg-white text-gray-900 hover:bg-gray-100' : 'bg-gray-900 text-white hover:bg-gray-700'
                }`}
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 12 12" fill="none">
                  <path d="M6 2v8M2 6h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
                New offer
              </button>
            )}
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
            {tab === 'partners' && (
              <button
                onClick={() => setEditingPartner(null)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-bold transition-colors ${
                  isDark ? 'bg-white text-gray-900 hover:bg-gray-100' : 'bg-gray-900 text-white hover:bg-gray-700'
                }`}
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 12 12" fill="none">
                  <path d="M6 2v8M2 6h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
                New partner
              </button>
            )}
            {tab === 'collections' && (
              <button
                onClick={() => setEditingCollection(null)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-bold transition-colors ${
                  isDark ? 'bg-white text-gray-900 hover:bg-gray-100' : 'bg-gray-900 text-white hover:bg-gray-700'
                }`}
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 12 12" fill="none">
                  <path d="M6 2v8M2 6h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
                New collection
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
          </button>
          <button onClick={() => setTab('ads')} className={navTabCls(tab === 'ads')}>
            Sponsored ads
          </button>
          <button onClick={() => setTab('partners')} className={navTabCls(tab === 'partners')}>
            Transfer partners
          </button>
          <button onClick={() => setTab('collections')} className={navTabCls(tab === 'collections')}>
            Travel collections
          </button>
          <button onClick={() => setTab('pending')} className={navTabCls(tab === 'pending')}>
            Pending review
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 md:px-8 py-8 max-w-6xl mx-auto w-full flex flex-col gap-6">
        {tab === 'offers' && (
          <>
            {/* Create / edit offer editor */}
            {editingOffer !== null && (
              <AdminOfferEditor
                initial={
                  editingOffer.mode === 'transfer' ? { type: 'transfer', offer: editingOffer.offer } :
                  editingOffer.mode === 'spending' ? { type: 'spending', offer: editingOffer.offer } :
                  undefined
                }
                onSave={() => setEditingOffer(null)}
                onCancel={() => setEditingOffer(null)}
                isDark={isDark}
              />
            )}

            {/* Offer type filter tabs — isolate spending bonuses from transfer bonuses */}
            <div className="flex items-center gap-1 flex-wrap justify-between">
              <div className="flex items-center gap-1 flex-wrap">
                {OFFER_TYPE_TABS.map((t) => {
                  const count = t.key === 'all'
                    ? filteredTransferBonuses.length + filteredSpendingBonuses.length
                    : t.key === 'transfer'
                      ? filteredTransferBonuses.length
                      : filteredSpendingBonuses.length;
                  return (
                    <button key={t.key} onClick={() => setOfferTypeFilter(t.key)} className={filterTabCls(offerTypeFilter === t.key)}>
                      {t.label}
                      <span className={`ml-1.5 text-[10px] font-mono ${offerTypeFilter === t.key ? '' : muted}`}>
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>
              <IssuerFilterSelect value={offerIssuerFilter} onChange={setOfferIssuerFilter} isDark={isDark} />
            </div>

            {/* Offer status filter tabs */}
            <StatusFilterTabs
              value={offerFilter}
              onChange={setOfferFilter}
              filterTabCls={filterTabCls}
              mutedCls={muted}
              counts={statusCounts(
                [
                  ...(offerTypeFilter === 'spending' ? [] : filteredTransferBonuses),
                  ...(offerTypeFilter === 'transfer' ? [] : filteredSpendingBonuses),
                ],
                offerStatus,
              )}
            />

            {/* Disclaimer: user-submitted review coming soon */}
            <div className={`flex items-start gap-3 px-4 py-3 rounded-xl border text-[11px] font-mono leading-relaxed ${
              isDark
                ? 'bg-amber-900/20 border-amber-700/50 text-amber-400'
                : 'bg-amber-50 border-amber-200 text-amber-700'
            }`}>
              <svg className="w-4 h-4 shrink-0 mt-0.5" viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.25"/>
                <path d="M8 5v3.5M8 11v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              <span>
                <span className="font-bold">User-submitted offer review is coming soon.</span>
                {' '}All current offers are admin-curated.
              </span>
            </div>

            {loadingOffers ? (
              <div className={`h-64 rounded-xl animate-pulse ${isDark ? 'bg-gph-dark-card' : 'bg-white'}`} />
            ) : (
              <AdminOffersTable
                transferBonuses={offerTypeFilter === 'spending' ? [] : filteredTransferBonuses}
                spendingBonuses={offerTypeFilter === 'transfer' ? [] : filteredSpendingBonuses}
                filter={offerFilter}
                isDark={isDark}
                onEdit={(offer) => {
                  if (offer._type === 'transfer') {
                    setEditingOffer({ mode: 'transfer', offer });
                  } else {
                    setEditingOffer({ mode: 'spending', offer });
                  }
                }}
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

            {/* Ad status filter chips + issuer filter */}
            <div className="flex items-center gap-1 flex-wrap justify-between">
              <StatusFilterTabs
                value={adFilter}
                onChange={setAdFilter}
                filterTabCls={filterTabCls}
                mutedCls={muted}
                counts={statusCounts(adsData.filter((a) => adMatchesIssuer(a, adIssuerFilter)), adStatus)}
              />
              <IssuerFilterSelect value={adIssuerFilter} onChange={setAdIssuerFilter} isDark={isDark} />
            </div>

            {loadingAds ? (
              <div className={`h-64 rounded-xl animate-pulse ${isDark ? 'bg-gph-dark-card' : 'bg-white'}`} />
            ) : (
              <AdminAdsTable
                ads={filteredAds}
                onEdit={(ad) => setEditingAd(ad)}
                isDark={isDark}
              />
            )}
          </>
        )}

        {tab === 'pending' && (
          <>
            {loadingPending || loadingSyncRuns ? (
              <div className={`h-64 rounded-xl animate-pulse ${isDark ? 'bg-gph-dark-card' : 'bg-white'}`} />
            ) : (
              <>
                <PendingReviewTable rows={pendingRows} isDark={isDark} />
                <SyncRunsLog runs={syncRuns} isDark={isDark} />
              </>
            )}
          </>
        )}

        {tab === 'partners' && (
          <>
            {editingPartner !== undefined && (
              <AdminTransferPartnerEditor
                initial={editingPartner ?? null}
                onSave={() => setEditingPartner(undefined)}
                onCancel={() => setEditingPartner(undefined)}
                isDark={isDark}
              />
            )}

            {/* Status filter tabs + issuer filter */}
            <div className="flex items-center gap-1 flex-wrap justify-between">
              <StatusFilterTabs
                value={partnerStatusFilter}
                onChange={setPartnerStatusFilter}
                filterTabCls={filterTabCls}
                mutedCls={muted}
                counts={statusCounts(
                  allTransferPartners.filter((p) => partnerFilter === 'all' || p.portal_id === partnerFilter),
                  partnerStatus,
                )}
              />
              <IssuerFilterSelect value={partnerFilter} onChange={setPartnerFilter} isDark={isDark} />
            </div>

            {loadingPartners ? (
              <div className={`h-64 rounded-xl animate-pulse ${isDark ? 'bg-gph-dark-card' : 'bg-white'}`} />
            ) : (
              <AdminTransferPartnersTable
                partners={filteredPartners}
                onEdit={(partner) => setEditingPartner(partner)}
                isDark={isDark}
              />
            )}
          </>
        )}

        {tab === 'collections' && (
          <>
            {editingCollection !== undefined && (
              <AdminHotelCollectionEditor
                initial={editingCollection ?? null}
                onSave={() => setEditingCollection(undefined)}
                onCancel={() => setEditingCollection(undefined)}
                isDark={isDark}
              />
            )}

            {/* Status filter tabs + issuer filter */}
            <div className="flex items-center gap-1 flex-wrap justify-between">
              <StatusFilterTabs
                value={collectionStatusFilter}
                onChange={setCollectionStatusFilter}
                filterTabCls={filterTabCls}
                mutedCls={muted}
                counts={statusCounts(
                  hotelCollections.filter((c) => collectionFilter === 'all' || c.issuer === collectionFilter),
                  collectionStatus,
                )}
              />
              <IssuerFilterSelect value={collectionFilter} onChange={setCollectionFilter} isDark={isDark} />
            </div>

            {loadingCollections ? (
              <div className={`h-64 rounded-xl animate-pulse ${isDark ? 'bg-gph-dark-card' : 'bg-white'}`} />
            ) : (
              <AdminTravelCollectionsTable
                collections={filteredCollections}
                onEdit={(collection) => setEditingCollection(collection)}
                isDark={isDark}
              />
            )}
          </>
        )}
      </div>
      </main>
    </div>
  );
}
