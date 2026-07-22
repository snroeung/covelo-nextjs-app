'use client';

import { useState } from 'react';
import { useTheme } from '@/contexts/ThemeContext';

const ISSUER_LABELS: Record<string, string> = {
  chase: 'Chase', amex: 'Amex', c1: 'Capital One', bilt: 'Bilt', citi: 'Citi',
};

// Official issuer/portal hostnames — source_url must resolve to one of
// these or we swap it for the issuer's own login/portal link instead of
// sending users to an unverified third-party page.
const ISSUER_OFFICIAL_HOSTS: Record<string, string[]> = {
  chase: ['chase.com'],
  amex: ['americanexpress.com'],
  c1: ['capitalone.com', 'capitalonetravel.com'],
  bilt: ['biltrewards.com'],
  citi: ['citi.com', 'thankyou.com'],
};

const ISSUER_LOGIN_URLS: Record<string, string> = {
  chase: 'https://travel.chase.com',
  amex: 'https://www.americanexpress.com/en-us/travel/',
  c1: 'https://travel.capitalone.com',
  bilt: 'https://www.biltrewards.com/travel',
  citi: 'https://www.thankyou.com',
};

function resolveCollectionUrl(sourceUrl: string | null, issuer: string): string | null {
  const loginUrl = ISSUER_LOGIN_URLS[issuer] ?? null;
  if (!sourceUrl) return loginUrl;

  const officialHosts = ISSUER_OFFICIAL_HOSTS[issuer] ?? [];
  try {
    const host = new URL(sourceUrl).hostname.replace(/^www\./, '');
    const isOfficial = officialHosts.some((h) => host === h || host.endsWith(`.${h}`));
    return isOfficial ? sourceUrl : loginUrl;
  } catch {
    return loginUrl;
  }
}

function CollectionBanner({ collectionName, issuer, perkSummary, sourceUrl }: { collectionName: string; issuer: string; perkSummary: string; sourceUrl: string | null }) {
  const [open, setOpen]     = useState(false);
  const [pinned, setPinned] = useState(false);

  function close() { setOpen(false); setPinned(false); }
  function toggle() { if (pinned) { close(); } else { setPinned(true); setOpen(true); } }

  const issuerLabel = ISSUER_LABELS[issuer] ?? issuer;
  const linkUrl = resolveCollectionUrl(sourceUrl, issuer);

  return (
    <div className="relative flex flex-wrap items-center gap-x-3 gap-y-1 pl-3 pr-4 py-2 rounded-t-xl bg-linear-to-r from-cv-navy-900 via-cv-navy-900 to-cv-blue-900 border-b-2 border-cv-amber-400">
      <span className="flex items-center justify-center w-5 h-5 rounded shrink-0 bg-cv-amber-400 text-cv-navy-900 text-[11px] font-extrabold leading-none">★</span>

      <span className="text-[10px] font-bold font-mono tracking-widest uppercase text-white whitespace-nowrap">
        {collectionName} · {issuerLabel}
      </span>

      <span className="hidden sm:inline-block w-1 h-1 rounded-full bg-cv-navy-400 shrink-0" />

      <span
        className="relative flex items-center shrink-0"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => { if (!pinned) setOpen(false); }}
      >
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); toggle(); }}
          aria-label="View collection perk details"
          className="flex items-center justify-center min-h-11 min-w-11 -my-3.5 shrink-0"
        >
          <span className="flex items-center justify-center w-4 h-4 rounded-full border border-white/70 text-[10px] leading-none text-white">i</span>
        </button>

        {open && (
          <div className="absolute left-full top-1/2 -translate-y-1/2 pl-1.5 z-50">
            <div className="w-72 rounded-lg border border-gray-200 bg-white text-gray-900 shadow-lg px-3 py-2 text-xs font-normal leading-relaxed whitespace-normal">
              {perkSummary}
            </div>
          </div>
        )}
      </span>

      {linkUrl && (
        <a
          href={linkUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="ml-auto shrink-0 flex items-center min-h-11 text-[10px] font-bold font-mono tracking-widest uppercase text-cv-sky-300 hover:text-cv-sky-400"
        >
          View collection →
        </a>
      )}
    </div>
  );
}

function nightsBetween(checkIn: string, checkOut: string): number {
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.round((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / msPerDay);
}

function ratingLabel(score: number): string | null {
  if (score >= 9.0) return 'Exceptional';
  if (score >= 8.5) return 'Excellent';
  if (score >= 7.5) return 'Very Good';
  if (score >= 6.5) return 'Good';
  return null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function HotelCard({ searchResult, onOpenDetail }: { searchResult: any; defaultCollapsed?: boolean; onOpenDetail?: (sr: any) => void }) {
  const { isDark } = useTheme();

  const acc         = searchResult.accommodation;
  const checkIn     = searchResult.check_in_date as string;
  const checkOut    = searchResult.check_out_date as string;
  const nights      = nightsBetween(checkIn, checkOut);
  const totalAmount = parseFloat(searchResult.cheapest_rate_total_amount ?? '0');
  const currency    = searchResult.cheapest_rate_currency ?? 'USD';
  const perNight    = nights > 0 ? totalAmount / nights : totalAmount;

  const name        = acc.name ?? 'Hotel';
  const stars       = acc.rating as number | null;
  const reviewScore = acc.review_score as number | null;
  const reviewCount = acc.review_count as number | null;
  const lineOne     = acc.location?.address?.line_one ?? '';
  const city        = acc.location?.address?.city_name ?? '';
  const country     = acc.location?.address?.country_code ?? '';
  const streetPart  = lineOne && !acc.name?.toLowerCase().includes(lineOne.toLowerCase()) ? lineOne : '';
  const location    = [streetPart, city, country].filter(Boolean).join(', ');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const amenities   = (acc.amenities ?? []).slice(0, 6) as any[];
  const firstPhoto  = (acc.photos?.[0]?.url ?? null) as string | null;

  const scoreLabel   = reviewScore !== null && reviewScore !== undefined ? ratingLabel(reviewScore) : null;

  const cardBg      = isDark ? 'bg-gph-dark-card border-gph-dark-line' : 'bg-white border-gray-200';
  const textPrimary = isDark ? 'text-gph-dark-ink'   : 'text-gray-900';
  const textMuted   = isDark ? 'text-gph-dark-muted' : 'text-gray-500';
  const pillBg      = isDark ? 'bg-gph-dark-linesoft text-gph-dark-muted' : 'bg-gray-100 text-gray-600';
  const dividerCls  = isDark ? 'border-gph-dark-line' : 'border-gray-200';

  const collection = searchResult.collection as { collection_name: string; issuer: string; perk_summary: string; source_url: string | null } | undefined;

  return (
    <article data-testid="hotel-card" className={`rounded-xl border ${cardBg}`}>
      {collection && (
        <CollectionBanner
          collectionName={collection.collection_name}
          issuer={collection.issuer}
          perkSummary={collection.perk_summary}
          sourceUrl={collection.source_url}
        />
      )}
      <div className={`flex flex-col md:flex-row md:h-44 overflow-hidden ${collection ? 'rounded-b-xl' : 'rounded-xl'}`}>

        {/* Photo — square crop, fixed size so all cards match */}
        <div
          className={`relative w-full aspect-square md:aspect-auto md:w-44 md:h-full shrink-0 ${onOpenDetail ? 'cursor-pointer' : ''}`}
          onClick={() => onOpenDetail?.(searchResult)}
          role={onOpenDetail ? 'button' : undefined}
          tabIndex={onOpenDetail ? 0 : undefined}
          onKeyDown={onOpenDetail ? (e) => { if (e.key === 'Enter' || e.key === ' ') onOpenDetail(searchResult); } : undefined}
          aria-label={onOpenDetail ? `View details for ${name}` : undefined}
        >
          {firstPhoto ? (
            // eslint-disable-next-line @next/next/no-img-element -- remote/dynamic photo URL, no remotePatterns configured yet
            <img
              src={firstPhoto}
              alt={name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className={`w-full h-full flex items-center justify-center text-4xl ${isDark ? 'bg-gph-dark-linesoft' : 'bg-gray-100'}`}>
              🏨
            </div>
          )}
        </div>

        {/* Info — border-t separates it from the photo when stacked on mobile */}
        <div className={`flex flex-col flex-1 min-w-0 overflow-hidden border-t md:border-t-0 ${dividerCls}`}>
          {/* Card body */}
          <div className="flex-1 p-5 overflow-hidden">
            <div className="flex justify-between items-start gap-4">

              {/* Left: stars · name · address · rating */}
              <div className="min-w-0 flex-1">
                {/* Stars + review count */}
                <div className="flex items-center gap-2 mb-1.5">
                  {stars !== null && stars !== undefined && (
                    <div className="flex gap-0.5">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <span key={i} className={`text-xs ${i < stars ? 'text-cv-amber-400' : isDark ? 'text-gph-dark-line' : 'text-gray-200'}`}>★</span>
                      ))}
                    </div>
                  )}
                  {reviewCount !== null && reviewCount !== undefined && (
                    <span className={`text-[10px] font-bold font-mono tracking-widest uppercase ${textMuted}`}>
                      {reviewCount.toLocaleString()} reviews
                    </span>
                  )}
                </div>

                {/* Hotel name */}
                <h3
                  className={`text-xl font-extrabold leading-tight tracking-tight mb-1 truncate ${textPrimary} ${onOpenDetail ? 'cursor-pointer hover:underline underline-offset-2' : ''}`}
                  onClick={() => onOpenDetail?.(searchResult)}
                >
                  {name}
                </h3>

                {/* Address + nights */}
                {location && (
                  <p className={`text-sm mb-2.5 truncate ${textMuted}`}>
                    {location} · {nights} night{nights !== 1 ? 's' : ''}
                  </p>
                )}

                {/* Review score + label */}
                {reviewScore !== null && reviewScore !== undefined && (
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-bold font-mono ${textPrimary}`}>
                      {reviewScore.toFixed(1)}
                      <span className={`font-normal ${textMuted}`}>/10</span>
                    </span>
                    {scoreLabel && (
                      <span className={`text-sm font-bold ${isDark ? 'text-cv-green-500' : 'text-cv-green-800'}`}>{scoreLabel}</span>
                    )}
                  </div>
                )}
              </div>

              {/* Right: price */}
              <div className="text-right shrink-0">
                <p className={`text-[10px] font-bold font-mono tracking-widest uppercase mb-1 ${textMuted}`}>
                  FROM · CASH
                </p>
                <p className={`text-3xl font-extrabold tracking-tight leading-none ${textPrimary}`}>
                  {totalAmount.toLocaleString('en-US', { style: 'currency', currency, maximumFractionDigits: 0 })}
                </p>
                <p className={`text-sm mt-0.5 ${textMuted}`}>
                  {perNight.toLocaleString('en-US', { style: 'currency', currency, maximumFractionDigits: 0 })}/night
                </p>
              </div>
            </div>

            {/* Amenity pills */}
            {amenities.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-3">
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                {amenities.map((a: any, i: number) => (
                  <span key={i} className={`text-[10px] font-bold font-mono tracking-wide px-2.5 py-1 rounded ${pillBg}`}>
                    {a.description ?? a.type}
                  </span>
                ))}
              </div>
            )}
          </div>

        </div>
      </div>
    </article>
  );
}
