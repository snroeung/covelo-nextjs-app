'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { LocationSearch } from '@/components/LocationSearch';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useTheme } from '@/contexts/ThemeContext';
import { useTrips } from '@/hooks/useTrips';
import type { SelectedPlace } from '@/components/LocationSearch';
import type { Trip, TripTravelers } from '@/lib/trips';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDateRange(start: string, end: string): string {
  const fmt = (s: string) =>
    new Date(s + 'T00:00:00').toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
  return `${fmt(start)} – ${fmt(end)}`;
}

function nightsBetween(start: string, end: string): number {
  return Math.round(
    (new Date(end + 'T00:00:00').getTime() - new Date(start + 'T00:00:00').getTime()) /
      (1000 * 60 * 60 * 24),
  );
}

function travelerSummary(t: TripTravelers): string {
  const parts = [
    `${t.adults} adult${t.adults !== 1 ? 's' : ''}`,
    t.children > 0 ? `${t.children} child${t.children !== 1 ? 'ren' : ''}` : '',
    t.pets > 0 ? `${t.pets} pet${t.pets !== 1 ? 's' : ''}` : '',
  ];
  return parts.filter(Boolean).join(' · ');
}

// ─── TripCard ─────────────────────────────────────────────────────────────────

function TripCard({ trip, onDelete, isDark }: { trip: Trip; onDelete: () => void; isDark: boolean }) {
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(true);

  const cardBg      = isDark ? 'bg-cv-blue-900' : 'bg-white border border-cv-blue-100';
  const divider     = isDark ? 'border-cv-blue-800' : 'border-cv-blue-100';
  const textPrimary = isDark ? 'text-white' : 'text-cv-blue-950';
  const textMuted   = isDark ? 'text-cv-blue-400' : 'text-cv-blue-400';
  const pillBg      = isDark ? 'bg-cv-blue-800 text-cv-blue-300' : 'bg-cv-blue-50 text-cv-blue-600';

  const nights = nightsBetween(trip.start_date, trip.end_date);

  return (
    <div className={`rounded-xl overflow-hidden ${cardBg}`}>

      {/* Header row — click to expand */}
      <button
        onClick={() => setCollapsed(v => !v)}
        className={`w-full flex items-center justify-between gap-4 px-5 py-4 text-left ${collapsed ? '' : `border-b ${divider}`}`}
      >
        <div className="flex flex-col gap-0.5 min-w-0">
          <span className={`font-semibold truncate ${textPrimary}`}>{trip.title}</span>
          <span className={`text-sm truncate ${textMuted}`}>{trip.destination.split(',')[0]}</span>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {/* Date pill */}
          <span className={`hidden sm:inline-block text-xs font-medium px-2.5 py-1 rounded-full ${pillBg}`}>
            {formatDateRange(trip.start_date, trip.end_date)}
          </span>
          {/* Nights pill */}
          <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${pillBg}`}>
            {nights}n
          </span>
          {/* Chevron */}
          <svg
            className={`w-4 h-4 transition-transform shrink-0 ${textMuted} ${collapsed ? '' : 'rotate-180'}`}
            fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* Expanded body */}
      {!collapsed && (
        <div className="px-5 py-4 space-y-4">

          {/* Detail rows */}
          <div className="grid grid-cols-2 gap-x-6 gap-y-3">
            <div>
              <p className={`text-[10px] font-semibold uppercase tracking-widest mb-0.5 ${isDark ? 'text-cv-blue-300' : 'text-cv-blue-900'}`}>
                Destination
              </p>
              <p className={`text-sm ${textPrimary}`}>{trip.destination}</p>
            </div>
            <div>
              <p className={`text-[10px] font-semibold uppercase tracking-widest mb-0.5 ${isDark ? 'text-cv-blue-300' : 'text-cv-blue-900'}`}>
                Dates
              </p>
              <p className={`text-sm ${textPrimary}`}>{formatDateRange(trip.start_date, trip.end_date)}</p>
            </div>
            <div>
              <p className={`text-[10px] font-semibold uppercase tracking-widest mb-0.5 ${isDark ? 'text-cv-blue-300' : 'text-cv-blue-900'}`}>
                Travelers
              </p>
              <p className={`text-sm ${textPrimary}`}>{travelerSummary(trip.travelers)}</p>
            </div>
            <div>
              <p className={`text-[10px] font-semibold uppercase tracking-widest mb-0.5 ${isDark ? 'text-cv-blue-300' : 'text-cv-blue-900'}`}>
                Duration
              </p>
              <p className={`text-sm ${textPrimary}`}>{nights} night{nights !== 1 ? 's' : ''}</p>
            </div>
          </div>

          {/* Actions */}
          <div className={`flex items-center justify-between pt-3 border-t ${divider}`}>
            <button
              onClick={onDelete}
              className={`text-xs font-medium transition-colors ${isDark ? 'text-cv-blue-400 hover:text-red-400' : 'text-cv-blue-400 hover:text-red-500'}`}
            >
              Delete trip
            </button>
            <button
              onClick={() => router.push(`/trip-planner/${trip.id}`)}
              className="px-4 py-1.5 rounded-lg bg-cv-blue-600 hover:bg-cv-blue-500 text-white text-xs font-semibold transition-colors"
            >
              Plan itinerary →
            </button>
          </div>

        </div>
      )}
    </div>
  );
}

// ─── Stepper ──────────────────────────────────────────────────────────────────

function Stepper({
  label, sub, value, min = 0, max = 20, onChange, isDark,
}: {
  label: string; sub: string; value: number; min?: number; max?: number;
  onChange: (v: number) => void; isDark: boolean;
}) {
  const btnBase = 'w-7 h-7 rounded-full border text-sm font-semibold flex items-center justify-center transition-colors';
  const btnActive = isDark
    ? 'border-cv-blue-600 text-cv-blue-300 hover:bg-cv-blue-800'
    : 'border-cv-blue-500 text-cv-blue-600 hover:bg-cv-blue-50';
  const btnDisabled = isDark
    ? 'border-cv-blue-900 text-cv-blue-700 cursor-not-allowed'
    : 'border-cv-blue-100 text-cv-blue-300 cursor-not-allowed';

  return (
    <div className="flex items-center justify-between gap-4 py-2.5">
      <div>
        <p className={`text-sm font-medium ${isDark ? 'text-white' : 'text-cv-blue-950'}`}>{label}</p>
        <p className={`text-xs text-cv-blue-400`}>{sub}</p>
      </div>
      <div className="flex items-center gap-3">
        <button type="button" onClick={() => onChange(value - 1)} disabled={value <= min}
          className={`${btnBase} ${value <= min ? btnDisabled : btnActive}`}>−</button>
        <span className={`w-4 text-center text-sm font-semibold ${isDark ? 'text-white' : 'text-cv-blue-950'}`}>{value}</span>
        <button type="button" onClick={() => onChange(value + 1)} disabled={value >= max}
          className={`${btnBase} ${value >= max ? btnDisabled : btnActive}`}>+</button>
      </div>
    </div>
  );
}

function SectionLabel({ children, isDark }: { children: React.ReactNode; isDark: boolean }) {
  return (
    <p className={`text-[10px] font-semibold uppercase tracking-widest mb-2 ${isDark ? 'text-cv-blue-300' : 'text-cv-blue-900'}`}>
      {children}
    </p>
  );
}

// ─── Location matching ────────────────────────────────────────────────────────

// Splits a Google Places description into meaningful parts and returns those
// with enough characters to be useful for comparison (avoids matching "US", "NY").
function locationParts(description: string): string[] {
  return description
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s.length > 3);
}

function findMatchingTrips(selected: SelectedPlace, trips: Trip[]): Trip[] {
  const selectedParts = locationParts(selected.description);
  return trips.filter((trip) => {
    const tripParts = locationParts(trip.destination);
    return selectedParts.some((sp) => tripParts.some((tp) => tp === sp));
  });
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function TripPlannerPage() {
  const { isDark } = useTheme();
  const pathname = usePathname();
  const { trips, addTrip, removeTrip } = useTrips();

  // New-trip form state
  const [destination, setDestination] = useState<SelectedPlace | null>(null);
  const [startDate, setStartDate]     = useState('');
  const [endDate, setEndDate]         = useState('');
  const [travelers, setTravelers]     = useState<TripTravelers>({ adults: 1, children: 0, pets: 0 });
  const [title, setTitle]             = useState('');
  // Incremented on save to force-remount LocationSearch and clear its internal input
  const [searchKey, setSearchKey]     = useState(0);
  // Trips that overlap with the selected destination
  const [dupeTrips, setDupeTrips]     = useState<Trip[]>([]);

  const showCard   = destination !== null && dupeTrips.length === 0;
  const showWarning = destination !== null && dupeTrips.length > 0;
  const today      = new Date().toISOString().split('T')[0];

  function handleDestinationSelect(place: SelectedPlace) {
    const matches = findMatchingTrips(place, trips);
    setDestination(place);
    setDupeTrips(matches);
    if (matches.length === 0) {
      setTitle(`Trip to ${place.description.split(',')[0].trim()}`);
    }
  }

  function handleDestinationClear() {
    setDestination(null);
    setDupeTrips([]);
    setStartDate('');
    setEndDate('');
    setTitle('');
  }

  function handleBack() {
    handleDestinationClear();
    setSearchKey((k) => k + 1); // force-remount to clear the input text
  }

  function handleIgnoreWarning() {
    if (!destination) return;
    setDupeTrips([]);
    setTitle(`Trip to ${destination.description.split(',')[0].trim()}`);
  }

  function handleStartDate(v: string) {
    setStartDate(v);
    if (endDate && endDate < v) setEndDate('');
  }

  function handleSave() {
    if (!destination || !startDate || !endDate) return;
    addTrip({
      title: title.trim() || `Trip to ${destination.description.split(',')[0].trim()}`,
      destination: destination.description,
      destination_place_id: undefined,
      destination_lat: destination.latitude || undefined,
      destination_lng: destination.longitude || undefined,
      start_date: startDate,
      end_date: endDate,
      travelers,
    });
    // Reset everything and force the search input to clear
    setDestination(null);
    setDupeTrips([]);
    setStartDate('');
    setEndDate('');
    setTitle('');
    setTravelers({ adults: 1, children: 0, pets: 0 });
    setSearchKey((k) => k + 1);
  }

  // Style helpers
  const pageBg    = isDark ? 'bg-cv-blue-950' : 'bg-cv-blue-50';
  const surfaceBg = isDark ? 'bg-cv-blue-950' : 'bg-white';
  const cardBg    = isDark ? 'bg-cv-blue-900 border-cv-blue-800' : 'bg-white border-cv-blue-100';
  const borderCls = isDark ? 'border-cv-blue-900' : 'border-cv-blue-100';
  const divider   = isDark ? 'border-cv-blue-800' : 'border-cv-blue-100';
  const inputCls  = isDark
    ? 'border-cv-blue-900 bg-cv-blue-950 text-white placeholder:text-cv-blue-400/60 focus:ring-cv-blue-600'
    : 'border-cv-blue-100 bg-white text-cv-blue-950 placeholder:text-cv-blue-400 focus:ring-cv-blue-600';

  function navLinkCls(href: string) {
    const active = pathname === href;
    const base   = 'px-4 py-1.5 rounded-lg text-sm font-medium transition-colors';
    if (active) return `${base} bg-cv-blue-600 text-white`;
    return isDark
      ? `${base} text-cv-blue-400 hover:text-white`
      : `${base} text-cv-blue-600 hover:text-cv-blue-950`;
  }

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
      <main className="flex flex-1 flex-col items-center overflow-y-auto px-4 py-12">
        <div className="w-full max-w-lg flex flex-col gap-6">

          {/* ── New trip form ──────────────────────────────────────────── */}
          <div className="flex flex-col items-center gap-6">

            {/* Heading — hidden once a destination is chosen */}
            {!showCard && (
              <h1 className={`text-4xl md:text-5xl font-bold text-center tracking-tight ${isDark ? 'text-white' : 'text-cv-blue-950'}`}>
                Where is your next adventure?
              </h1>
            )}

            {/* Back button — visible once a destination is selected */}
            {destination && (
              <button
                onClick={handleBack}
                className={`self-start flex items-center gap-1.5 text-sm font-medium transition-colors ${isDark ? 'text-cv-blue-400 hover:text-white' : 'text-cv-blue-600 hover:text-cv-blue-950'}`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
                Back
              </button>
            )}

            {/* Destination search */}
            <div className="w-full">
              <LocationSearch
                key={searchKey}
                placeholder="Search a destination…"
                onSelect={handleDestinationSelect}
                onClear={handleDestinationClear}
              />
            </div>

            {/* Duplicate-destination warning */}
            {showWarning && (
              <div className="w-full flex flex-col gap-3">
                <div className={`rounded-xl px-4 py-3 flex items-start gap-3 ${isDark ? 'bg-cv-amber-900/40 border border-cv-amber-700/40' : 'bg-cv-amber-50 border border-cv-amber-200'}`}>
                  <svg className={`w-4 h-4 mt-0.5 shrink-0 ${isDark ? 'text-cv-amber-300' : 'text-cv-amber-700'}`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                  </svg>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium ${isDark ? 'text-cv-amber-300' : 'text-cv-amber-900'}`}>
                      You already have {dupeTrips.length === 1 ? 'a trip' : 'trips'} in this area
                    </p>
                    <p className={`text-xs mt-0.5 ${isDark ? 'text-cv-amber-400' : 'text-cv-amber-700'}`}>
                      Continue planning an existing trip, or create a new one anyway.
                    </p>
                  </div>
                  <button
                    onClick={handleIgnoreWarning}
                    className={`shrink-0 text-xs font-medium underline underline-offset-2 ${isDark ? 'text-cv-amber-300 hover:text-cv-amber-200' : 'text-cv-amber-900 hover:text-cv-amber-700'}`}
                  >
                    Create anyway
                  </button>
                </div>

                {dupeTrips.map((trip) => (
                  <TripCard
                    key={trip.id}
                    trip={trip}
                    onDelete={() => {
                      removeTrip(trip.id);
                      setDupeTrips((prev) => {
                        const next = prev.filter((t) => t.id !== trip.id);
                        // All dupes removed → proceed to creation form
                        if (next.length === 0 && destination) {
                          setTitle(`Trip to ${destination.description.split(',')[0].trim()}`);
                        }
                        return next;
                      });
                    }}
                    isDark={isDark}
                  />
                ))}
              </div>
            )}

            {/* Trip creation card */}
            {showCard && (
              <div className={`w-full rounded-2xl border shadow-sm overflow-hidden ${cardBg}`}>

                {/* Dates */}
                <div className="px-5 pt-5 pb-4">
                  <SectionLabel isDark={isDark}>Dates</SectionLabel>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-0.5">
                      <label className={`text-[10px] font-semibold uppercase tracking-widest px-1 ${isDark ? 'text-cv-blue-300' : 'text-cv-blue-900'}`}>
                        Start
                      </label>
                      <input type="date" value={startDate} min={today}
                        onChange={(e) => handleStartDate(e.target.value)}
                        className={`rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 ${inputCls} ${isDark ? 'scheme-dark' : 'scheme-light'}`}
                      />
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <label className={`text-[10px] font-semibold uppercase tracking-widest px-1 ${isDark ? 'text-cv-blue-300' : 'text-cv-blue-900'}`}>
                        End
                      </label>
                      <input type="date" value={endDate} min={startDate || today}
                        onChange={(e) => setEndDate(e.target.value)}
                        className={`rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 ${inputCls} ${isDark ? 'scheme-dark' : 'scheme-light'}`}
                      />
                    </div>
                  </div>
                </div>

                {/* Travelers */}
                <div className={`border-t ${divider}`} />
                <div className="px-5 py-4">
                  <SectionLabel isDark={isDark}>Travelers</SectionLabel>
                  <div className={`divide-y ${isDark ? 'divide-cv-blue-800' : 'divide-cv-blue-100'}`}>
                    <Stepper label="Adults" sub="Age 18+" value={travelers.adults} min={1} max={20}
                      onChange={(v) => setTravelers((t) => ({ ...t, adults: v }))} isDark={isDark} />
                    <Stepper label="Children" sub="Ages 0–17" value={travelers.children} min={0} max={20}
                      onChange={(v) => setTravelers((t) => ({ ...t, children: v }))} isDark={isDark} />
                    <Stepper label="Pets" sub="Dogs, cats & more" value={travelers.pets} min={0} max={10}
                      onChange={(v) => setTravelers((t) => ({ ...t, pets: v }))} isDark={isDark} />
                  </div>
                </div>

                {/* Trip name */}
                <div className={`border-t ${divider}`} />
                <div className="px-5 py-4">
                  <SectionLabel isDark={isDark}>Trip name</SectionLabel>
                  <input type="text" value={title} onChange={(e) => setTitle(e.target.value)}
                    placeholder="Give your trip a name…"
                    className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 ${inputCls}`}
                  />
                </div>

                {/* Save */}
                <div className={`border-t px-5 py-4 flex justify-end ${divider}`}>
                  <button type="button" onClick={handleSave} disabled={!startDate || !endDate}
                    className="px-6 py-2.5 rounded-xl bg-cv-blue-600 hover:bg-cv-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors"
                  >
                    Save trip
                  </button>
                </div>

              </div>
            )}
          </div>

          {/* ── Existing trips ─────────────────────────────────────────── */}
          {trips.length > 0 && !showCard && (
            <div className="flex flex-col gap-4">
              <p className={`text-sm text-center ${isDark ? 'text-cv-blue-400' : 'text-cv-blue-400'}`}>
                Or continue planning an existing trip
              </p>
              <div className="flex flex-col gap-3">
                {trips.map((trip) => (
                  <TripCard
                    key={trip.id}
                    trip={trip}
                    onDelete={() => removeTrip(trip.id)}
                    isDark={isDark}
                  />
                ))}
              </div>
            </div>
          )}

        </div>
      </main>

    </div>
  );
}
