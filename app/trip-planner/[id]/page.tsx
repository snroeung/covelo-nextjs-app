'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useTheme } from '@/contexts/ThemeContext';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useTrips } from '@/hooks/useTrips';
import { useBookmarks } from '@/hooks/useBookmarks';
import { FlightCard } from '@/components/FlightCard';
import { HotelCard } from '@/components/HotelCard';
import type { Trip } from '@/lib/trips';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDateRange(start: string, end: string): string {
  const fmt = (s: string) =>
    new Date(s + 'T00:00:00').toLocaleDateString([], {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  return `${fmt(start)} – ${fmt(end)}`;
}

function nightsBetween(start: string, end: string): number {
  return Math.round(
    (new Date(end + 'T00:00:00').getTime() - new Date(start + 'T00:00:00').getTime()) /
      (1000 * 60 * 60 * 24),
  );
}

// ─── Traveler Avatars ─────────────────────────────────────────────────────────

function TravelerAvatars({ trip, isDark }: { trip: Trip; isDark: boolean }) {
  const { adults, children, pets } = trip.travelers;
  const total = adults + children;

  // Show up to 4 adult circles, then a +N overflow badge
  const MAX_SHOWN = 4;
  const shown = Math.min(adults, MAX_SHOWN);
  const overflow = adults > MAX_SHOWN ? adults - MAX_SHOWN : 0;

  const ringCls   = isDark ? 'ring-cv-blue-950' : 'ring-white';
  const ghostBg   = isDark ? 'bg-cv-blue-800 text-cv-blue-400' : 'bg-cv-blue-100 text-cv-blue-400';
  const overflowBg = isDark ? 'bg-cv-blue-700 text-cv-blue-300' : 'bg-cv-blue-200 text-cv-blue-600';
  const labelCls  = isDark ? 'text-cv-blue-400' : 'text-cv-blue-500';

  return (
    <div className="flex items-center gap-3">
      {/* Avatar stack */}
      <div className="flex items-center">
        {Array.from({ length: shown }).map((_, i) => (
          <div
            key={i}
            className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold ring-2 ${ringCls} ${
              i === 0
                ? 'bg-cv-blue-600 text-white z-10'
                : `${ghostBg} ${i === 1 ? 'z-[9]' : i === 2 ? 'z-[8]' : 'z-[7]'}`
            } ${i > 0 ? '-ml-2' : ''}`}
          >
            {i === 0 ? (
              // "You" — person icon
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 12a4 4 0 100-8 4 4 0 000 8zm0 2c-5.33 0-8 2.67-8 4v1h16v-1c0-1.33-2.67-4-8-4z" />
              </svg>
            ) : (
              // Guest slot — outlined person icon
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.5 20.25a8.25 8.25 0 0115 0" />
              </svg>
            )}
          </div>
        ))}

        {/* +N overflow */}
        {overflow > 0 && (
          <div className={`w-8 h-8 -ml-2 rounded-full flex items-center justify-center text-xs font-semibold ring-2 ${ringCls} ${overflowBg}`}>
            +{overflow}
          </div>
        )}

        {/* Children badge */}
        {children > 0 && (
          <div className={`w-8 h-8 -ml-2 rounded-full flex items-center justify-center ring-2 ${ringCls} ${ghostBg}`}
            title={`${children} child${children !== 1 ? 'ren' : ''}`}>
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M12 11a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 0114 0" />
              <circle cx="12" cy="5" r="1.5" fill="currentColor" />
            </svg>
          </div>
        )}

        {/* Pets badge */}
        {pets > 0 && (
          <div className={`w-8 h-8 -ml-2 rounded-full flex items-center justify-center ring-2 ${ringCls} ${ghostBg}`}
            title={`${pets} pet${pets !== 1 ? 's' : ''}`}>
            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M4.5 11a2 2 0 100-4 2 2 0 000 4zm15 0a2 2 0 100-4 2 2 0 000 4zM7.5 7a2 2 0 100-4 2 2 0 000 4zm9 0a2 2 0 100-4 2 2 0 000 4zm-4.25 3.5c-3.03 0-5.5 2-5.5 4.5 0 1.5.75 2.5 2 3 .5.2 1.5.5 3.5.5s3-.3 3.5-.5c1.25-.5 2-1.5 2-3 0-2.5-2.47-4.5-5.5-4.5z" />
            </svg>
          </div>
        )}
      </div>

      {/* Summary label */}
      <span className={`text-sm ${labelCls}`}>
        {total} {total === 1 ? 'traveler' : 'travelers'}
        {pets > 0 ? ` · ${pets} pet${pets !== 1 ? 's' : ''}` : ''}
      </span>
    </div>
  );
}

// ─── Section empty state ──────────────────────────────────────────────────────

function SectionPlaceholder({
  label,
  isDark,
}: {
  label: string;
  isDark: boolean;
}) {
  return (
    <div
      className={`rounded-xl border-2 border-dashed flex items-center justify-center py-14 ${
        isDark ? 'border-cv-blue-800' : 'border-cv-blue-200'
      }`}
    >
      <p className={`text-sm ${isDark ? 'text-cv-blue-600' : 'text-cv-blue-300'}`}>{label}</p>
    </div>
  );
}

// ─── Section header ───────────────────────────────────────────────────────────

function SectionHeader({
  icon,
  title,
  searchHref,
  isDark,
}: {
  icon: React.ReactNode;
  title: string;
  searchHref: string;
  isDark: boolean;
}) {
  return (
    <div className="flex items-center justify-between mb-3">
      <div className="flex items-center gap-2">
        <span className={isDark ? 'text-cv-blue-400' : 'text-cv-blue-500'}>{icon}</span>
        <h2 className={`text-base font-semibold ${isDark ? 'text-white' : 'text-cv-blue-950'}`}>{title}</h2>
      </div>
      <Link
        href={searchHref}
        className={`text-sm transition-colors ${isDark ? 'text-cv-blue-400 hover:text-cv-blue-200' : 'text-cv-blue-500 hover:text-cv-blue-700'}`}
      >
        search bookings →
      </Link>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TripDetailPage() {
  const { isDark } = useTheme();
  const params = useParams();
  const { trips } = useTrips();
  const tripId = params.id as string;
  const { flights, hotels } = useBookmarks(tripId);

  const trip: Trip | undefined = trips.find((t) => t.id === tripId);

  const pageBg    = isDark ? 'bg-cv-blue-950' : 'bg-cv-blue-50';
  const surfaceBg = isDark ? 'bg-cv-blue-950' : 'bg-white';
  const borderCls = isDark ? 'border-cv-blue-900' : 'border-cv-blue-100';
  const cardBg    = isDark ? 'bg-cv-blue-900 border-cv-blue-800' : 'bg-white border-cv-blue-100';
  const pillBg    = isDark ? 'bg-cv-blue-800 text-cv-blue-300' : 'bg-cv-blue-50 text-cv-blue-600';

  function navLinkCls(href: string) {
    const base = 'px-4 py-1.5 rounded-lg text-sm font-medium transition-colors';
    return isDark
      ? `${base} text-cv-blue-400 hover:text-white`
      : `${base} text-cv-blue-600 hover:text-cv-blue-950`;
  }

  // ── Loading / not-found state (SSR hydration gap) ──────────────────────────
  if (!trip && trips.length === 0) {
    // Still hydrating from localStorage — render nothing to avoid flash
    return <div className={`h-screen ${pageBg}`} />;
  }

  if (!trip) {
    return (
      <div className={`flex flex-col h-screen font-sans ${pageBg}`}>
        <nav className={`flex items-center gap-4 px-6 py-3 border-b ${surfaceBg} ${borderCls}`}>
          <Link href="/trip-planner" className={`text-sm font-medium ${isDark ? 'text-cv-blue-400 hover:text-white' : 'text-cv-blue-600 hover:text-cv-blue-950'}`}>
            ← Trip Planner
          </Link>
        </nav>
        <div className="flex flex-1 items-center justify-center">
          <p className={`text-sm ${isDark ? 'text-cv-blue-400' : 'text-cv-blue-400'}`}>Trip not found.</p>
        </div>
      </div>
    );
  }

  const nights = nightsBetween(trip.start_date, trip.end_date);

  return (
    <div className={`flex flex-col h-screen overflow-hidden font-sans ${pageBg}`}>

      {/* Nav */}
      <nav className={`flex items-center gap-4 px-4 md:px-6 py-3 border-b shrink-0 ${surfaceBg} ${borderCls}`}>
        <span className={`text-lg font-bold tracking-tight ${isDark ? 'text-white' : 'text-cv-blue-950'}`}>
          covelo<span className="text-cv-blue-400">.</span>
        </span>
        <div className="flex items-center gap-1">
          <Link href="/"             className={navLinkCls('/')}>Flights</Link>
          <Link href="/hotels"       className={navLinkCls('/hotels')}>Hotels</Link>
          <Link href="/trip-planner" className={navLinkCls('/trip-planner')}>Trip Planner</Link>
        </div>
        <div className="ml-auto">
          <ThemeToggle />
        </div>
      </nav>

      {/* Scrollable body */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-4 py-8 flex flex-col gap-8">

          {/* ── Back ──────────────────────────────────────────────────── */}
          <Link
            href="/trip-planner"
            className={`self-start flex items-center gap-1.5 text-sm font-medium transition-colors ${isDark ? 'text-cv-blue-400 hover:text-white' : 'text-cv-blue-600 hover:text-cv-blue-950'}`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Trip Planner
          </Link>

          {/* ── Hero ──────────────────────────────────────────────────── */}
          <div className={`rounded-2xl border p-6 flex flex-col gap-5 ${cardBg}`}>

            {/* Title */}
            <h1 className={`text-2xl md:text-3xl font-bold tracking-tight ${isDark ? 'text-white' : 'text-cv-blue-950'}`}>
              {trip.title}
            </h1>

            {/* Destination + pills */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Destination */}
              <span className={`flex items-center gap-1.5 text-sm px-3 py-1 rounded-full ${pillBg}`}>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round"
                    d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z" />
                </svg>
                {trip.destination.split(',')[0]}
              </span>
              {/* Dates */}
              <span className={`flex items-center gap-1.5 text-sm px-3 py-1 rounded-full ${pillBg}`}>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round"
                    d="M8 7V3m8 4V3M3 11h18M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                {formatDateRange(trip.start_date, trip.end_date)}
              </span>
              {/* Nights */}
              <span className={`text-sm px-3 py-1 rounded-full ${pillBg}`}>
                {nights} night{nights !== 1 ? 's' : ''}
              </span>
            </div>

            {/* Divider */}
            <div className={`border-t ${isDark ? 'border-cv-blue-800' : 'border-cv-blue-100'}`} />

            {/* Traveler avatars + invite */}
            <div className="flex items-center justify-between gap-4">
              <TravelerAvatars trip={trip} isDark={isDark} />
              <button
                className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                  isDark
                    ? 'border-cv-blue-700 text-cv-blue-300 hover:bg-cv-blue-800'
                    : 'border-cv-blue-200 text-cv-blue-600 hover:bg-cv-blue-50'
                }`}
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round"
                    d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                </svg>
                Invite
              </button>
            </div>
          </div>

          {/* ── Flights ───────────────────────────────────────────────── */}
          <section>
            <SectionHeader
              isDark={isDark}
              title="Flights"
              searchHref={`/?destination=${encodeURIComponent(trip.destination)}&departDate=${trip.start_date}&returnDate=${trip.end_date}&tripType=roundtrip`}
              icon={
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round"
                    d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                </svg>
              }
            />
            {flights.length === 0 ? (
              <SectionPlaceholder label="No flights saved yet — heart a flight from the search" isDark={isDark} />
            ) : (
              <div className="space-y-3">
                {flights.map((bm) => (
                  <FlightCard key={bm.id} offer={bm.data} defaultCollapsed />
                ))}
              </div>
            )}
          </section>

          {/* ── Hotels ────────────────────────────────────────────────── */}
          <section>
            <SectionHeader
              isDark={isDark}
              title="Hotels"
              searchHref={`/hotels?destination=${encodeURIComponent(trip.destination)}&lat=${trip.destination_lat ?? ''}&lng=${trip.destination_lng ?? ''}&checkIn=${trip.start_date}&checkOut=${trip.end_date}&adults=${trip.travelers.adults}&children=${trip.travelers.children}`}
              icon={
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round"
                    d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" />
                </svg>
              }
            />
            {hotels.length === 0 ? (
              <SectionPlaceholder label="No hotels saved yet — heart a hotel from the search" isDark={isDark} />
            ) : (
              <div className="space-y-3">
                {hotels.map((bm) => (
                  <HotelCard key={bm.id} searchResult={bm.data} defaultCollapsed />
                ))}
              </div>
            )}
          </section>

        </div>
      </main>

    </div>
  );
}
