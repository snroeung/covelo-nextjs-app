'use client';

import Link from 'next/link';
import { Fragment, useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { useTheme } from '@/contexts/ThemeContext';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useTrips } from '@/hooks/useTrips';
import { useBookmarks } from '@/hooks/useBookmarks';
import { FlightCard } from '@/components/FlightCard';
import { HotelCard } from '@/components/HotelCard';
import { LocationSearch, type SelectedPlace } from '@/components/LocationSearch';
import type { GuestsValue } from '@/components/GuestsDropdown';
import { TripMap } from '@/components/TripMap';
import type { Trip, TripTravelers } from '@/lib/trips';
import { trpc } from '@/lib/trpc-client';

// ─── Stepper (inline travelers editor) ───────────────────────────────────────

function Stepper({
  label,
  sub,
  value,
  min = 0,
  max = 20,
  onChange,
  isDark,
}: {
  label: string;
  sub: string;
  value: number;
  min?: number;
  max?: number;
  onChange: (v: number) => void;
  isDark: boolean;
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
        <p className="text-xs text-cv-blue-400">{sub}</p>
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

// Returns one ISO date string per day from start through end (inclusive)
function tripDays(start: string, end: string): string[] {
  const days: string[] = [];
  const cur = new Date(start + 'T00:00:00');
  const last = new Date(end + 'T00:00:00');
  while (cur <= last) {
    days.push(cur.toISOString().slice(0, 10));
    cur.setDate(cur.getDate() + 1);
  }
  return days;
}

function formatDayLabel(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString([], {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });
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

type EditField = 'title' | 'destination' | 'dates' | 'travelers' | null;

export default function TripDetailPage() {
  const { isDark } = useTheme();
  const params = useParams();
  const { trips, updateTrip, addActivity, patchActivity, removeActivity, assignActivityToDay, removeActivityFromDay, patchItineraryActivity, reorderActivityInDay, moveActivityToDay } = useTrips();
  const tripId = params.id as string;
  const { flights, hotels } = useBookmarks(tripId);

  const trip: Trip | undefined = trips.find((t) => t.id === tripId);

  // ── Map state ──────────────────────────────────────────────────────────────
  const [mapMinimized, setMapMinimized] = useState(false);

  // ── Activity menu state ─────────────────────────────────────────────────────
  const [openMenuId, setOpenMenuId]       = useState<string | null>(null);
  const [openSubmenuId, setOpenSubmenuId] = useState<string | null>(null);
  // Keys: `a.id` for Things to Do, `${date}::${a.id}` for itinerary
  const [expandedNotes, setExpandedNotes] = useState<Set<string>>(new Set());

  function toggleNotes(key: string) {
    setExpandedNotes((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  // ── Itinerary drag-and-drop ──────────────────────────────────────────────────
  const [dragState, setDragState] = useState<{ sourceDate: string; activityId: string; sourceIndex: number } | null>(null);
  const [dropTarget, setDropTarget] = useState<{ date: string; index: number } | null>(null);

  function handleDrop(targetDate: string, targetIndex: number) {
    if (!dragState || !trip) return;
    const { sourceDate, activityId, sourceIndex } = dragState;
    if (sourceDate === targetDate) {
      // Drop on self or adjacent slot — no-op
      if (targetIndex !== sourceIndex && targetIndex !== sourceIndex + 1) {
        reorderActivityInDay(trip.id, sourceDate, sourceIndex, targetIndex);
      }
    } else {
      moveActivityToDay(trip.id, sourceDate, targetDate, activityId, targetIndex);
    }
    setDragState(null);
    setDropTarget(null);
  }

  // ── Edit state ─────────────────────────────────────────────────────────────
  const [editField, setEditField] = useState<EditField>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editStart, setEditStart] = useState('');
  const [editEnd,   setEditEnd]   = useState('');
  const [editTravelers, setEditTravelers] = useState<GuestsValue>({ adults: 1, children: 0, pets: 0 });
  const titleInputRef   = useRef<HTMLInputElement>(null);
  const datesRef        = useRef<HTMLDivElement>(null);
  const travelersRef    = useRef<HTMLDivElement>(null);
  const destinationRef  = useRef<HTMLDivElement>(null);

  // ── Sidebar scroll-spy ──────────────────────────────────────────────────────
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const tripInfoRef        = useRef<HTMLDivElement>(null);
  const itineraryRef       = useRef<HTMLElement>(null);
  const activitiesRef      = useRef<HTMLElement>(null);
  const flightsRef         = useRef<HTMLElement>(null);
  const hotelsRef          = useRef<HTMLElement>(null);
  const [activeSection, setActiveSection] = useState<'trip-info' | 'itinerary' | 'activities' | 'flights' | 'hotels'>('trip-info');

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const refs = [
      { id: 'trip-info'  as const, el: tripInfoRef.current },
      { id: 'itinerary'  as const, el: itineraryRef.current },
      { id: 'activities' as const, el: activitiesRef.current },
      { id: 'flights'    as const, el: flightsRef.current },
      { id: 'hotels'     as const, el: hotelsRef.current },
    ];
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting);
        if (!visible.length) return;
        const topmost = visible.reduce((a, b) =>
          a.boundingClientRect.top <= b.boundingClientRect.top ? a : b,
        );
        const found = refs.find((r) => r.el === topmost.target);
        if (found) setActiveSection(found.id);
      },
      { root: container, threshold: 0.15 },
    );
    refs.forEach(({ el }) => { if (el) observer.observe(el); });
    return () => observer.disconnect();
  }, [trip?.id]);

  // Close activity menu when clicking outside. Uses closest() on a sentinel
  // class instead of stopPropagation, because React 17+ delegates events to
  // the root container so e.stopPropagation() in a React handler cannot
  // prevent native document listeners from firing.
  useEffect(() => {
    if (!openMenuId) return;
    function onOutside(e: MouseEvent) {
      if (!(e.target as HTMLElement).closest('.activity-menu')) {
        setOpenMenuId(null);
        setOpenSubmenuId(null);
      }
    }
    document.addEventListener('click', onOutside);
    return () => document.removeEventListener('click', onOutside);
  }, [openMenuId]);

  // Close panels on outside click
  useEffect(() => {
    if (editField !== 'dates' && editField !== 'travelers' && editField !== 'destination') return;
    function onDown(e: MouseEvent) {
      if (editField === 'dates') {
        if (datesRef.current && !datesRef.current.contains(e.target as Node)) saveDates();
      } else if (editField === 'travelers') {
        if (travelersRef.current && !travelersRef.current.contains(e.target as Node)) saveTravelers();
      } else if (editField === 'destination') {
        if (destinationRef.current && !destinationRef.current.contains(e.target as Node)) setEditField(null);
      }
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editField, editStart, editEnd, editTravelers]);

  function openTitle() {
    if (!trip) return;
    setEditTitle(trip.title);
    setEditField('title');
    setTimeout(() => titleInputRef.current?.select(), 0);
  }

  function saveTitle() {
    if (trip && editTitle.trim()) updateTrip(trip.id, { title: editTitle.trim() });
    setEditField(null);
  }

  function openDates() {
    if (!trip) return;
    setEditStart(trip.start_date);
    setEditEnd(trip.end_date);
    setEditField('dates');
  }

  function saveDates() {
    if (trip && editStart && editEnd) updateTrip(trip.id, { start_date: editStart, end_date: editEnd });
    setEditField(null);
  }

  function openTravelers() {
    if (!trip) return;
    setEditTravelers({ adults: trip.travelers.adults, children: trip.travelers.children, pets: trip.travelers.pets });
    setEditField('travelers');
  }

  function saveTravelers() {
    if (trip) updateTrip(trip.id, { travelers: editTravelers as TripTravelers });
    setEditField(null);
  }

  function saveDestination(place: SelectedPlace) {
    if (!trip) return;
    updateTrip(trip.id, {
      destination: place.description,
      destination_lat: place.latitude || undefined,
      destination_lng: place.longitude || undefined,
    });
    setEditField(null);
  }

  const pageBg    = isDark ? 'bg-cv-blue-950' : 'bg-cv-blue-50';
  const surfaceBg = isDark ? 'bg-cv-blue-950' : 'bg-white';
  const borderCls = isDark ? 'border-cv-blue-900' : 'border-cv-blue-100';
  const cardBg    = isDark ? 'bg-cv-blue-900 border-cv-blue-800' : 'bg-white border-cv-blue-100';
  const pillBg    = isDark ? 'bg-cv-blue-800 text-cv-blue-300' : 'bg-cv-blue-50 text-cv-blue-600';
  const pillEdit  = isDark ? 'bg-cv-blue-700 text-cv-blue-200' : 'bg-cv-blue-100 text-cv-blue-700';
  const inputCls  = isDark
    ? 'border-cv-blue-700 bg-cv-blue-800 text-white placeholder:text-cv-blue-500 focus:ring-cv-blue-500'
    : 'border-cv-blue-200 bg-white text-cv-blue-950 placeholder:text-cv-blue-300 focus:ring-cv-blue-400';
  const panelBg   = isDark ? 'bg-cv-blue-900 border-cv-blue-700' : 'bg-white border-cv-blue-100';
  const dividerCls = isDark ? 'border-cv-blue-800' : 'border-cv-blue-100';

  // Pencil icon shown on hover
  const PencilIcon = () => (
    <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 112.828 2.828L11.828 15.828a4 4 0 01-1.414.828l-3 1 1-3a4 4 0 01.828-1.414z" />
    </svg>
  );

  function navLinkCls(_href: string) {
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

      {/* ── Body: sidebar + content ───────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── Sidebar (20%) ───────────────────────────────────────────────── */}
        <aside className={`w-1/5 shrink-0 flex flex-col border-r overflow-y-auto ${surfaceBg} ${borderCls}`}>
          <div className="p-4 flex flex-col gap-2">

            {/* Back */}
            <Link
              href="/trip-planner"
              className={`flex items-center gap-1.5 text-sm font-medium mb-4 transition-colors ${isDark ? 'text-cv-blue-400 hover:text-white' : 'text-cv-blue-600 hover:text-cv-blue-950'}`}
            >
              <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
              Back
            </Link>

            {/* Nav */}
            {(
              [
                {
                  id: 'trip-info' as const,
                  label: 'Trip Info',
                  ref: tripInfoRef,
                  icon: (
                    <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V19.5a2.25 2.25 0 002.25 2.25h.75" />
                    </svg>
                  ),
                },
                {
                  id: 'activities' as const,
                  label: 'Things to Do',
                  ref: activitiesRef,
                  count: (trip?.activities ?? []).length || undefined,
                  icon: (
                    <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75V15m6-6v8.25m.503-10.498l4.875 2.437c.381.19.622.58.622 1.006V17.25a.75.75 0 01-.621.74l-5.03.88a1.5 1.5 0 01-.506.02L9.503 18.13a1.5 1.5 0 00-.506.02l-3.984.743A.75.75 0 014.5 18.13V7.87a.75.75 0 01.372-.648l4.5-2.25a.75.75 0 01.632-.012z" />
                    </svg>
                  ),
                },
                {
                  id: 'flights' as const,
                  label: 'Flights',
                  ref: flightsRef,
                  count: flights.length || undefined,
                  icon: (
                    <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                    </svg>
                  ),
                },
                {
                  id: 'hotels' as const,
                  label: 'Hotels',
                  ref: hotelsRef,
                  count: hotels.length || undefined,
                  icon: (
                    <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" />
                    </svg>
                  ),
                },
                {
                  id: 'itinerary' as const,
                  label: 'Itinerary',
                  ref: itineraryRef,
                  icon: (
                    <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5m-9-6h.008v.008H12v-.008zM12 15h.008v.008H12V15zm0 2.25h.008v.008H12v-.008zM9.75 15h.008v.008H9.75V15zm0 2.25h.008v.008H9.75v-.008zM7.5 15h.008v.008H7.5V15zm0 2.25h.008v.008H7.5v-.008zm6.75-4.5h.008v.008h-.008v-.008zm0 2.25h.008v.008h-.008V15zm0 2.25h.008v.008h-.008v-.008zm2.25-4.5h.008v.008H16.5v-.008zm0 2.25h.008v.008H16.5V15z" />
                    </svg>
                  ),
                },
              ] as { id: typeof activeSection; label: string; ref: React.RefObject<HTMLElement | HTMLDivElement | null>; count?: number; icon: React.ReactNode }[]
            ).map(({ id, label, ref, count, icon }) => {
              const isActive = activeSection === id;
              return (
                <button
                  key={id}
                  onClick={() => ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-left transition-all duration-150 ${
                    isActive
                      ? isDark
                        ? 'bg-cv-blue-800 text-white'
                        : 'bg-cv-blue-50 text-cv-blue-950'
                      : isDark
                        ? 'text-cv-blue-400 hover:text-white hover:bg-cv-blue-900'
                        : 'text-cv-blue-500 hover:text-cv-blue-950 hover:bg-cv-blue-50/60'
                  }`}
                >
                  <span className={isActive ? (isDark ? 'text-cv-blue-300' : 'text-cv-blue-600') : ''}>{icon}</span>
                  <span className="flex-1">{label}</span>
                  {count !== undefined && (
                    <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full ${
                      isActive
                        ? isDark ? 'bg-cv-blue-700 text-cv-blue-200' : 'bg-cv-blue-200 text-cv-blue-700'
                        : isDark ? 'bg-cv-blue-800 text-cv-blue-400' : 'bg-cv-blue-100 text-cv-blue-500'
                    }`}>{count}</span>
                  )}
                </button>
              );
            })}

          </div>
        </aside>

        {/* ── Main content (40% base, expands when map minimized) ─────────── */}
        <div ref={scrollContainerRef} className="flex-1 overflow-y-auto">
          <div className="px-6 py-8 flex flex-col gap-8">

          {/* ── Hero ──────────────────────────────────────────────────── */}
          <div ref={tripInfoRef} className={`rounded-2xl border p-6 flex flex-col gap-5 ${cardBg}`}>

            {/* Title */}
            {editField === 'title' ? (
              <input
                ref={titleInputRef}
                autoFocus
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                onBlur={saveTitle}
                onKeyDown={(e) => { if (e.key === 'Enter') saveTitle(); if (e.key === 'Escape') setEditField(null); }}
                className={`text-2xl md:text-3xl font-bold tracking-tight w-full bg-transparent border-b-2 outline-none pb-1 transition-colors ${
                  isDark ? 'text-white border-cv-blue-500' : 'text-cv-blue-950 border-cv-blue-400'
                }`}
              />
            ) : (
              <div
                role="button"
                onClick={openTitle}
                className="group flex items-center gap-2 cursor-pointer rounded-lg -mx-1 px-1 py-0.5 transition-all duration-200 hover:bg-black/5 dark:hover:bg-white/5 hover:-translate-y-px"
              >
                <h1 className={`text-2xl md:text-3xl font-bold tracking-tight ${isDark ? 'text-white' : 'text-cv-blue-950'}`}>
                  {trip.title}
                </h1>
                <span className={`opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all duration-200 ${isDark ? 'text-cv-blue-500' : 'text-cv-blue-400'}`}>
                  <PencilIcon />
                </span>
              </div>
            )}

            {/* Destination + pills */}
            <div className="flex flex-wrap items-center gap-2">

              {/* Destination pill */}
              {editField === 'destination' ? (
                <div ref={destinationRef} className="w-full">
                  <LocationSearch
                    autoFocus
                    initialValue={trip.destination}
                    onSelect={saveDestination}
                    onClear={() => {}}
                    placeholder="Search a destination…"
                  />
                </div>
              ) : (
                <button
                  onClick={() => setEditField('destination')}
                  className={`flex items-center gap-1.5 text-sm px-3 py-1 rounded-full transition-all duration-200 hover:scale-[1.04] hover:shadow-sm ${pillBg} hover:ring-2 ${isDark ? 'hover:ring-cv-blue-500/40' : 'hover:ring-cv-blue-400/40'}`}
                >
                  <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round"
                      d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z" />
                  </svg>
                  {trip.destination.split(',')[0]}
                </button>
              )}

              {/* Dates pill */}
              {editField !== 'destination' && (
                <>
                  <div className="relative">
                    <button
                      onClick={openDates}
                      className={`flex items-center gap-1.5 text-sm px-3 py-1 rounded-full transition-all duration-200 ${editField === 'dates' ? pillEdit : `${pillBg} hover:scale-[1.04] hover:shadow-sm hover:ring-2 ${isDark ? 'hover:ring-cv-blue-500/40' : 'hover:ring-cv-blue-400/40'}`}`}
                    >
                      <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round"
                          d="M8 7V3m8 4V3M3 11h18M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      {formatDateRange(trip.start_date, trip.end_date)}
                    </button>

                    {/* Dates panel */}
                    {editField === 'dates' && (
                      <div ref={datesRef} className={`absolute left-0 top-full mt-2 z-50 rounded-xl border shadow-lg p-4 flex flex-col gap-3 min-w-[260px] ${panelBg}`}>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="flex flex-col gap-0.5">
                            <label className={`text-[10px] font-semibold uppercase tracking-widest px-1 ${isDark ? 'text-cv-blue-300' : 'text-cv-blue-600'}`}>Start</label>
                            <input type="date" value={editStart}
                              onChange={(e) => { setEditStart(e.target.value); if (editEnd && editEnd < e.target.value) setEditEnd(''); }}
                              className={`rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 ${inputCls} ${isDark ? 'scheme-dark' : 'scheme-light'}`}
                            />
                          </div>
                          <div className="flex flex-col gap-0.5">
                            <label className={`text-[10px] font-semibold uppercase tracking-widest px-1 ${isDark ? 'text-cv-blue-300' : 'text-cv-blue-600'}`}>End</label>
                            <input type="date" value={editEnd} min={editStart || undefined}
                              onChange={(e) => setEditEnd(e.target.value)}
                              className={`rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 ${inputCls} ${isDark ? 'scheme-dark' : 'scheme-light'}`}
                            />
                          </div>
                        </div>
                        <button
                          onClick={saveDates}
                          disabled={!editStart || !editEnd}
                          className="w-full py-2 rounded-lg bg-cv-blue-600 hover:bg-cv-blue-500 disabled:opacity-40 text-white text-sm font-semibold transition-colors"
                        >
                          Save dates
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Nights — read-only, derived */}
                  <span className={`text-sm px-3 py-1 rounded-full ${pillBg}`}>
                    {nights} night{nights !== 1 ? 's' : ''}
                  </span>
                </>
              )}
            </div>

            {/* Divider */}
            <div className={`border-t ${dividerCls}`} />

            {/* Traveler avatars + invite */}
            <div className="flex items-center justify-between gap-4">
              <div className="relative">
                <button
                  onClick={openTravelers}
                  className={`group flex items-center gap-2 rounded-lg -mx-1 px-1 py-0.5 transition-all duration-200 hover:bg-black/5 dark:hover:bg-white/5 hover:-translate-y-px ${editField === 'travelers' ? 'bg-black/5 dark:bg-white/5' : ''}`}
                >
                  <TravelerAvatars trip={trip} isDark={isDark} />
                  <span className={`opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all duration-200 ${isDark ? 'text-cv-blue-500' : 'text-cv-blue-400'}`}>
                    <PencilIcon />
                  </span>
                </button>

                {/* Travelers panel */}
                {editField === 'travelers' && (
                  <div ref={travelersRef} className={`absolute left-0 top-full mt-2 z-50 rounded-xl border shadow-lg px-4 pt-3 pb-4 flex flex-col min-w-70 ${panelBg}`}>
                    <div className={`divide-y ${isDark ? 'divide-cv-blue-800' : 'divide-cv-blue-100'}`}>
                      <Stepper label="Adults" sub="Age 18+" value={editTravelers.adults} min={1} max={20}
                        onChange={(v) => setEditTravelers((t) => ({ ...t, adults: v }))} isDark={isDark} />
                      <Stepper label="Children" sub="Ages 0–17" value={editTravelers.children} min={0} max={20}
                        onChange={(v) => setEditTravelers((t) => ({ ...t, children: v }))} isDark={isDark} />
                      <Stepper label="Pets" sub="Dogs, cats & more" value={editTravelers.pets} min={0} max={10}
                        onChange={(v) => setEditTravelers((t) => ({ ...t, pets: v }))} isDark={isDark} />
                    </div>
                    <button
                      onClick={saveTravelers}
                      className="mt-3 w-full py-2 rounded-lg bg-cv-blue-600 hover:bg-cv-blue-500 text-white text-sm font-semibold transition-colors"
                    >
                      Save
                    </button>
                  </div>
                )}
              </div>

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

          {/* ── Things to Do ──────────────────────────────────────────── */}
          <section ref={activitiesRef}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className={isDark ? 'text-cv-blue-400' : 'text-cv-blue-500'}>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75V15m6-6v8.25m.503-10.498l4.875 2.437c.381.19.622.58.622 1.006V17.25a.75.75 0 01-.621.74l-5.03.88a1.5 1.5 0 01-.506.02L9.503 18.13a1.5 1.5 0 00-.506.02l-3.984.743A.75.75 0 014.5 18.13V7.87a.75.75 0 01.372-.648l4.5-2.25a.75.75 0 01.632-.012z" />
                  </svg>
                </span>
                <h2 className={`text-base font-semibold ${isDark ? 'text-white' : 'text-cv-blue-950'}`}>Things to Do</h2>
              </div>
            </div>
            {(trip.activities ?? []).length === 0 ? (
              <SectionPlaceholder label="No activities yet — click + Add to trip on a map marker" isDark={isDark} />
            ) : (
              <div className="flex flex-col gap-2">
                {(trip.activities ?? []).map((a) => {
                  const notesKey = a.id;
                  const showNotes = expandedNotes.has(notesKey) || !!a.notes;
                  return (
                  <div key={a.id} className={`rounded-xl border ${cardBg}`}>

                    {/* Main row: photo + info + three-dot menu */}
                    <div className="flex items-stretch gap-0">
                      {a.photo_url ? (
                        <img src={a.photo_url} alt={a.name} className="w-20 h-20 shrink-0 object-cover rounded-l-xl" />
                      ) : (
                        <div className={`w-20 h-20 shrink-0 flex items-center justify-center text-2xl rounded-l-xl ${isDark ? 'bg-cv-blue-800' : 'bg-cv-blue-50'}`}>
                          📍
                        </div>
                      )}
                      <div className="flex-1 min-w-0 flex items-center justify-between gap-3 px-4 py-3">
                        <div className="min-w-0">
                          <p className={`text-sm font-semibold truncate ${isDark ? 'text-white' : 'text-cv-blue-950'}`}>{a.name}</p>
                          {a.address && (
                            <p className={`text-xs mt-0.5 truncate ${isDark ? 'text-cv-blue-400' : 'text-cv-blue-400'}`}>{a.address}</p>
                          )}
                        </div>

                        {/* Three-dot menu */}
                        <div className="relative shrink-0 activity-menu">
                          <button
                            onClick={() => {
                              setOpenMenuId(openMenuId === a.id ? null : a.id);
                              setOpenSubmenuId(null);
                            }}
                            title="Options"
                            className={`w-7 h-7 flex items-center justify-center rounded-full transition-colors ${
                              isDark
                                ? 'text-cv-blue-400 hover:bg-cv-blue-800 hover:text-white'
                                : 'text-cv-blue-400 hover:bg-cv-blue-50 hover:text-cv-blue-700'
                            }`}
                          >
                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                              <circle cx="12" cy="5" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="12" cy="19" r="1.5" />
                            </svg>
                          </button>

                          {openMenuId === a.id && (
                            <div className={`absolute right-0 top-full mt-1 z-30 w-44 rounded-xl border shadow-lg py-1 ${isDark ? 'bg-cv-blue-900 border-cv-blue-700' : 'bg-white border-cv-blue-100'}`}>
                              <div className="relative">
                                <button
                                  onClick={() => setOpenSubmenuId(openSubmenuId === a.id ? null : a.id)}
                                  className={`w-full flex items-center justify-between gap-2 px-4 py-2.5 text-sm text-left transition-colors ${
                                    isDark ? 'text-cv-blue-200 hover:bg-cv-blue-800' : 'text-cv-blue-950 hover:bg-cv-blue-50'
                                  }`}
                                >
                                  Move to Itinerary
                                  <svg className="w-3.5 h-3.5 shrink-0 opacity-50" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                                  </svg>
                                </button>
                                {openSubmenuId === a.id && (
                                  <div className={`absolute right-full top-0 mr-1 z-40 w-48 rounded-xl border shadow-lg py-1 ${isDark ? 'bg-cv-blue-900 border-cv-blue-700' : 'bg-white border-cv-blue-100'}`}>
                                    {tripDays(trip.start_date, trip.end_date).map((date) => (
                                      <button
                                        key={date}
                                        onClick={() => {
                                          assignActivityToDay(trip.id, date, a);
                                          setOpenMenuId(null);
                                          setOpenSubmenuId(null);
                                        }}
                                        className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                                          isDark ? 'text-cv-blue-200 hover:bg-cv-blue-800' : 'text-cv-blue-950 hover:bg-cv-blue-50'
                                        }`}
                                      >
                                        {formatDayLabel(date)}
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </div>
                              <div className={`my-1 border-t ${isDark ? 'border-cv-blue-800' : 'border-cv-blue-100'}`} />
                              <button
                                onClick={() => { removeActivity(trip.id, a.id); setOpenMenuId(null); }}
                                className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                                  isDark ? 'text-rose-400 hover:bg-cv-blue-800' : 'text-rose-500 hover:bg-rose-50'
                                }`}
                              >
                                Remove from trip
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Notes pill row */}
                    <div className={`flex items-center px-4 py-2.5 border-t ${dividerCls}`}>
                      <button
                        onClick={() => toggleNotes(notesKey)}
                        className={`px-2.5 py-1 rounded-full text-xs transition-all hover:scale-[1.03] ${
                          showNotes
                            ? isDark ? 'bg-cv-blue-700 text-cv-blue-200' : 'bg-cv-blue-100 text-cv-blue-700'
                            : pillBg
                        }`}
                      >
                        {showNotes ? 'Notes ↑' : '+ Notes'}
                      </button>
                    </div>

                    {/* Notes textarea */}
                    {showNotes && (
                      <div className={`border-t px-4 pt-2 pb-3 ${dividerCls}`}>
                        <textarea
                          value={a.notes ?? ''}
                          onChange={(e) => patchActivity(trip.id, a.id, { notes: e.target.value || undefined })}
                          placeholder="Add notes…"
                          rows={2}
                          className={`w-full text-xs resize-none bg-transparent outline-none placeholder:opacity-50 ${isDark ? 'text-cv-blue-200 placeholder:text-cv-blue-500' : 'text-cv-blue-800 placeholder:text-cv-blue-400'}`}
                        />
                      </div>
                    )}
                  </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* ── Flights ───────────────────────────────────────────────── */}
          <section ref={flightsRef}>
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
          <section ref={hotelsRef}>
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

          {/* ── Itinerary ─────────────────────────────────────────────── */}
          <section ref={itineraryRef}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className={isDark ? 'text-cv-blue-400' : 'text-cv-blue-500'}>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5m-9-6h.008v.008H12v-.008zM12 15h.008v.008H12V15zm0 2.25h.008v.008H12v-.008zM9.75 15h.008v.008H9.75V15zm0 2.25h.008v.008H9.75v-.008zM7.5 15h.008v.008H7.5V15zm0 2.25h.008v.008H7.5v-.008zm6.75-4.5h.008v.008h-.008v-.008zm0 2.25h.008v.008h-.008V15zm0 2.25h.008v.008h-.008v-.008zm2.25-4.5h.008v.008H16.5v-.008zm0 2.25h.008v.008H16.5V15z" />
                  </svg>
                </span>
                <h2 className={`text-base font-semibold ${isDark ? 'text-white' : 'text-cv-blue-950'}`}>Itinerary</h2>
              </div>
              <span className={`text-xs ${isDark ? 'text-cv-blue-500' : 'text-cv-blue-400'}`}>
                {tripDays(trip.start_date, trip.end_date).length} days
              </span>
            </div>

            <div className="flex flex-col gap-3">
              {tripDays(trip.start_date, trip.end_date).map((date) => {
                const dayActivities = (trip.itinerary_days ?? {})[date] ?? [];
                const isExternalDropTarget = dragState !== null && dragState.sourceDate !== date && dropTarget?.date === date;
                return (
                  <div
                    key={date}
                    className={`rounded-xl border overflow-hidden transition-colors ${cardBg} ${isExternalDropTarget ? isDark ? 'ring-2 ring-cv-blue-500/40' : 'ring-2 ring-cv-blue-400/40' : ''}`}
                  >
                    <div className={`px-4 py-3 border-b ${dividerCls}`}>
                      <span className={`text-sm font-semibold ${isDark ? 'text-cv-blue-100' : 'text-cv-blue-900'}`}>
                        {formatDayLabel(date)}
                      </span>
                    </div>

                    {dayActivities.length === 0 ? (
                      <div
                        className={`px-4 py-6 flex items-center justify-center transition-colors ${dropTarget?.date === date ? isDark ? 'bg-cv-blue-800/30' : 'bg-cv-blue-50' : ''}`}
                        onDragOver={(e) => { e.preventDefault(); setDropTarget({ date, index: 0 }); }}
                        onDrop={(e) => { e.preventDefault(); handleDrop(date, 0); }}
                      >
                        {dropTarget?.date === date ? (
                          <div className="h-0.5 w-2/3 rounded-full bg-cv-blue-400" />
                        ) : (
                          <p className={`text-sm ${isDark ? 'text-cv-blue-700' : 'text-cv-blue-300'}`}>
                            Nothing planned yet
                          </p>
                        )}
                      </div>
                    ) : (
                      <div
                        className="flex flex-col gap-2 p-3"
                        onDragOver={(e) => { e.preventDefault(); }}
                        onDrop={(e) => { e.preventDefault(); handleDrop(date, dayActivities.length); }}
                      >
                        {dayActivities.map((a, idx) => {
                          const iKey = `${date}::${a.id}`;
                          const showItinNotes = expandedNotes.has(iKey) || !!a.notes;
                          const isDraggingThis = dragState?.activityId === a.id && dragState?.sourceDate === date;

                          return (
                          <Fragment key={a.id}>
                            {/* Drop indicator before this card */}
                            {dropTarget?.date === date && dropTarget.index === idx && !isDraggingThis && (
                              <div className="h-0.5 rounded-full bg-cv-blue-500" />
                            )}

                            <div
                              draggable
                              onDragStart={(e) => {
                                e.dataTransfer.effectAllowed = 'move';
                                setDragState({ sourceDate: date, activityId: a.id, sourceIndex: idx });
                              }}
                              onDragEnd={() => { setDragState(null); setDropTarget(null); }}
                              onDragOver={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                e.dataTransfer.dropEffect = 'move';
                                const rect = e.currentTarget.getBoundingClientRect();
                                const insertIdx = e.clientY < rect.top + rect.height / 2 ? idx : idx + 1;
                                setDropTarget({ date, index: insertIdx });
                              }}
                              onDrop={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                const rect = e.currentTarget.getBoundingClientRect();
                                const insertIdx = e.clientY < rect.top + rect.height / 2 ? idx : idx + 1;
                                handleDrop(date, insertIdx);
                              }}
                              className={`relative flex flex-col rounded-xl border overflow-hidden transition-opacity cursor-grab active:cursor-grabbing select-none ${cardBg} ${isDraggingThis ? 'opacity-40' : 'opacity-100'}`}
                            >
                              {/* X — remove from this day */}
                              <button
                                draggable={false}
                                onClick={() => removeActivityFromDay(trip.id, date, a.id)}
                                title="Remove from this day"
                                className={`absolute top-2 right-2 z-10 w-5 h-5 flex items-center justify-center rounded-full transition-colors ${isDark ? 'text-cv-blue-600 hover:bg-cv-blue-700 hover:text-white' : 'text-cv-blue-300 hover:bg-cv-blue-100 hover:text-cv-blue-600'}`}
                              >
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>

                              {/* Photo + name row */}
                              <div className="flex items-stretch">
                                {a.photo_url ? (
                                  <img src={a.photo_url} alt={a.name} className="w-16 h-16 shrink-0 object-cover" draggable={false} />
                                ) : (
                                  <div className={`w-16 h-16 shrink-0 flex items-center justify-center text-xl ${isDark ? 'bg-cv-blue-800' : 'bg-cv-blue-50'}`}>
                                    📍
                                  </div>
                                )}
                                <div className="flex-1 min-w-0 flex items-center px-4 py-3 pr-8">
                                  <div className="min-w-0">
                                    <p className={`text-sm font-semibold truncate ${isDark ? 'text-white' : 'text-cv-blue-950'}`}>{a.name}</p>
                                    {a.address && (
                                      <p className={`text-xs mt-0.5 truncate ${isDark ? 'text-cv-blue-400' : 'text-cv-blue-400'}`}>{a.address}</p>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {/* Details row: time, price, notes — pill-styled */}
                              <div className={`flex items-center gap-2 px-4 py-2.5 border-t flex-wrap ${dividerCls}`}>
                                <label className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs cursor-pointer transition-colors hover:scale-[1.03] ${pillBg}`}>
                                  <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2m6-2a10 10 0 11-20 0 10 10 0 0120 0z" />
                                  </svg>
                                  <input
                                    type="time"
                                    draggable={false}
                                    value={a.time ?? ''}
                                    onChange={(e) => patchItineraryActivity(trip.id, date, a.id, { time: e.target.value || undefined })}
                                    className={`bg-transparent outline-none border-none text-xs w-22 ${isDark ? 'scheme-dark' : 'scheme-light'}`}
                                  />
                                </label>

                                <div className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs ${pillBg}`}>
                                  <span>$</span>
                                  <input
                                    type="text"
                                    inputMode="decimal"
                                    draggable={false}
                                    value={a.price ?? 0}
                                    onChange={(e) => {
                                      const n = parseFloat(e.target.value);
                                      patchItineraryActivity(trip.id, date, a.id, { price: isNaN(n) ? 0 : n });
                                    }}
                                    className="bg-transparent outline-none border-none text-xs w-10 min-w-0"
                                  />
                                  <button
                                    draggable={false}
                                    onClick={() => patchItineraryActivity(trip.id, date, a.id, { price_type: (a.price_type ?? 'per_person') === 'per_person' ? 'total' : 'per_person' })}
                                    className="opacity-60 hover:opacity-100 transition-opacity whitespace-nowrap"
                                  >
                                    {(a.price_type ?? 'per_person') === 'per_person' ? '/ person' : 'total'}
                                  </button>
                                </div>

                                <button
                                  draggable={false}
                                  onClick={() => toggleNotes(iKey)}
                                  className={`px-2.5 py-1 rounded-full text-xs transition-all hover:scale-[1.03] ${
                                    showItinNotes
                                      ? isDark ? 'bg-cv-blue-700 text-cv-blue-200' : 'bg-cv-blue-100 text-cv-blue-700'
                                      : pillBg
                                  }`}
                                >
                                  {showItinNotes ? 'Notes ↑' : '+ Notes'}
                                </button>
                              </div>

                              {/* Notes textarea */}
                              {showItinNotes && (
                                <div className={`px-4 pb-3 pt-1 border-t ${dividerCls}`}>
                                  <textarea
                                    draggable={false}
                                    value={a.notes ?? ''}
                                    onChange={(e) => patchItineraryActivity(trip.id, date, a.id, { notes: e.target.value || undefined })}
                                    placeholder="Add notes…"
                                    rows={2}
                                    className={`w-full text-xs resize-none bg-transparent outline-none placeholder:opacity-50 ${isDark ? 'text-cv-blue-200 placeholder:text-cv-blue-500' : 'text-cv-blue-800 placeholder:text-cv-blue-400'}`}
                                  />
                                </div>
                              )}
                            </div>

                            {/* Drop indicator after last card */}
                            {idx === dayActivities.length - 1 && dropTarget?.date === date && dropTarget.index === dayActivities.length && !isDraggingThis && (
                              <div className="h-0.5 rounded-full bg-cv-blue-500" />
                            )}
                          </Fragment>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          </div>
        </div>

        {/* ── Map panel (40% expanded / auto minimized) ───────────────────── */}
        <div className={`shrink-0 h-full transition-all duration-300 ${mapMinimized ? 'w-10' : 'w-2/5'}`}>
          <TripMap
            lat={trip.destination_lat}
            lng={trip.destination_lng}
            destination={trip.destination}
            isDark={isDark}
            borderCls={borderCls}
            minimized={mapMinimized}
            onToggleMinimize={() => setMapMinimized((v) => !v)}
            onAddActivity={(name, address) => {
              const activityId = addActivity(trip.id, name, address);
              trpc.places.getPhoto.query({ name, address }).then((url) => {
                if (url) patchActivity(trip.id, activityId, { photo_url: url });
              }).catch(() => {});
            }}
            initialPins={trip.pins ?? []}
            onPinsChange={(pins) => updateTrip(trip.id, { pins })}
          />
        </div>

      </div>

    </div>
  );
}
