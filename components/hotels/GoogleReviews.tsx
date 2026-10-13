'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { useQuery } from '@tanstack/react-query';
import googleMapsLogoDarkGray from '@/assets/attribution/google-maps-logo-dark-gray.svg';
import googleMapsLogoWhite from '@/assets/attribution/google-maps-logo-white.svg';
import { trpc } from '@/lib/trpc-client';

export interface GoogleReviewsTarget {
  accommodationId: string;
  name: string;
  lat: number;
  lng: number;
}

/**
 * Shared by the reviews section (which fetches) and the modal header (which only
 * reads the cache) — so the header never triggers a second billed Google call.
 */
export function googleReviewsQuery(t: GoogleReviewsTarget) {
  return {
    queryKey: ['places.hotelReviews', t.accommodationId] as const,
    queryFn: () => trpc.places.hotelReviews.query(t),
    // Session-only memory cache; Google's terms forbid storing reviews server-side.
    staleTime: 30 * 60 * 1000,
  };
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function Stars({ rating, size = 'text-xs' }: { rating: number; size?: string }) {
  const full = Math.round(rating);
  return (
    <span role="img" aria-label={`${rating.toFixed(1)} out of 5 stars`} className={`${size} leading-none tracking-tight`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <span key={i} aria-hidden="true" className={i < full ? 'text-cv-amber-400' : 'text-gray-400'}>★</span>
      ))}
    </span>
  );
}

/**
 * Google Maps logo — required attribution next to Google review content.
 * Official, unmodified asset from Google's attribution pack: the plain (non-outlined)
 * variant suits our plain section background — dark gray in light mode, white in dark.
 * Rendered at its native 18px height (Google allows 16–19px) with the required
 * clear space (10px sides/top, 5px bottom).
 */
function GoogleMapsLogo({ isDark }: { isDark: boolean }) {
  return (
    <span className="inline-flex px-2.5 pt-2.5 pb-1.25">
      <Image
        src={isDark ? googleMapsLogoWhite : googleMapsLogoDarkGray}
        alt="Google Maps"
        width={98}
        height={18}
        unoptimized
      />
    </span>
  );
}

/**
 * Hotel reviews from Google Places — the only review source in the app.
 * The Place Details call is billed per request and can't be cached, so it
 * fires only once this section scrolls into view. Renders nothing when
 * Google has no match (or the integration flag is off).
 */
export function GoogleReviews({ target, isDark }: { target: GoogleReviewsTarget; isDark: boolean }) {
  const ref = useRef<HTMLElement>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || inView) return;
    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setInView(true); io.disconnect(); }
    }, { rootMargin: '200px' });
    io.observe(el);
    return () => io.disconnect();
  }, [inView]);

  const { data, isLoading, isError } = useQuery({ ...googleReviewsQuery(target), enabled: inView });

  const textPrimary = isDark ? 'text-gph-dark-ink'   : 'text-gray-900';
  const textMuted   = isDark ? 'text-gph-dark-muted' : 'text-gray-600';
  const link        = isDark ? 'text-cv-green-400'   : 'text-cv-green-800';
  const cardBg      = isDark ? 'bg-gph-dark-card'    : 'bg-white';
  const borderCls   = isDark ? 'border-gph-dark-line' : 'border-gray-200';
  const pageBg      = isDark ? 'bg-gph-dark-bg'      : 'bg-gray-50';
  const skeletonCls = isDark ? 'bg-gph-dark-linesoft' : 'bg-gray-200';
  const linkCls     = `inline-flex items-center min-h-11 text-xs font-bold underline-offset-2 hover:underline focus-visible:underline ${link}`;

  // Settled with nothing to show — keep only the invisible sentinel.
  if (inView && !isLoading && (isError || !data)) return <section ref={ref} aria-hidden="true" />;

  const loading = !inView || isLoading;
  const allReviewsUri = data?.reviewsUri ?? data?.mapsUri ?? null;

  return (
    <section
      ref={ref}
      data-testid="google-reviews"
      aria-labelledby="google-reviews-heading"
      className={`px-6 md:px-8 py-6 border-t ${borderCls} ${pageBg}`}
    >
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1 mb-3">
        <div>
          <h3 id="google-reviews-heading" className={`text-sm font-extrabold ${textPrimary}`}>Guest reviews</h3>
          {loading ? (
            <div className={`mt-2 h-8 w-40 rounded ${skeletonCls}`} />
          ) : data!.rating !== null && (
            <div className="flex items-center gap-2 mt-1">
              <span className={`text-3xl font-extrabold font-mono tracking-tight leading-none ${textPrimary}`}>
                {data!.rating.toFixed(1)}
              </span>
              <div className="flex flex-col gap-0.5">
                <Stars rating={data!.rating} size="text-sm" />
                {data!.ratingCount !== null && (
                  <span className={`text-xs ${textMuted}`}>{data!.ratingCount.toLocaleString()} Google reviews</span>
                )}
              </div>
            </div>
          )}
        </div>
        <div className="flex flex-col items-start sm:items-end">
          <GoogleMapsLogo isDark={isDark} />
          {allReviewsUri && (
            <a href={allReviewsUri} target="_blank" rel="noopener noreferrer" className={linkCls}>
              See all on Google Maps ↗
            </a>
          )}
        </div>
      </div>

      {data?.summary && (
        <div className={`mb-4 rounded-xl border p-4 ${cardBg} ${borderCls}`}>
          <p className={`text-sm leading-relaxed ${textPrimary}`}>{data.summary.text}</p>
          <div className={`flex flex-wrap items-center gap-x-3 text-[11px] ${textMuted}`}>
            <span className="py-2">{data.summary.disclosure}</span>
            {data.summary.flagUri && (
              <a href={data.summary.flagUri} target="_blank" rel="noopener noreferrer" className={linkCls}>Report</a>
            )}
          </div>
        </div>
      )}

      <div className="flex gap-3.5 overflow-x-auto pb-2" style={{ scrollSnapType: 'x mandatory', WebkitOverflowScrolling: 'touch' }}>
        {loading
          ? Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className={`shrink-0 w-[85%] sm:w-72 rounded-xl p-4 border ${cardBg} ${borderCls}`} style={{ scrollSnapAlign: 'start' }}>
                <div className="flex items-center gap-3 mb-3">
                  <div className={`w-8 h-8 rounded-full ${skeletonCls}`} />
                  <div className="flex-1 space-y-1.5">
                    <div className={`h-3 rounded w-24 ${skeletonCls}`} />
                    <div className={`h-2.5 rounded w-16 ${skeletonCls}`} />
                  </div>
                </div>
                <div className={`h-2.5 rounded mb-2 ${skeletonCls}`} />
                <div className={`h-2.5 rounded mb-2 w-5/6 ${skeletonCls}`} />
                <div className={`h-2.5 rounded w-4/6 ${skeletonCls}`} />
              </div>
            ))
          : data!.reviews.map((r, i) => (
              <article
                key={i}
                data-testid="google-review"
                className={`shrink-0 w-[85%] sm:w-72 rounded-xl p-4 border flex flex-col ${cardBg} ${borderCls}`}
                style={{ scrollSnapAlign: 'start' }}
              >
                <div className="flex items-center gap-2.5 mb-2">
                  {r.authorPhotoUri ? (
                    // eslint-disable-next-line @next/next/no-img-element -- Google-hosted author avatar, required attribution
                    <img src={r.authorPhotoUri} alt="" referrerPolicy="no-referrer" className="w-8 h-8 rounded-full shrink-0 object-cover" />
                  ) : (
                    <span aria-hidden="true" className="w-8 h-8 rounded-full shrink-0 flex items-center justify-center text-xs font-extrabold text-white bg-cv-navy-800">
                      {r.author.slice(0, 1).toUpperCase()}
                    </span>
                  )}
                  <div className="min-w-0">
                    {r.authorUri ? (
                      <a href={r.authorUri} target="_blank" rel="noopener noreferrer"
                        className={`block truncate text-sm font-bold leading-tight hover:underline focus-visible:underline ${textPrimary}`}>
                        {r.author}
                      </a>
                    ) : (
                      <span className={`block truncate text-sm font-bold leading-tight ${textPrimary}`}>{r.author}</span>
                    )}
                    <span className={`text-[11px] ${textMuted}`}>
                      {r.relativeTime}
                      {r.visitDate && <> · Visited {MONTHS[r.visitDate.month - 1]} {r.visitDate.year}</>}
                    </span>
                  </div>
                </div>
                <Stars rating={r.rating} />
                <p className={`mt-2 text-sm leading-relaxed flex-1 max-h-30 overflow-y-auto ${textMuted}`}>{r.text}</p>
                <div className="flex items-center justify-between gap-2 mt-1">
                  {r.reviewUri ? (
                    <a href={r.reviewUri} target="_blank" rel="noopener noreferrer" className={linkCls}>View on Google ↗</a>
                  ) : <span />}
                  {r.flagUri && (
                    <a href={r.flagUri} target="_blank" rel="noopener noreferrer"
                      className={`inline-flex items-center min-h-11 text-[11px] hover:underline focus-visible:underline ${textMuted}`}>
                      Report
                    </a>
                  )}
                </div>
              </article>
            ))
        }
      </div>
    </section>
  );
}
