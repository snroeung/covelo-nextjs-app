'use client';

import Image from 'next/image';
import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { trpc } from '@/lib/trpc-client';
import { CARD_NAMES, type CardId } from '@/lib/points/types';
import { CARD_IMAGES } from '@/lib/cardImages';
import type { AdSlot } from '@/lib/types/offers';

function getCardImage(product: string) {
  const entry = (Object.entries(CARD_NAMES) as [CardId, string][]).find(([, name]) => name === product);
  if (!entry) return null;
  return CARD_IMAGES[entry[0]] ?? null;
}

const CAROUSEL_INTERVAL_MS = 30_000;

interface Props {
  slot: AdSlot;
  isDark: boolean;
}

export function AffiliateAdSpot({ slot, isDark }: Props) {
  const [index, setIndex]       = useState(0);
  const [resetKey, setResetKey] = useState(0);

  const { data: rawData, isLoading } = useQuery({
    queryKey: ['offers.featuredAd', slot],
    queryFn:  () => trpc.offers.getFeaturedAd.query({ slot }),
    staleTime: 0,
  });
  // Normalize: guard against stale Redis cache returning old single-object format
  const ads = Array.isArray(rawData) ? rawData : rawData ? [rawData] : [];

  // Reset to first slide when the ad list changes length
  useEffect(() => {
    setIndex(0);
    setResetKey(0);
  }, [ads.length]);

  // Auto-advance every 30s. resetKey restarts the timer when user navigates manually.
  useEffect(() => {
    if (ads.length <= 1) return;
    const timer = setInterval(() => {
      setIndex((i) => (i + 1) % ads.length);
    }, CAROUSEL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [ads.length, resetKey]);

  function goTo(i: number) {
    setIndex(i);
    setResetKey((k) => k + 1); // restart the 30s countdown
  }

  if (isLoading) {
    return (
      <div className={`rounded-2xl border h-40 animate-pulse ${
        isDark ? 'bg-gph-dark-card border-gph-dark-line' : 'bg-gray-100 border-gray-200'
      }`} />
    );
  }

  if (ads.length === 0) return null;

  const ad = ads[index] ?? ads[0];
  if (!ad) return null;

  const isMulti    = ads.length > 1;
  const cardImage  = getCardImage(ad.product);

  const card  = isDark ? 'bg-gph-dark-card border-gph-dark-line' : 'bg-white border-gray-200';
  const ink   = isDark ? 'text-gph-dark-ink'   : 'text-gray-900';
  const muted = isDark ? 'text-gph-dark-muted' : 'text-gray-500';
  const subBg = isDark ? 'bg-gph-dark-linesoft' : 'bg-gray-50';
  const line  = isDark ? 'border-gph-dark-line' : 'border-gray-200';

  return (
    <div className={`rounded-2xl border overflow-hidden ${card}`}>
      {/* Sponsored header */}
      <div className={`px-5 py-2 border-b flex items-center gap-2 ${line} ${subBg}`}>
        <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-md ${
          isDark ? 'bg-gph-dark-bg text-gph-dark-muted' : 'bg-white border border-gray-200 text-gray-500'
        }`}>
          SPONSORED
        </span>
        <span className={`text-[10px] font-mono font-bold tracking-widest ${muted}`}>
          · {ad.partner.toUpperCase()} · {ad.product.toUpperCase()}
        </span>
        {isMulti && (
          <span className={`ml-auto text-[10px] font-mono tabular-nums ${muted}`}>
            {index + 1} / {ads.length}
          </span>
        )}
      </div>

      {/* Ad content */}
      <div className="flex flex-col md:flex-row">
        {cardImage && (
          <div className="shrink-0 flex items-center justify-center p-5 md:p-6 md:pr-0">
            <div className="relative w-28 h-17.5 md:w-36 md:h-22.5 rounded-lg overflow-hidden shadow-lg">
              <Image src={cardImage} alt={`${ad.product} card`} fill className="object-cover" />
            </div>
          </div>
        )}

        <div className="flex-1 p-5 md:p-6 flex flex-col gap-3">
          <h3 className={`text-xl md:text-2xl font-bold tracking-tight leading-tight ${ink}`}>
            {ad.headline}
          </h3>
          {ad.subheadline && (
            <p className={`text-sm leading-relaxed ${muted}`}>{ad.subheadline}</p>
          )}
          {ad.bullets.filter(Boolean).length > 0 && (
            <ul className="flex flex-wrap gap-x-5 gap-y-1.5 mt-1">
              {ad.bullets.filter(Boolean).map((b) => (
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

        <div className={`flex flex-col justify-center gap-3 p-5 md:p-6 md:w-48 md:border-l shrink-0 ${line} ${subBg}`}>
          <a
            href={ad.cta_url}
            target="_blank"
            rel="noopener noreferrer sponsored"
            className={`flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-bold transition-colors ${
              isDark ? 'bg-white text-gray-900 hover:bg-gray-100' : 'bg-gray-900 text-white hover:bg-gray-700'
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

      {/* Carousel controls — only when multiple ads */}
      {isMulti && (
        <div className={`border-t flex items-center justify-center gap-1 py-2 ${line} ${subBg}`}>
          {/* Prev */}
          <button
            onClick={() => goTo((index - 1 + ads.length) % ads.length)}
            aria-label="Previous ad"
            className={`flex items-center justify-center w-8 h-8 rounded-full transition-colors ${
              isDark
                ? 'text-gph-dark-muted hover:text-gph-dark-ink hover:bg-white/10'
                : 'text-gray-400 hover:text-gray-700 hover:bg-gray-100'
            }`}
          >
            <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none">
              <path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>

          {/* Dots */}
          <div className="flex items-center gap-1.5 px-2">
            {ads.map((_, i) => (
              <button
                key={i}
                onClick={() => goTo(i)}
                aria-label={`Go to ad ${i + 1}`}
                className={`rounded-full transition-all duration-200 ${
                  i === index
                    ? `w-4 h-2 ${isDark ? 'bg-gph-dark-ink' : 'bg-gray-700'}`
                    : `w-2 h-2 ${isDark ? 'bg-gph-dark-line hover:bg-gph-dark-muted' : 'bg-gray-300 hover:bg-gray-500'}`
                }`}
              />
            ))}
          </div>

          {/* Next */}
          <button
            onClick={() => goTo((index + 1) % ads.length)}
            aria-label="Next ad"
            className={`flex items-center justify-center w-8 h-8 rounded-full transition-colors ${
              isDark
                ? 'text-gph-dark-muted hover:text-gph-dark-ink hover:bg-white/10'
                : 'text-gray-400 hover:text-gray-700 hover:bg-gray-100'
            }`}
          >
            <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none">
              <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}
