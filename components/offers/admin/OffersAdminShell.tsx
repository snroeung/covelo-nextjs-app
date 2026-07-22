'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { NavBar } from '@/components/NavBar';
import { AdminOffersTable, offerStatus, type OfferStatusFilter } from '@/components/offers/admin/AdminOffersTable';
import { AdminAdsTable, adStatus } from '@/components/offers/admin/AdminAdsTable';
import { AdminAdEditor } from '@/components/offers/admin/AdminAdEditor';
import { AdminOfferEditor } from '@/components/offers/admin/AdminOfferEditor';
import { PendingReviewTable } from '@/components/offers/admin/PendingReviewTable';
import { SyncRunsLog } from '@/components/offers/admin/SyncRunsLog';
import { AdminTransferPartnerEditor } from '@/components/offers/admin/AdminTransferPartnerEditor';
import { AdminHotelCollectionEditor } from '@/components/offers/admin/AdminHotelCollectionEditor';
import { AdminTransferPartnersTable } from '@/components/offers/admin/AdminTransferPartnersTable';
import { AdminHotelCollectionsTable } from '@/components/offers/admin/AdminHotelCollectionsTable';
import { useTheme } from '@/contexts/ThemeContext';
import { trpc } from '@/lib/trpc-client';
import type { SponsoredAd, TransferBonus, SpendingBonus } from '@/lib/types/offers';
import type { TransferPartnerRow, HotelCollection } from '@/lib/types/portalData';

type Tab = 'offers' | 'ads' | 'pending' | 'partners' | 'collections';
type OfferFilter = OfferStatusFilter;
type AdStatusFilter = 'all' | 'live' | 'scheduled' | 'expired' | 'paused';
type PortalFilter = 'all' | 'chase' | 'amex' | 'c1' | 'bilt' | 'citi';

const PORTAL_FILTER_TABS: { key: PortalFilter; label: string }[] = [
  { key: 'all',   label: 'All' },
  { key: 'chase', label: 'Chase' },
  { key: 'amex',  label: 'Amex' },
  { key: 'c1',    label: 'Capital One' },
  { key: 'bilt',  label: 'Bilt' },
  { key: 'citi',  label: 'Citi' },
];

const OFFER_TABS: { key: OfferFilter; label: string }[] = [
  { key: 'all',       label: 'All' },
  { key: 'live',      label: 'Live' },
  { key: 'scheduled', label: 'Scheduled' },
  { key: 'expired',   label: 'Expired' },
  { key: 'paused',    label: 'Paused' },
];

const AD_STATUS_TABS: { key: AdStatusFilter; label: string }[] = [
  { key: 'all',       label: 'All' },
  { key: 'live',      label: 'Live' },
  { key: 'scheduled', label: 'Scheduled' },
  { key: 'expired',   label: 'Expired' },
  { key: 'paused',    label: 'Paused' },
];

export function OffersAdminShell() {
  const { isDark } = useTheme();
  const [tab, setTab] = useState<Tab>('offers');
  const [offerFilter, setOfferFilter] = useState<OfferFilter>('all');
  const [adFilter, setAdFilter] = useState<AdStatusFilter>('all');
  const [editingAd, setEditingAd] = useState<SponsoredAd | null | undefined>(undefined); // undefined = hidden, null = new
  const [editingOffer, setEditingOffer] = useState<
    null | { mode: 'new' } | { mode: 'transfer'; offer: TransferBonus } | { mode: 'spending'; offer: SpendingBonus }
  >(null);
  const [editingPartner, setEditingPartner] = useState<TransferPartnerRow | null | undefined>(undefined); // undefined = hidden, null = new
  const [editingCollection, setEditingCollection] = useState<HotelCollection | null | undefined>(undefined); // undefined = hidden, null = new
  const [partnerFilter, setPartnerFilter] = useState<PortalFilter>('all');
  const [collectionFilter, setCollectionFilter] = useState<PortalFilter>('all');

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

  const { data: hotelCollections = [], isLoading: loadingCollections } = useQuery({
    queryKey: ['portalData.listHotelCollections'],
    queryFn:  () => trpc.portalData.listHotelCollections.query(),
    enabled:  tab === 'collections',
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

  const liveAdsCount = adsData.filter((a) => adStatus(a) === 'live').length;
  const filteredAds = adFilter === 'all' ? adsData : adsData.filter((a) => adStatus(a) === adFilter);
  const filteredPartners = partnerFilter === 'all'
    ? allTransferPartners
    : allTransferPartners.filter((p) => p.portal_id === partnerFilter);
  const filteredCollections = collectionFilter === 'all'
    ? hotelCollections
    : hotelCollections.filter((c) => c.issuer === collectionFilter);

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
            Hotel collections
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

            {/* Offer filter tabs */}
            <div className="flex items-center gap-1 flex-wrap">
              {OFFER_TABS.map((t) => {
                const match = (o: { active: boolean; start_date: string | null; end_date: string | null }) =>
                  t.key === 'all' ? true : offerStatus(o) === t.key;
                const count = (offersData?.transferBonuses.filter(match).length ?? 0)
                  + (offersData?.spendingBonuses.filter(match).length ?? 0);
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
                transferBonuses={offersData?.transferBonuses ?? []}
                spendingBonuses={offersData?.spendingBonuses ?? []}
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

            {/* Ad status filter chips */}
            <div className="flex items-center gap-1 flex-wrap">
              {AD_STATUS_TABS.map((t) => {
                const count = t.key === 'all'
                  ? adsData.length
                  : adsData.filter((a) => adStatus(a) === t.key).length;
                const dotColor =
                  t.key === 'live'      ? 'bg-green-500' :
                  t.key === 'scheduled' ? 'bg-blue-500' :
                  t.key === 'expired'   ? 'bg-red-400' :
                  t.key === 'paused'    ? 'bg-gray-400' : undefined;
                return (
                  <button key={t.key} onClick={() => setAdFilter(t.key)} className={filterTabCls(adFilter === t.key)}>
                    <span className="inline-flex items-center gap-1.5">
                      {dotColor && (
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotColor}`} />
                      )}
                      {t.label}
                    </span>
                    <span className={`ml-1.5 text-[10px] font-mono ${adFilter === t.key ? '' : muted}`}>
                      {count}
                    </span>
                  </button>
                );
              })}
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

            {/* Portal filter tabs */}
            <div className="flex items-center gap-1 flex-wrap">
              {PORTAL_FILTER_TABS.map((t) => {
                const count = t.key === 'all'
                  ? allTransferPartners.length
                  : allTransferPartners.filter((p) => p.portal_id === t.key).length;
                return (
                  <button key={t.key} onClick={() => setPartnerFilter(t.key)} className={filterTabCls(partnerFilter === t.key)}>
                    {t.label}
                    <span className={`ml-1.5 text-[10px] font-mono ${partnerFilter === t.key ? '' : muted}`}>
                      {count}
                    </span>
                  </button>
                );
              })}
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

            {/* Portal filter tabs */}
            <div className="flex items-center gap-1 flex-wrap">
              {PORTAL_FILTER_TABS.map((t) => {
                const count = t.key === 'all'
                  ? hotelCollections.length
                  : hotelCollections.filter((c) => c.issuer === t.key).length;
                return (
                  <button key={t.key} onClick={() => setCollectionFilter(t.key)} className={filterTabCls(collectionFilter === t.key)}>
                    {t.label}
                    <span className={`ml-1.5 text-[10px] font-mono ${collectionFilter === t.key ? '' : muted}`}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            {loadingCollections ? (
              <div className={`h-64 rounded-xl animate-pulse ${isDark ? 'bg-gph-dark-card' : 'bg-white'}`} />
            ) : (
              <AdminHotelCollectionsTable
                collections={filteredCollections}
                onEdit={(collection) => setEditingCollection(collection)}
                isDark={isDark}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}
