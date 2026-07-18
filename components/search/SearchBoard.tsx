'use client';

import { useState } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { usePointsCalc } from '@/hooks/usePointsCalc';
import { calcPoints } from '@/lib/points/calcPoints';
import { PointsGrid } from '@/components/PointsGrid';
import type { FlightContext, PortalId } from '@/lib/points/types';

// Subset of a Duffel flight offer actually read by adaptFlightOffer. The
// `flights.board` router returns Duffel's raw (untyped) offer shape — this
// interface mirrors just the fields consumed here rather than the full SDK type.
export interface FlightOfferSlice {
  id: string;
  total_amount?: string;
  owner?: { iata_code?: string | null; name?: string | null };
  slices?: {
    segments?: {
      origin?: { iata_code?: string | null; city_name?: string | null };
      destination?: { iata_code?: string | null; city_name?: string | null };
      marketing_carrier?: { iata_code?: string | null; name?: string | null };
    }[];
  }[];
}

// Subset of a `stays.search` result actually read by adaptStay — the router
// returns Duffel's full StaysSearchResult (dozens of required fields) optionally
// augmented with portalPrices; this mirrors just what's consumed here.
export interface StaySearchResultSlice {
  id?: string;
  cheapest_rate_total_amount?: string;
  accommodation?: { id?: string; name?: string; rating?: number | null };
  portalPrices?: BoardCard['portalPrices'];
}

// A normalized card for the example board — the minimum needed to render a tile
// and drive the points-comparison modal. Adapted from the raw Duffel
// flight-offer / stay-accommodation shapes returned by the tRPC search.
export interface BoardCard {
  id: string;
  kind: 'flight' | 'hotel';
  eyebrow: string;         // small top-left label — airline (flights) / hotel brand (hotels)
  title: string;
  subtitle: string;
  logoUrl?: string;        // square brand logo (airline CDN / hotel brand domain)
  stars?: number;          // hotel star class, rendered as a gold star row
  priceUsd: number;
  pointsNeeded?: number;   // best-portal estimate (all cards), for the tile
  cpp?: number;
  flightCtx?: FlightContext;
  portalPrices?: Partial<Record<PortalId, number>>;
  hotelChain?: string;
}

// Map a hotel name to its parent brand (label + logo domain) by sub-brand keyword.
// First match wins; unmatched names fall back to a "Stay" code square.
const HOTEL_BRANDS: { label: string; domain: string; keywords: string[] }[] = [
  { label: 'Hilton',       domain: 'hilton.com',          keywords: ['hilton', 'conrad', 'waldorf', 'canopy', 'curio', 'doubletree', 'embassy suites', 'hampton', 'home2', 'tapestry', 'motto', 'signia', 'tempo', 'lxr'] },
  { label: 'Marriott',     domain: 'marriott.com',        keywords: ['marriott', 'ritz-carlton', 'ritz carlton', 'st. regis', 'st regis', 'w hotel', 'westin', 'sheraton', 'méridien', 'meridien', 'renaissance', 'autograph', 'courtyard', 'residence inn', 'aloft', 'element', 'moxy', 'ac hotel', 'gaylord', 'tribute', 'delta hotels'] },
  { label: 'Hyatt',        domain: 'hyatt.com',           keywords: ['hyatt', 'andaz', 'thompson', 'alila', 'miraval', 'caption'] },
  { label: 'IHG',          domain: 'ihg.com',             keywords: ['intercontinental', 'kimpton', 'crowne plaza', 'holiday inn', 'hotel indigo', 'voco', 'staybridge', 'candlewood', 'regent', 'six senses', 'even hotel', 'vignette'] },
  { label: 'Accor',        domain: 'accor.com',           keywords: ['sofitel', 'novotel', 'pullman', 'fairmont', 'raffles', 'mövenpick', 'movenpick', 'mercure', 'ibis', 'mondrian', '25hours', 'swissôtel', 'swissotel', 'delano', 'sls'] },
  { label: 'Four Seasons', domain: 'fourseasons.com',     keywords: ['four seasons'] },
  { label: 'Wyndham',      domain: 'wyndhamhotels.com',   keywords: ['wyndham', 'ramada', 'days inn', 'super 8', 'la quinta', 'howard johnson', 'travelodge', 'microtel', 'baymont', 'wingate'] },
  { label: 'Choice',       domain: 'choicehotels.com',    keywords: ['comfort inn', 'comfort suites', 'quality inn', 'clarion', 'sleep inn', 'cambria', 'ascend', 'econo lodge', 'rodeway'] },
  { label: 'Radisson',     domain: 'radissonhotels.com',  keywords: ['radisson', 'park plaza', 'park inn', 'country inn'] },
  { label: 'Best Western', domain: 'bestwestern.com',     keywords: ['best western'] },
  { label: 'Sonesta',      domain: 'sonesta.com',         keywords: ['sonesta'] },
  { label: 'Omni',         domain: 'omnihotels.com',      keywords: ['omni'] },
  { label: 'Loews',        domain: 'loewshotels.com',     keywords: ['loews'] },
];
function detectHotelBrand(name: string): { label: string; domain: string } | null {
  const n = name.toLowerCase();
  for (const b of HOTEL_BRANDS) if (b.keywords.some((k) => n.includes(k))) return { label: b.label, domain: b.domain };
  return null;
}
const brandLogo = (domain: string) => `https://www.google.com/s2/favicons?sz=64&domain=${domain}`;
const airlineLogo = (iata: string) => `https://pics.avs.io/60/60/${iata}@2x.png`;

// Best-portal points/cpp estimate for the tile. Pure — safe to call in a map.
function estimate(priceUsd: number, kind: 'flight' | 'hotel', flightCtx?: FlightContext, portalPrices?: BoardCard['portalPrices'], hotelChain?: string) {
  try {
    const r = calcPoints(priceUsd, kind, undefined, flightCtx, portalPrices, hotelChain);
    return { pointsNeeded: r.bestPortalResult.pointsNeeded, cpp: r.bestPortalResult.centsPerPoint };
  } catch {
    return {};
  }
}

// ── Adapters ────────────────────────────────────────────────────────────────
export function adaptFlightOffer(offer: FlightOfferSlice): BoardCard | null {
  const price = parseFloat(offer?.total_amount ?? '');
  if (!price) return null;
  const segments = offer?.slices?.[0]?.segments ?? [];
  const seg0 = segments[0];
  const segN = segments.at(-1);
  const originIata = seg0?.origin?.iata_code ?? null;
  const destIata   = segN?.destination?.iata_code ?? null;
  const originCity = seg0?.origin?.city_name ?? originIata;
  const destCity   = segN?.destination?.city_name ?? destIata;
  const airlineIata = offer?.owner?.iata_code ?? seg0?.marketing_carrier?.iata_code ?? null;
  const flightCtx: FlightContext = { airlineIata, originIata, destIata, routeType: 'domestic', cabin: 'economy' };
  const stops = segments.length <= 1 ? 'Nonstop' : `${segments.length - 1} stop${segments.length - 1 > 1 ? 's' : ''}`;
  const codeRoute = originIata && destIata ? `${originIata} → ${destIata}` : null;
  return {
    id: offer.id,
    kind: 'flight',
    eyebrow: offer?.owner?.name ?? seg0?.marketing_carrier?.name ?? 'Flight',
    title: originCity && destCity ? `${originCity} → ${destCity}` : codeRoute ?? 'Flight',
    subtitle: codeRoute ? `${codeRoute} · ${stops}` : stops,
    logoUrl: airlineIata ? airlineLogo(airlineIata) : undefined,
    priceUsd: price,
    flightCtx,
    ...estimate(price, 'flight', flightCtx),
  };
}

export function adaptStay(sr: StaySearchResultSlice, nights = 3): BoardCard | null {
  const price = parseFloat(sr?.cheapest_rate_total_amount ?? '');
  if (!price) return null;
  const acc = sr?.accommodation ?? {};
  const name = acc?.name ?? 'Hotel';
  const brand = detectHotelBrand(name);
  const stars = acc?.rating ? Math.min(5, Math.max(1, Math.round(acc.rating))) : undefined;
  return {
    id: sr.id ?? acc.id ?? name,
    kind: 'hotel',
    eyebrow: brand?.label ?? 'Stay',
    title: name,
    subtitle: `PHL · ${nights} night${nights === 1 ? '' : 's'}`,
    logoUrl: brand ? brandLogo(brand.domain) : undefined,
    stars,
    priceUsd: price,
    portalPrices: sr?.portalPrices,
    hotelChain: name,
    ...estimate(price, 'hotel', undefined, sr?.portalPrices, name),
  };
}

// Curated example cards shown when the live board returns nothing (e.g. no Duffel
// creds in local dev) so the marquee always demonstrates the design.
// ponytail: illustrative only — live cache-first results take precedence when present.
function fallback(kind: 'flight' | 'hotel', id: string, eyebrow: string, title: string, subtitle: string, priceUsd: number, flightCtx?: FlightContext, stars?: number): BoardCard {
  let logoUrl: string | undefined;
  let label = eyebrow;
  if (kind === 'flight' && flightCtx?.airlineIata) logoUrl = airlineLogo(flightCtx.airlineIata);
  if (kind === 'hotel') {
    const brand = detectHotelBrand(title);
    if (brand) { label = brand.label; logoUrl = brandLogo(brand.domain); }
  }
  const hotelChain = kind === 'hotel' ? title : undefined;
  return { id, kind, eyebrow: label, title, subtitle, logoUrl, stars, priceUsd, flightCtx, hotelChain, ...estimate(priceUsd, kind, flightCtx, undefined, hotelChain) };
}
export const FALLBACK_FLIGHTS: BoardCard[] = [
  fallback('flight', 'fb-f1', 'United',     'Philadelphia → San Francisco', 'PHL → SFO · Nonstop', 214, { airlineIata: 'UA', originIata: 'PHL', destIata: 'SFO', routeType: 'domestic', cabin: 'economy' }),
  fallback('flight', 'fb-f2', 'American',   'Philadelphia → Los Angeles',   'PHL → LAX · Nonstop', 198, { airlineIata: 'AA', originIata: 'PHL', destIata: 'LAX', routeType: 'domestic', cabin: 'economy' }),
  fallback('flight', 'fb-f3', 'Korean Air', 'Philadelphia → Seoul',         'PHL → ICN · 1 stop',  982, { airlineIata: 'KE', originIata: 'PHL', destIata: 'ICN', routeType: 'long_haul', cabin: 'economy' }),
  fallback('flight', 'fb-f4', 'Lufthansa',  'Philadelphia → Munich',        'PHL → MUC · Nonstop', 724, { airlineIata: 'LH', originIata: 'PHL', destIata: 'MUC', routeType: 'long_haul', cabin: 'economy' }),
  fallback('flight', 'fb-f5', 'Air France', 'Philadelphia → Paris',         'PHL → LBG · 1 stop',  656, { airlineIata: 'AF', originIata: 'PHL', destIata: 'LBG', routeType: 'long_haul', cabin: 'economy' }),
  fallback('flight', 'fb-f6', 'ANA',        'Philadelphia → Tokyo',         'PHL → HND · 1 stop', 1124, { airlineIata: 'NH', originIata: 'PHL', destIata: 'HND', routeType: 'long_haul', cabin: 'economy' }),
];
export const FALLBACK_STAYS: BoardCard[] = [
  fallback('hotel', 'fb-h1', 'Stay', 'The Logan, Curio Collection by Hilton', 'PHL · 3 nights', 1356, undefined, 5),
  fallback('hotel', 'fb-h2', 'Stay', 'Kimpton Hotel Palomar Philadelphia',    'PHL · 3 nights',  867, undefined, 4),
  fallback('hotel', 'fb-h3', 'Stay', 'Philadelphia Marriott Downtown',        'PHL · 3 nights',  774, undefined, 4),
  fallback('hotel', 'fb-h4', 'Stay', 'Hyatt Centric Center City',             'PHL · 3 nights',  912, undefined, 4),
  fallback('hotel', 'fb-h5', 'Stay', 'Canopy by Hilton Philadelphia',         'PHL · 3 nights',  768, undefined, 4),
];

// ── cpp tier chip ────────────────────────────────────────────────────────────
// Stable dark hue from an airline code, used for the fallback square when no logo loads.
function codeColor(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360;
  return `hsl(${h} 52% 30%)`;
}

// Square brand logo (airline or hotel). Falls back to a colored square with the
// brand's 2-letter code when no logo URL is set or the image fails to load.
function BrandIcon({ logoUrl, label }: { logoUrl?: string; label: string }) {
  const [err, setErr] = useState(false);
  const code = (label.replace(/[^a-z]/gi, '') || '?').slice(0, 2).toUpperCase();
  if (logoUrl && !err) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- remote/dynamic photo URL, no remotePatterns configured yet
      <img
        src={logoUrl}
        alt={label}
        width={36}
        height={36}
        loading="lazy"
        onError={() => setErr(true)}
        className="w-9 h-9 rounded-lg object-contain bg-white border border-gray-200 shrink-0"
      />
    );
  }
  return (
    <span
      className="w-9 h-9 rounded-lg grid place-items-center font-mono text-[11px] font-bold text-white shrink-0"
      style={{ background: codeColor(code) }}
    >
      {code}
    </span>
  );
}

function cppChip(cpp: number | undefined, isDark: boolean): { label: string; cls: string } | null {
  if (!cpp) return null;
  const label = `${cpp.toFixed(2)}¢/pt`;
  if (cpp >= 1.8) return { label, cls: 'bg-cv-green-800 text-white' };
  if (cpp >= 1.4) return { label, cls: 'bg-cv-green-800 text-white' };
  return { label, cls: isDark ? 'bg-gph-dark-linesoft text-gph-dark-muted' : 'bg-gray-100 text-gray-500' };
}

// ── Slide card (hook-free — full detail lives in the modal) ──────────────────
function SlideCard({ card, onOpen, isDark, inert }: { card: BoardCard; onOpen: (c: BoardCard) => void; isDark: boolean; inert?: boolean }) {
  const surface = isDark ? 'bg-gph-dark-card border-gph-dark-line' : 'bg-white border-gray-200';
  const muted   = isDark ? 'text-gph-dark-muted' : 'text-gray-500';
  const ink     = isDark ? 'text-gph-dark-ink' : 'text-gray-900';
  const divider = isDark ? 'border-gph-dark-line' : 'border-gray-100';
  const chip = cppChip(card.cpp, isDark);

  return (
    <button
      onClick={() => onOpen(card)}
      tabIndex={inert ? -1 : undefined}
      aria-hidden={inert || undefined}
      className={`w-64 shrink-0 text-left rounded-xl border p-4 mx-1.5 transition-shadow hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-cv-lime-500 ${surface}`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <BrandIcon logoUrl={card.logoUrl} label={card.eyebrow} />
          <span className={`text-[10px] font-mono font-bold uppercase tracking-widest truncate ${muted}`}>
            {card.eyebrow}
          </span>
        </div>
        {chip && <span className={`shrink-0 text-[10px] font-mono font-bold uppercase px-1.5 py-0.5 rounded-md ${chip.cls}`}>{chip.label}</span>}
      </div>

      <div className={`mt-2.5 text-[15px] font-bold leading-tight truncate ${ink}`}>{card.title}</div>
      <div className="text-[11px] font-mono mt-1 truncate flex items-center gap-1.5">
        {card.stars ? <span className="text-amber-400 tracking-tight shrink-0">{'★'.repeat(card.stars)}</span> : null}
        <span className={`truncate ${muted}`}>{card.subtitle}</span>
      </div>

      <div className={`mt-3 pt-3 border-t grid grid-cols-2 gap-2 ${divider}`}>
        <div>
          <div className={`text-[10px] font-mono font-bold uppercase tracking-widest ${muted}`}>Points</div>
          <div className={`font-mono text-base font-bold leading-none mt-1 ${card.pointsNeeded ? ink : muted}`}>
            {card.pointsNeeded ? card.pointsNeeded.toLocaleString() : '—'}
          </div>
        </div>
        <div className="text-right">
          <div className={`text-[10px] font-mono font-bold uppercase tracking-widest ${muted}`}>Cash</div>
          <div className={`font-mono text-base font-bold leading-none mt-1 ${ink}`}>
            ${card.priceUsd.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </div>
        </div>
      </div>

      <div className={`mt-3 text-right text-xs font-bold ${isDark ? 'text-cv-lime-400' : 'text-cv-lime-700'}`}>Compare portals →</div>
    </button>
  );
}

// ── Continuous marquee (fills width by repeating, seamless -50% loop) ─────────
function Marquee({ cards, onOpen, isDark }: { cards: BoardCard[]; onOpen: (c: BoardCard) => void; isDark: boolean }) {
  // Repeat the base set so the track is wide enough to loop without gaps.
  const MIN = 10;
  const filled = Array.from({ length: Math.max(MIN, cards.length) }, (_, i) => cards[i % cards.length]);
  const durationSec = Math.max(30, filled.length * 5);

  const half = (aria: boolean) => (
    <div className="flex" aria-hidden={aria || undefined}>
      {filled.map((c, i) => (
        <SlideCard key={`${c.id}-${i}`} card={c} onOpen={onOpen} isDark={isDark} inert={aria} />
      ))}
    </div>
  );

  return (
    <div className="tk-mask tk-paused overflow-hidden py-1">
      <div className="tk-track" style={{ animationDuration: `${durationSec}s` }}>
        {half(false)}
        {half(true)}
      </div>
    </div>
  );
}

// ── Board ────────────────────────────────────────────────────────────────────
export function SearchBoard({ items, loading }: { items: BoardCard[]; loading?: boolean }) {
  const { isDark } = useTheme();
  const [selected, setSelected] = useState<BoardCard | null>(null);
  const muted = isDark ? 'text-gph-dark-muted' : 'text-gray-600';
  const dashed = isDark ? 'border-gph-dark-line' : 'border-gray-300';
  const panel = isDark ? 'bg-gph-dark-bg border-gph-dark-line' : 'bg-white border-gray-200';
  const ink   = isDark ? 'text-gph-dark-ink' : 'text-gray-900';

  const result = usePointsCalc(
    selected?.priceUsd ?? 0,
    selected?.kind ?? 'hotel',
    selected?.flightCtx,
    selected?.portalPrices,
    selected?.hotelChain,
  );

  if (loading) {
    return <div className={`py-14 text-center text-sm font-mono tracking-widest ${muted}`}>LOADING LIVE BOARD…</div>;
  }
  if (items.length === 0) {
    return (
      <div className={`py-12 text-center text-sm font-mono tracking-widest rounded-xl border border-dashed ${dashed} ${muted}`}>
        NO EXAMPLES AVAILABLE RIGHT NOW
      </div>
    );
  }

  return (
    <>
      <Marquee cards={items} onOpen={setSelected} isDark={isDark} />
      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4"
          onClick={() => setSelected(null)}
        >
          <div
            className={`w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-xl border shadow-xl p-6 ${panel}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <div className={`text-base font-bold ${ink}`}>{selected.title}</div>
                <div className={`text-xs ${muted}`}>{selected.subtitle}</div>
              </div>
              <button onClick={() => setSelected(null)} className={`text-2xl leading-none min-h-11 min-w-11 ${muted}`} aria-label="Close">×</button>
            </div>
            {result ? (
              <PointsGrid result={result} itemName={selected.title} itemMeta={selected.subtitle} />
            ) : (
              <p className={`text-sm ${muted}`}>Points comparison unavailable for this option.</p>
            )}
          </div>
        </div>
      )}
    </>
  );
}
