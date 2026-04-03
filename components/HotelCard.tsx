'use client';

import { useState } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { usePointsCalc } from '@/hooks/usePointsCalc';
import { PointsGrid } from '@/components/PointsGrid';
import { AddToTripButton } from '@/components/AddToTripButton';

function nightsBetween(checkIn: string, checkOut: string): number {
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.round((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / msPerDay);
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric' });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function HotelCard({ searchResult, defaultCollapsed = false }: { searchResult: any; defaultCollapsed?: boolean }) {
  const { isDark } = useTheme();
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  const cardBg      = isDark ? 'bg-cv-blue-900' : 'bg-white border border-cv-blue-100';
  const divider     = isDark ? 'border-cv-blue-800' : 'border-cv-blue-100';
  const textPrimary = isDark ? 'text-white' : 'text-cv-blue-950';
  const textMuted   = isDark ? 'text-cv-blue-400' : 'text-cv-blue-400';
  const pillBg      = isDark ? 'bg-cv-blue-800 text-cv-blue-300' : 'bg-cv-blue-50 text-cv-blue-600';

  // StaysSearchResult shape: pricing fields live on searchResult, hotel details in searchResult.accommodation
  const acc          = searchResult.accommodation;
  const checkIn      = searchResult.check_in_date as string;
  const checkOut     = searchResult.check_out_date as string;
  const nights       = nightsBetween(checkIn, checkOut);
  const totalAmount  = parseFloat(searchResult.cheapest_rate_total_amount ?? '0');
  const currency     = searchResult.cheapest_rate_currency ?? 'USD';
  const perNight     = nights > 0 ? totalAmount / nights : totalAmount;

  const name         = acc.name ?? 'Hotel';
  const rating       = acc.rating as number | null;
  const reviewScore  = acc.review_score as number | null;
  const reviewCount  = acc.review_count as number | null;
  const lineOne      = acc.location?.address?.line_one ?? '';
  const city         = acc.location?.address?.city_name ?? '';
  const country      = acc.location?.address?.country_code ?? '';
  // Show street/neighborhood from line_one when it doesn't just repeat the hotel name
  const streetPart   = lineOne && !acc.name?.toLowerCase().includes(lineOne.toLowerCase()) ? lineOne : '';
  const location     = [streetPart, city, country].filter(Boolean).join(', ');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rooms: any[] = acc.rooms ?? [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const amenities: any[] = (acc.amenities ?? []).slice(0, 8);
  const firstPhoto   = (acc.photos?.[0]?.url ?? null) as string | null;

  const pointsResult = usePointsCalc(totalAmount, 'hotel');

  return (
    <div className={`rounded-xl overflow-hidden ${cardBg}`}>
      {/* Header */}
      <div
        role="button"
        onClick={() => setCollapsed(v => !v)}
        className={`w-full flex items-stretch text-left cursor-pointer ${collapsed ? '' : `border-b ${divider}`}`}
      >
        {/* Photo */}
        {firstPhoto ? (
          <img src={firstPhoto} alt={name} className="w-24 shrink-0 object-cover" />
        ) : (
          <div className={`w-24 shrink-0 flex items-center justify-center text-2xl ${isDark ? 'bg-cv-blue-800' : 'bg-cv-blue-50'}`}>
            🏨
          </div>
        )}

        {/* Content */}
        <div className="flex flex-1 items-start justify-between px-4 py-3 gap-3 min-w-0">
          <div className="flex-1 min-w-0">
            <p className={`text-sm font-semibold truncate ${textPrimary}`}>{name}</p>
            <p className={`text-xs ${textMuted}`}>
              {location && `${location} · `}
              {nights} night{nights !== 1 ? 's' : ''}
            </p>
            <div className={`flex items-center gap-2 mt-0.5 text-xs ${textMuted}`}>
              {rating !== null && rating !== undefined && (
                <span>{'★'.repeat(rating)}{'☆'.repeat(5 - rating)}</span>
              )}
              {reviewScore !== null && reviewScore !== undefined && (
                <span>
                  {reviewScore.toFixed(1)}/10
                  {reviewCount !== null && reviewCount !== undefined && ` · ${reviewCount.toLocaleString()} reviews`}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-start gap-2 shrink-0">
            <div className="text-right">
              <p className={`text-[10px] ${textMuted}`}>from</p>
              <p className="text-lg font-bold text-cv-blue-400">
                {totalAmount.toLocaleString('en-US', { style: 'currency', currency, maximumFractionDigits: 0 })}
              </p>
              <p className={`text-xs ${textMuted}`}>
                {perNight.toLocaleString('en-US', { style: 'currency', currency, maximumFractionDigits: 0 })}/night
              </p>
            </div>
            <AddToTripButton
              type="hotel"
              itemId={searchResult.id ?? acc.id ?? `${name}-${city}`}
              title={`${name} · ${city}`}
              data={searchResult}
            />
          </div>
        </div>
      </div>

      {/* Expanded body */}
      {!collapsed && (
        <div className="px-5 py-4 space-y-4">
          {/* Room options */}
          {rooms.length > 0 && (
            <div className="space-y-2">
              <p className={`text-[10px] font-semibold uppercase tracking-widest ${textMuted}`}>Rooms</p>
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              {rooms.slice(0, 3).map((room: any, i: number) => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const cheapestRate = (room.rates ?? []).sort((a: any, b: any) =>
                  parseFloat(a.total_amount) - parseFloat(b.total_amount)
                )[0];
                const timeline = cheapestRate?.cancellation_timeline ?? [];
                const refundable = timeline.some(
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  (t: any) => parseFloat(t.refund_amount) > 0
                );
                return (
                  <div key={i} className={`flex items-center justify-between text-xs gap-3 py-1 border-b last:border-0 ${divider}`}>
                    <div className="flex-1 min-w-0">
                      <p className={`font-medium truncate ${textPrimary}`}>{room.name}</p>
                      {cheapestRate && (
                        <p className={refundable ? 'text-green-500' : textMuted}>
                          {refundable ? 'Free cancellation' : 'Non-refundable'}
                        </p>
                      )}
                    </div>
                    {cheapestRate && (
                      <p className={`font-semibold shrink-0 ${textPrimary}`}>
                        {parseFloat(cheapestRate.total_amount).toLocaleString('en-US', {
                          style: 'currency',
                          currency: cheapestRate.total_currency ?? currency,
                          maximumFractionDigits: 0,
                        })}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Amenities */}
          {amenities.length > 0 && (
            <div className="space-y-1.5">
              <p className={`text-[10px] font-semibold uppercase tracking-widest ${textMuted}`}>Amenities</p>
              <div className="flex flex-wrap gap-1.5">
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                {amenities.map((a: any, i: number) => (
                  <span key={i} className={`text-[11px] rounded-full px-2 py-0.5 ${pillBg}`}>
                    {a.description ?? a.type}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Points breakdown */}
          {pointsResult && (
            <div className="space-y-1.5">
              <p className={`text-[10px] font-semibold uppercase tracking-widest ${textMuted}`}>Points</p>
              <PointsGrid result={pointsResult} collapseAfter={1} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
