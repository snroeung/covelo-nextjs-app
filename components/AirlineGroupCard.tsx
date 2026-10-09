'use client';

import Link from 'next/link';
import { getAirlineColor } from '@/lib/flights/itinerary';

interface AirlineGroupCardProps {
  isDark: boolean;
  airlineName: string;
  airlineIata: string | null;
  /** Number of additional offers folded into this group — always >= 1; callers skip rendering otherwise. */
  count: number;
  minPrice: number;
  maxPrice: number;
  href: string;
  onNavigate?: () => void;
}

function formatPrice(n: number): string {
  return `$${Math.round(n).toLocaleString()}`;
}

/**
 * Closes out an airline's top pick in the flights list: "N more fares exist,
 * here's roughly what they cost, here's where to see them all." One card per
 * airline that has more than one qualifying offer — an airline with a single
 * offer has nothing to fold in, so it never gets one (see groupOffersByAirline).
 *
 * A single <Link> rather than a card with a nested button — the whole row is
 * the tap target (min-h-11 well past the 44px floor), so there's no
 * hover-only affordance mobile users would miss.
 */
export function AirlineGroupCard({
  isDark, airlineName, airlineIata, count, minPrice, maxPrice, href, onNavigate,
}: AirlineGroupCardProps) {
  const cardBg     = isDark ? 'bg-gph-dark-card border-gph-dark-line' : 'bg-white border-gray-200';
  const hoverCls   = isDark ? 'hover:border-gph-dark-action' : 'hover:border-gray-400';
  const textPrimary = isDark ? 'text-gph-dark-ink'   : 'text-gray-900';
  const textMuted   = isDark ? 'text-gph-dark-muted' : 'text-gray-500';
  const ctaCls      = isDark
    ? 'border-gph-dark-action text-gph-dark-ink'
    : 'border-gray-900 text-gray-900';

  const priceLabel = maxPrice > minPrice
    ? `${formatPrice(minPrice)}–${formatPrice(maxPrice)}`
    : `from ${formatPrice(minPrice)}`;

  return (
    <Link
      href={href}
      onClick={onNavigate}
      data-testid="airline-group-card"
      className={`flex items-center justify-between gap-4 rounded-xl border border-dashed px-5 py-4 min-h-11 transition-colors ${cardBg} ${hoverCls}`}
    >
      <div className="flex items-center gap-3 min-w-0">
        <div
          className="w-11 h-11 rounded-full flex items-center justify-center text-white text-xs font-extrabold font-mono shrink-0 select-none"
          style={{ background: getAirlineColor(airlineIata) }}
        >
          {airlineIata ?? '?'}
        </div>
        <div className="min-w-0">
          <p className={`text-sm font-bold truncate ${textPrimary}`}>
            +{count} more from {airlineName}
          </p>
          <p className={`text-[10px] font-mono uppercase tracking-widest mt-0.5 ${textMuted}`}>
            {priceLabel}
          </p>
        </div>
      </div>

      <span className={`shrink-0 inline-flex items-center min-h-11 px-3 rounded-lg border text-[10px] font-bold font-mono uppercase tracking-widest ${ctaCls}`}>
        View all →
      </span>
    </Link>
  );
}
