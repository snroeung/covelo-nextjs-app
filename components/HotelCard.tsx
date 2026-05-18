'use client';

import { useState } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { usePointsCalc } from '@/hooks/usePointsCalc';
import { PointsGrid } from '@/components/PointsGrid';

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
export function HotelCard({ searchResult }: { searchResult: any; defaultCollapsed?: boolean }) {
  const { isDark } = useTheme();
  const [showPortals, setShowPortals] = useState(false);
  const [favorited, setFavorited] = useState(false);

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

  const pointsResult = usePointsCalc(totalAmount, 'hotel');
  const best         = pointsResult?.bestPortalResult;
  const isBestValue  = best ? best.centsPerPoint > 1.0 : false;
  const portalCount  = pointsResult?.portalGroups.length ?? 0;
  const scoreLabel   = reviewScore !== null && reviewScore !== undefined ? ratingLabel(reviewScore) : null;

  const cardBg      = isDark ? 'bg-cv-blue-900 border-cv-blue-800' : 'bg-white border-gray-200';
  const textPrimary = isDark ? 'text-white'        : 'text-gray-900';
  const textMuted   = isDark ? 'text-cv-blue-400'  : 'text-gray-500';
  const pillBg      = isDark ? 'bg-cv-blue-800 text-cv-blue-300' : 'bg-gray-100 text-gray-600';
  const dividerCls  = isDark ? 'border-cv-blue-800' : 'border-gray-200';

  return (
    <article className={`rounded-xl overflow-hidden border ${cardBg}`}>
      <div className="flex flex-col md:flex-row">

        {/* Photo */}
        <div className="relative md:w-44 shrink-0">
          {firstPhoto ? (
            <img
              src={firstPhoto}
              alt={name}
              className="w-full h-52 md:h-full object-cover"
            />
          ) : (
            <div className={`w-full h-52 md:h-full flex items-center justify-center text-4xl ${isDark ? 'bg-cv-blue-800' : 'bg-gray-100'}`}>
              🏨
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex flex-col flex-1 min-w-0">
          {/* Card body */}
          <div className="flex-1 p-5">
            <div className="flex justify-between items-start gap-4">

              {/* Left: stars · name · address · rating */}
              <div className="min-w-0 flex-1">
                {/* Stars + review count */}
                <div className="flex items-center gap-2 mb-1.5">
                  {stars !== null && stars !== undefined && (
                    <div className="flex gap-0.5">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <span key={i} className={`text-xs ${i < stars ? 'text-cv-amber-400' : isDark ? 'text-cv-blue-800' : 'text-gray-200'}`}>★</span>
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
                <h3 className={`text-xl font-extrabold leading-tight tracking-tight mb-1 ${textPrimary}`}>
                  {name}
                </h3>

                {/* Address + nights */}
                {location && (
                  <p className={`text-sm mb-2.5 ${textMuted}`}>
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
                      <span className="text-sm font-bold text-cv-green-500">{scoreLabel}</span>
                    )}
                  </div>
                )}
              </div>

              {/* Right: price + heart */}
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
                <button
                  onClick={() => setFavorited(v => !v)}
                  className={`mt-2.5 p-1.5 rounded border transition-colors ${
                    favorited
                      ? 'border-red-300 text-red-500'
                      : isDark ? 'border-cv-blue-700 text-cv-blue-400 hover:border-cv-blue-500' : 'border-gray-300 text-gray-400 hover:border-gray-400 hover:text-gray-600'
                  }`}
                >
                  <svg width="14" height="14" fill={favorited ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                  </svg>
                </button>
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

          {/* Dark points strip */}
          {best && (
            <div className={`flex flex-wrap items-center gap-4 md:gap-6 px-5 py-3.5 ${isDark ? 'bg-cv-navy-900' : 'bg-cv-navy-950'}`}>
              <div>
                <p className="text-[9px] font-bold font-mono tracking-widest uppercase text-cv-navy-400 mb-0.5">
                  Best Portal
                </p>
                <p className="text-sm font-bold text-white leading-tight">{best.portalName}</p>
              </div>

              <div>
                <p className="text-[9px] font-bold font-mono tracking-widest uppercase text-cv-navy-400 mb-0.5">
                  Redeem
                </p>
                <p className="text-sm font-bold font-mono text-cv-sky-400 leading-tight">
                  {best.pointsNeeded.toLocaleString()} pts
                  <span className="text-cv-navy-300 font-normal ml-1.5">· {best.centsPerPoint}¢/pt</span>
                </p>
              </div>

              <div className="hidden md:block">
                <p className="text-[9px] font-bold font-mono tracking-widest uppercase text-cv-navy-400 mb-0.5">
                  Value
                </p>
                <p className={`text-sm font-bold flex items-center gap-1 ${isBestValue ? 'text-cv-green-500' : 'text-cv-navy-300'}`}>
                  {isBestValue && (
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                    </svg>
                  )}
                  {isBestValue ? 'Above Face' : 'At Face'}
                </p>
              </div>

              {portalCount > 0 && (
                <button
                  onClick={() => setShowPortals(v => !v)}
                  className="ml-auto bg-cv-sky-400 text-cv-blue-950 font-extrabold text-xs px-3.5 py-2 rounded-lg whitespace-nowrap hover:bg-cv-sky-300 transition-colors"
                >
                  Compare {portalCount} portal{portalCount !== 1 ? 's' : ''} →
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Portal comparison grid */}
      {showPortals && pointsResult && (
        <div className={`border-t ${dividerCls}`}>
          <PointsGrid result={pointsResult} />
        </div>
      )}
    </article>
  );
}
