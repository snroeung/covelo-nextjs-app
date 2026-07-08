'use client';

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { trpc } from '@/lib/trpc-client';
import type { AdSlot } from '@/lib/types/offers';

const CAROUSEL_INTERVAL_MS = 30_000;

const AD_NET: Record<string, string> = {
  navy:   'linear-gradient(135deg,#0f1e3c,#21498f)',
  black:  'linear-gradient(135deg,#1a1a1d,#3a3a40)',
  steel:  'linear-gradient(135deg,#1f2a36,#46586c)',
  plum:   'linear-gradient(135deg,#2a1336,#6a2a7a)',
  forest: 'linear-gradient(135deg,#0c2a1c,#1f6b45)',
  ember:  'linear-gradient(135deg,#3a1a08,#b9540c)',
};

const TONE_TO_FACE: Record<string, string> = {
  neutral: 'navy',
  dark:    'black',
  sky:     'steel',
  purple:  'plum',
  green:   'forest',
  ember:   'ember',
};

interface CardFaceProps {
  tone?: string;
  issuer: string;
  product: string;
  network?: string;
  last?: string;
  width?: number;
  rotate?: number;
}

function CardFace({ tone = 'neutral', issuer, product, network = 'VISA', last = '0000', width = 180, rotate = 0 }: CardFaceProps) {
  const face = TONE_TO_FACE[tone] ?? 'navy';
  const bg   = AD_NET[face] ?? AD_NET.navy;
  const h    = width / 1.586;
  return (
    <div style={{
      width,
      height: h,
      background: bg,
      borderRadius: width * 0.06,
      padding: width * 0.085,
      color: '#fff',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      boxShadow: '0 10px 26px rgba(0,0,0,0.28)',
      position: 'relative',
      overflow: 'hidden',
      flexShrink: 0,
      transform: rotate ? `rotate(${rotate}deg)` : undefined,
    }}>
      {/* sheen */}
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(115deg,rgba(255,255,255,0.14),transparent 42%)', pointerEvents: 'none' }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ fontSize: width * 0.052, fontFamily: 'var(--font-geist-mono, monospace)', letterSpacing: '0.14em', fontWeight: 700, opacity: 0.75 }}>{issuer}</div>
        <div style={{ width: width * 0.15, height: width * 0.105, background: 'linear-gradient(135deg,#d4af37,#f4d97f)', borderRadius: width * 0.018 }} />
      </div>
      <div>
        <div style={{ fontSize: width * 0.078, fontWeight: 700, letterSpacing: '-0.01em', lineHeight: 1.15 }}>{product}</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: width * 0.04 }}>
          <div style={{ fontSize: width * 0.05, fontFamily: 'var(--font-geist-mono, monospace)', opacity: 0.6, letterSpacing: '0.14em' }}>•••• {last}</div>
          <div style={{ fontSize: width * 0.052, fontFamily: 'var(--font-geist-mono, monospace)', fontWeight: 800, letterSpacing: '0.1em', opacity: 0.85 }}>{network}</div>
        </div>
      </div>
    </div>
  );
}

function CheckIcon() {
  return (
    <svg className="w-2.5 h-2.5 text-green-500 shrink-0" viewBox="0 0 10 10" fill="none">
      <path d="M1.5 5l2.5 2.5 4.5-4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function ArrowIcon({ color = 'currentColor' }: { color?: string }) {
  return (
    <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none">
      <path d="M2 10l8-8M10 10V2H2" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

export type AdVariant = 'compact' | 'inline_banner' | 'native' | 'strip';

interface Props {
  slot: AdSlot;
  isDark: boolean;
  variant?: AdVariant;
  context?: { route?: string[]; city?: string; tripNights?: number };
}

export function AffiliateAdSpot({ slot, isDark, variant = 'compact', context }: Props) {
  const [index, setIndex]       = useState(0);
  const [resetKey, setResetKey] = useState(0);

  const { data: rawData, isLoading } = useQuery({
    queryKey: ['offers.featuredAd', slot],
    queryFn:  () => trpc.offers.getFeaturedAd.query({ slot }),
    staleTime: 0,
  });

  const ads = Array.isArray(rawData) ? rawData : rawData ? [rawData] : [];

  useEffect(() => { setIndex(0); setResetKey(0); }, [ads.length]);

  useEffect(() => {
    if (ads.length <= 1) return;
    const timer = setInterval(() => {
      setIndex((i) => (i + 1) % ads.length);
    }, CAROUSEL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [ads.length, resetKey]);

  function goTo(i: number) { setIndex(i); setResetKey((k) => k + 1); }

  if (isLoading) {
    const skeletonH = variant === 'compact' ? 'h-16' : variant === 'native' ? 'h-44' : 'h-52';
    return <div className={`rounded-xl border animate-pulse ${skeletonH} ${isDark ? 'bg-gph-dark-card border-gph-dark-line' : 'bg-gray-100 border-gray-200'}`} />;
  }

  if (ads.length === 0) return null;

  const ad      = ads[index] ?? ads[0];
  const isMulti = ads.length > 1;

  if (variant === 'inline_banner') return <InlineBanner ad={ad} isDark={isDark} context={context} isMulti={isMulti} index={index} total={ads.length} goTo={goTo} />;
  if (variant === 'native')        return <NativeAd     ad={ad} isDark={isDark} context={context} />;
  if (variant === 'strip')         return <StripAd      ad={ad} isDark={isDark} context={context} />;
  return <CompactAd ad={ad} isDark={isDark} isMulti={isMulti} index={index} total={ads.length} goTo={goTo} />;
}

// ─── Compact (existing sidebar / below_grid) ────────────────────────────────

function CompactAd({ ad, isDark, isMulti, index, total, goTo }: {
  ad: AdData; isDark: boolean;
  isMulti: boolean; index: number; total: number; goTo: (i: number) => void;
}) {
  const border  = isDark ? 'border-gph-dark-line'     : 'border-gray-200';
  const surface = isDark ? 'bg-gph-dark-card'         : 'bg-white';
  const ink     = isDark ? 'text-gph-dark-ink'        : 'text-gray-900';
  const muted   = isDark ? 'text-gph-dark-muted'      : 'text-gray-500';
  const subBg   = isDark ? 'bg-gph-dark-linesoft'     : 'bg-gray-50';
  const sponsBg = isDark ? 'bg-gph-dark-bg text-gph-dark-muted' : 'bg-gray-100 text-gray-400';

  return (
    <div className={`rounded-xl border overflow-hidden ${surface} ${border}`}>
      <div className="flex items-center gap-3 px-3 py-2.5">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className={`text-[9px] font-mono font-bold px-1.5 py-px rounded ${sponsBg}`}>SPONSORED</span>
            <span className={`text-[9px] font-mono font-bold tracking-widest truncate ${muted}`}>
              {ad.partner.toUpperCase()} · {ad.product.toUpperCase()}
            </span>
          </div>
          <p className={`text-sm font-bold leading-tight truncate ${ink}`}>{ad.headline}</p>
          {ad.bullets.filter(Boolean).length > 0 && (
            <div className="flex flex-wrap gap-x-2.5 gap-y-0.5 mt-1">
              {ad.bullets.filter(Boolean).map((b: string) => (
                <span key={b} className={`flex items-center gap-1 text-[10px] font-mono font-semibold ${muted}`}>
                  <CheckIcon /> {b}
                </span>
              ))}
            </div>
          )}
        </div>
        <a
          href={ad.cta_url} target="_blank" rel="noopener noreferrer sponsored"
          className={`shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-colors ${
            isDark ? 'bg-white text-gray-900 hover:bg-gray-100' : 'bg-gray-900 text-white hover:bg-gray-700'
          }`}
        >
          {ad.cta_label} <ArrowIcon />
        </a>
      </div>

      {isMulti && (
        <div className={`border-t flex items-center justify-center gap-2 py-1.5 ${border} ${subBg}`}>
          <button onClick={() => goTo((index - 1 + total) % total)} aria-label="Previous ad"
            className={`flex items-center justify-center w-6 h-6 rounded-full transition-colors ${isDark ? 'text-gph-dark-muted hover:text-gph-dark-ink hover:bg-white/10' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'}`}>
            <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none"><path d="M8 10L4 6l4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
          <div className="flex items-center gap-1.5">
            {Array.from({ length: total }).map((_, i) => (
              <button key={i} onClick={() => goTo(i)} aria-label={`Ad ${i + 1}`}
                className={`rounded-full transition-all duration-200 ${i === index ? `w-3.5 h-1.5 ${isDark ? 'bg-gph-dark-ink' : 'bg-gray-700'}` : `w-1.5 h-1.5 ${isDark ? 'bg-gph-dark-line hover:bg-gph-dark-muted' : 'bg-gray-300 hover:bg-gray-500'}`}`} />
            ))}
          </div>
          <button onClick={() => goTo((index + 1) % total)} aria-label="Next ad"
            className={`flex items-center justify-center w-6 h-6 rounded-full transition-colors ${isDark ? 'text-gph-dark-muted hover:text-gph-dark-ink hover:bg-white/10' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'}`}>
            <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none"><path d="M4 2l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Inline Banner (flights / hotels results row) ────────────────────────────

function InlineBanner({ ad, isDark, context, isMulti, index, total, goTo }: {
  ad: AdData; isDark: boolean;
  context?: Props['context'];
  isMulti: boolean; index: number; total: number; goTo: (i: number) => void;
}) {
  const border  = isDark ? 'border-gph-dark-line' : 'border-gray-200';
  const surface = isDark ? 'bg-gph-dark-card'     : 'bg-white';
  const ink     = isDark ? 'text-gph-dark-ink'    : 'text-gray-900';
  const muted   = isDark ? 'text-gph-dark-muted'  : 'text-gray-500';
  const bgRight = isDark ? 'bg-gph-dark-bg'       : 'bg-gray-50';
  const panelBg = isDark ? '#1b2d42'              : '#0c0c0d';
  const sponsBg = isDark ? 'bg-white/10 text-white/70' : 'bg-gray-100 text-gray-400';

  const contextLine = context?.route
    ? `MATCHED TO YOUR SEARCH · ${context.route.join(' → ')}`
    : context?.city
    ? `MATCHED TO YOUR SEARCH · ${context.city.toUpperCase()}`
    : null;

  return (
    <div className={`rounded-xl border overflow-hidden ${surface} ${border}`}>
      <div className="flex flex-col md:grid md:grid-cols-[auto_1fr_auto]">

        {/* Card panel */}
        <div
          className="flex items-center justify-center p-5 md:p-6"
          style={{ background: panelBg }}
        >
          <CardFace
            tone={ad.tone ?? 'neutral'}
            issuer={ad.partner.toUpperCase()}
            product={ad.product}
            width={160}
            rotate={-6}
          />
        </div>

        {/* Copy */}
        <div className="flex flex-col gap-2.5 p-5 justify-center min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-[9px] font-mono font-bold px-1.5 py-px rounded ${sponsBg}`}>SPONSORED</span>
            {contextLine && (
              <span className={`text-[9px] font-mono font-bold tracking-widest ${muted}`}>{contextLine}</span>
            )}
          </div>
          <p className={`text-xl font-extrabold leading-tight tracking-tight ${ink}`}>{ad.headline}</p>
          {ad.subheadline && (
            <p className={`text-sm leading-relaxed max-w-lg ${muted}`}>{ad.subheadline}</p>
          )}
          {ad.bullets.filter(Boolean).length > 0 && (
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-0.5">
              {ad.bullets.filter(Boolean).map((b: string) => (
                <span key={b} className={`flex items-center gap-1.5 text-[11px] font-mono font-semibold ${muted}`}>
                  <CheckIcon /> {b}
                </span>
              ))}
            </div>
          )}
          <p className={`text-[9.5px] font-mono italic leading-snug mt-0.5 ${muted}`}>{ad.disclosure}</p>
        </div>

        {/* CTA rail */}
        <div className={`flex flex-row md:flex-col items-center md:justify-center gap-3 p-4 md:p-5 border-t md:border-t-0 md:border-l ${border} ${bgRight} md:min-w-[190px]`}>
          {ad.subheadline && (
            <div className="hidden md:block text-center mb-1">
              <div className={`text-[9px] font-mono font-bold tracking-widest ${muted}`}>EST. VALUE</div>
              <div className={`text-2xl font-extrabold font-mono tracking-tight ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>{ad.subheadline}</div>
            </div>
          )}
          <a
            href={ad.cta_url} target="_blank" rel="noopener noreferrer sponsored"
            className={`flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-[12px] font-bold transition-colors whitespace-nowrap ${
              isDark ? 'bg-white text-gray-900 hover:bg-gray-100' : 'bg-gray-900 text-white hover:bg-gray-700'
            }`}
          >
            {ad.cta_label} <ArrowIcon />
          </a>
          <button className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-[11px] font-bold border transition-colors whitespace-nowrap ${
            isDark ? 'border-gph-dark-line text-gph-dark-muted hover:text-gph-dark-ink hover:bg-gph-dark-linesoft' : 'border-gray-200 text-gray-500 hover:text-gray-900 hover:bg-gray-100'
          }`}>
            Compare cards
          </button>
          {isMulti && (
            <div className="flex items-center gap-1 md:mt-1">
              {Array.from({ length: total }).map((_, i) => (
                <button key={i} onClick={() => goTo(i)} aria-label={`Ad ${i + 1}`}
                  className={`rounded-full transition-all duration-200 ${i === index ? `w-3 h-1.5 ${isDark ? 'bg-gph-dark-ink' : 'bg-gray-700'}` : `w-1.5 h-1.5 ${isDark ? 'bg-gph-dark-line' : 'bg-gray-300'}`}`} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Native (trip planner in-flow suggestion) ────────────────────────────────

function NativeAd({ ad, isDark, context }: {
  ad: AdData; isDark: boolean; context?: Props['context'];
}) {
  const border  = isDark ? 'border-gph-dark-line'     : 'border-gray-200';
  const surface = isDark ? 'bg-gph-dark-card'         : 'bg-white';
  const ink     = isDark ? 'text-gph-dark-ink'        : 'text-gray-900';
  const muted   = isDark ? 'text-gph-dark-muted'      : 'text-gray-500';
  const headerBg = isDark ? 'bg-blue-950/40'          : 'bg-blue-50';
  const headerBorder = isDark ? 'border-gph-dark-line' : 'border-blue-100';
  const sponsBg  = isDark ? 'bg-white/10 text-white/50' : 'bg-blue-100 text-blue-500';

  const nights = context?.tripNights;

  return (
    <div className={`rounded-xl border overflow-hidden ${surface}`}
      style={{ borderStyle: 'dashed', borderColor: isDark ? '#1F6FBF' : '#93c5fd', borderWidth: 1 }}>

      {/* Header */}
      <div className={`flex items-center gap-2 px-4 py-2 border-b ${headerBg} ${headerBorder}`}>
        <svg className="w-3.5 h-3.5 text-blue-500 shrink-0" viewBox="0 0 14 14" fill="none">
          <path d="M7 1l1.5 3 3.5.5-2.5 2.5.5 3.5L7 9 4 10.5l.5-3.5L2 4.5l3.5-.5L7 1z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
        </svg>
        <span className={`text-[10px] font-mono font-bold tracking-widest ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>
          SUGGESTED FOR THIS TRIP
        </span>
        <span className="ml-auto">
          <span className={`text-[9px] font-mono font-bold px-1.5 py-px rounded ${sponsBg}`}>SPONSORED</span>
        </span>
      </div>

      {/* Body */}
      <div className="flex flex-col md:grid md:grid-cols-[auto_1fr_auto] gap-0">
        <div className="flex items-center justify-center p-5" style={{ background: isDark ? '#1b2d42' : '#0c0c0d' }}>
          <CardFace tone={ad.tone ?? 'neutral'} issuer={ad.partner.toUpperCase()} product={ad.product} width={140} rotate={4} />
        </div>

        <div className="flex flex-col gap-2 p-5 justify-center min-w-0">
          <p className={`text-lg font-extrabold leading-tight tracking-tight ${ink}`}>
            {nights ? ad.headline.replace(/\d+-night/g, `${nights}-night`) : ad.headline}
          </p>
          {ad.subheadline && (
            <p className={`text-sm leading-relaxed ${muted}`}>{ad.subheadline}</p>
          )}
          {ad.bullets.filter(Boolean).length > 0 && (
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              {ad.bullets.filter(Boolean).map((b: string) => (
                <span key={b} className={`flex items-center gap-1.5 text-[11px] font-mono font-semibold ${muted}`}>
                  <CheckIcon /> {b}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className={`flex flex-row md:flex-col gap-2 p-4 md:p-5 justify-start md:justify-center border-t md:border-t-0 md:border-l ${border} md:min-w-40`}>
          <a
            href={ad.cta_url} target="_blank" rel="noopener noreferrer sponsored"
            className={`flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-[12px] font-bold transition-colors whitespace-nowrap ${
              isDark ? 'bg-white text-gray-900 hover:bg-gray-100' : 'bg-gray-900 text-white hover:bg-gray-700'
            }`}
          >
            Add &amp; apply <ArrowIcon />
          </a>
          <button className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-[11px] font-bold border transition-colors whitespace-nowrap ${
            isDark ? 'border-gph-dark-line text-gph-dark-muted hover:text-gph-dark-ink' : 'border-gray-200 text-gray-500 hover:text-gray-900'
          }`}>
            Not now
          </button>
        </div>
      </div>

      <div className={`px-5 pb-3 ${isDark ? 'text-gph-dark-muted' : 'text-gray-400'}`}>
        <p className="text-[9px] font-mono italic">{ad.disclosure}</p>
      </div>
    </div>
  );
}

// ─── Strip (trip detail post-booking) ────────────────────────────────────────

function StripAd({ ad, isDark, context }: {
  ad: AdData; isDark: boolean; context?: Props['context'];
}) {
  return (
    <div className="rounded-xl overflow-hidden" style={{ background: '#0c0c0d', color: '#fff' }}>
      <div className="flex flex-col md:grid md:grid-cols-[auto_1fr_auto]">

        {/* Card panel */}
        <div className="flex items-center justify-center p-6" style={{ background: 'rgba(255,255,255,0.04)' }}>
          <CardFace tone={ad.tone ?? 'neutral'} issuer={ad.partner.toUpperCase()} product={ad.product} width={170} rotate={6} />
        </div>

        {/* Copy */}
        <div className="flex flex-col gap-2.5 p-5 justify-center min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[9px] font-mono font-bold px-1.5 py-px rounded" style={{ background: 'rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.7)' }}>SPONSORED</span>
            {context?.tripNights && (
              <span className="text-[9px] font-mono font-bold tracking-widest" style={{ color: 'rgba(255,255,255,0.45)' }}>
                · YOUR TRIP IS BOOKED · {context.tripNights} NIGHTS
              </span>
            )}
          </div>
          <p className="text-xl font-extrabold leading-tight tracking-tight text-white">{ad.headline}</p>
          {ad.subheadline && (
            <p className="text-sm leading-relaxed max-w-lg" style={{ color: 'rgba(255,255,255,0.65)' }}>{ad.subheadline}</p>
          )}
          {ad.bullets.filter(Boolean).length > 0 && (
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-0.5">
              {ad.bullets.filter(Boolean).map((b: string) => (
                <span key={b} className="flex items-center gap-1.5 text-[11px] font-mono font-semibold text-white">
                  <svg className="w-2.5 h-2.5 text-sky-400 shrink-0" viewBox="0 0 10 10" fill="none">
                    <path d="M1.5 5l2.5 2.5 4.5-4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  {b}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* CTA rail */}
        <div className="flex flex-row md:flex-col items-center md:justify-center gap-3 p-5 border-t md:border-t-0 md:border-l md:min-w-[200px]"
          style={{ borderColor: 'rgba(255,255,255,0.1)' }}>
          {ad.subheadline && (
            <div className="hidden md:block text-center mb-1">
              <div className="text-[9px] font-mono font-bold tracking-widest" style={{ color: 'rgba(255,255,255,0.45)' }}>BONUS VALUE</div>
              <div className="text-2xl font-extrabold font-mono tracking-tight text-sky-400">{ad.subheadline}</div>
            </div>
          )}
          <a
            href={ad.cta_url} target="_blank" rel="noopener noreferrer sponsored"
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-[12px] font-bold transition-opacity hover:opacity-90 whitespace-nowrap"
            style={{ background: '#38bdf8', color: '#0c0c0d' }}
          >
            {ad.cta_label} <ArrowIcon color="#0c0c0d" />
          </a>
          <p className="text-[9px] font-mono italic text-center" style={{ color: 'rgba(255,255,255,0.4)' }}>{ad.disclosure}</p>
        </div>
      </div>
    </div>
  );
}

type AdData = {
  partner: string;
  product: string;
  headline: string;
  subheadline: string | null;
  bullets: string[];
  cta_label: string;
  cta_url: string;
  disclosure: string;
  tone?: string;
};
