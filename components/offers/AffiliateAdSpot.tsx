'use client';

import { useQuery } from '@tanstack/react-query';
import { trpc } from '@/lib/trpc-client';
import type { AdSlot } from '@/lib/types/offers';

interface Props {
  slot: AdSlot;
  isDark: boolean;
}

export function AffiliateAdSpot({ slot, isDark }: Props) {
  const { data: ad, isLoading } = useQuery({
    queryKey: ['offers.featuredAd', slot],
    queryFn:  () => trpc.offers.getFeaturedAd.query({ slot }),
    staleTime: 60 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <div className={`rounded-2xl border h-40 animate-pulse ${
        isDark ? 'bg-gph-dark-card border-gph-dark-line' : 'bg-gray-100 border-gray-200'
      }`} />
    );
  }

  if (!ad) return null;

  const card  = isDark ? 'bg-gph-dark-card border-gph-dark-line' : 'bg-white border-gray-200';
  const ink   = isDark ? 'text-gph-dark-ink'   : 'text-gray-900';
  const muted = isDark ? 'text-gph-dark-muted' : 'text-gray-500';
  const subBg = isDark ? 'bg-gph-dark-linesoft' : 'bg-gray-50';
  const line  = isDark ? 'border-gph-dark-line' : 'border-gray-200';

  return (
    <div className={`rounded-2xl border overflow-hidden ${card}`}>
      {/* Sponsored label */}
      <div className={`px-5 py-2 border-b flex items-center gap-2 ${line} ${subBg}`}>
        <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-md ${
          isDark ? 'bg-gph-dark-bg text-gph-dark-muted' : 'bg-white border border-gray-200 text-gray-500'
        }`}>
          SPONSORED
        </span>
        <span className={`text-[10px] font-mono font-bold tracking-widest ${muted}`}>
          · {ad.partner.toUpperCase()} · {ad.product.toUpperCase()}
        </span>
      </div>

      <div className="flex flex-col md:flex-row">
        {/* Copy */}
        <div className="flex-1 p-5 md:p-6 flex flex-col gap-3">
          <h3 className={`text-xl md:text-2xl font-bold tracking-tight leading-tight ${ink}`}>
            {ad.headline}
          </h3>
          {ad.subheadline && (
            <p className={`text-sm leading-relaxed ${muted}`}>{ad.subheadline}</p>
          )}
          {ad.bullets.length > 0 && (
            <ul className="flex flex-wrap gap-x-5 gap-y-1.5 mt-1">
              {ad.bullets.map((b) => (
                <li key={b} className={`flex items-center gap-1.5 text-xs font-semibold font-mono ${ink}`}>
                  <svg className="w-3 h-3 text-green-500 shrink-0" viewBox="0 0 12 12" fill="none">
                    <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  {b}
                </li>
              ))}
            </ul>
          )}
          <p className={`text-[10px] font-mono italic ${muted}`}>{ad.disclosure}</p>
        </div>

        {/* CTA — affiliate attribution is baked into cta_url via ?ref= server-side */}
        <div className={`flex flex-col justify-center gap-3 p-5 md:p-6 md:w-48 md:border-l shrink-0 ${line} ${subBg}`}>
          <a
            href={ad.cta_url}
            target="_blank"
            rel="noopener noreferrer sponsored"
            className={`flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-bold transition-colors ${
              isDark
                ? 'bg-white text-gray-900 hover:bg-gray-100'
                : 'bg-gray-900 text-white hover:bg-gray-700'
            }`}
          >
            {ad.cta_label}
            <svg className="w-3.5 h-3.5" viewBox="0 0 12 12" fill="none">
              <path d="M2 10L10 2M10 2H4M10 2V8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </a>
          <p className={`text-[9px] font-mono text-center tracking-widest ${muted}`}>RATES & TERMS APPLY</p>
        </div>
      </div>
    </div>
  );
}
