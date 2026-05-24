'use client';

import Link from 'next/link';
import { Fragment, useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { useTheme } from '@/contexts/ThemeContext';
import { NavBar } from '@/components/NavBar';
import { useTrips } from '@/hooks/useTrips';
import { useBookmarks } from '@/hooks/useBookmarks';
import { FlightCard } from '@/components/FlightCard';
import { HotelCard } from '@/components/HotelCard';
import { TripMap } from '@/components/TripMap';
import { LocationSearch, type SelectedPlace } from '@/components/LocationSearch';
import type { GuestsValue } from '@/components/GuestsDropdown';
import type { Trip, TripTravelers } from '@/lib/trips';
import { trpc } from '@/lib/trpc-client';

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
    weekday: 'long', month: 'short', day: 'numeric',
  });
}

function parseDayParts(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00');
  return {
    num: String(d.getDate()),
    day: d.toLocaleDateString([], { weekday: 'short' }).toUpperCase(),
    month: d.toLocaleDateString([], { month: 'short' }).toUpperCase(),
  };
}

function getActivityTag(name: string): string {
  const n = name.toLowerCase();
  if (/café|cafe|coffee|restaurant|bistro|food|eat|dining|bakery|kitchen|brasserie/.test(n)) return 'FOOD';
  if (/bar|pub|cocktail|drink|brewery|winery|lounge|taproom/.test(n)) return 'DRINK';
  if (/airport|flight|transfer|train|bus|station|transit|taxi|ferry/.test(n)) return 'TRAVEL';
  return 'PLACE';
}

function getActivityTagCls(name: string, isDark: boolean): string {
  const tag = getActivityTag(name);
  if (tag === 'FOOD')   return isDark ? 'bg-amber-950/60 text-amber-400'  : 'bg-amber-50 text-amber-700';
  if (tag === 'DRINK')  return isDark ? 'bg-purple-950/60 text-purple-400' : 'bg-purple-50 text-purple-700';
  if (tag === 'TRAVEL') return isDark ? 'bg-sky-950/60 text-sky-400'       : 'bg-sky-50 text-sky-600';
  return isDark ? 'bg-gph-dark-linesoft text-gph-dark-muted' : 'bg-gray-100 text-gray-500';
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionHead({
  label, title, right, isDark,
}: { label: string; title: string; right?: React.ReactNode; isDark: boolean }) {
  return (
    <div
      className={`flex items-end justify-between px-6 pt-10 pb-5 border-t ${
        isDark ? 'border-gph-dark-line bg-gph-dark-card' : 'border-gray-200 bg-white'
      }`}
    >
      <div>
        <p className={`text-[10px] font-mono font-bold uppercase tracking-[0.12em] mb-2 ${
          isDark ? 'text-gph-dark-muted' : 'text-gray-500'
        }`}>{label}</p>
        <h2 className={`text-[28px] leading-none font-black tracking-tight ${
          isDark ? 'text-gph-dark-ink' : 'text-gray-900'
        }`}>
          {title}<span className="text-lime-500">.</span>
        </h2>
      </div>
      {right}
    </div>
  );
}

function BookedToggle({ booked, onClick, isDark }: { booked: boolean; onClick: () => void; isDark: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-[10px] font-mono font-black uppercase tracking-[0.08em] transition-colors ${
        booked
          ? 'bg-cv-green-500 text-white border border-cv-green-500'
          : isDark
            ? 'text-gph-dark-ink border border-gph-dark-line hover:bg-gph-dark-linesoft'
            : 'text-gray-900 border border-gray-300 hover:bg-gray-50'
      }`}
    >
      <span className={`w-3.5 h-3.5 rounded-sm flex items-center justify-center shrink-0 ${
        booked
          ? 'bg-white'
          : isDark ? 'border border-gph-dark-muted' : 'border border-gray-400'
      }`}>
        {booked && (
          <svg className="w-2 h-2" viewBox="0 0 8 8" fill="none">
            <path d="M1.5 4L3 5.5L6.5 2" stroke="#22c55e" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        )}
      </span>
      {booked ? 'Booked' : 'Mark booked'}
    </button>
  );
}

function Stepper({
  label, sub, value, min = 0, max = 20, onChange, isDark,
}: {
  label: string; sub: string; value: number; min?: number; max?: number;
  onChange: (v: number) => void; isDark: boolean;
}) {
  const btnBase = 'w-7 h-7 rounded-full border text-sm font-semibold flex items-center justify-center transition-colors';
  const btnActive = isDark
    ? 'border-gph-dark-line text-gph-dark-ink hover:bg-gph-dark-linesoft'
    : 'border-gray-400 text-gray-700 hover:bg-gray-50';
  const btnDisabled = isDark
    ? 'border-gph-dark-line text-gph-dark-muted cursor-not-allowed opacity-30'
    : 'border-gray-200 text-gray-300 cursor-not-allowed';
  return (
    <div className="flex items-center justify-between gap-4 py-2.5">
      <div>
        <p className={`text-sm font-medium ${isDark ? 'text-gph-dark-ink' : 'text-gray-900'}`}>{label}</p>
        <p className={`text-xs ${isDark ? 'text-gph-dark-muted' : 'text-gray-500'}`}>{sub}</p>
      </div>
      <div className="flex items-center gap-3">
        <button type="button" onClick={() => onChange(value - 1)} disabled={value <= min}
          className={`${btnBase} ${value <= min ? btnDisabled : btnActive}`}>−</button>
        <span className={`w-4 text-center text-sm font-semibold ${isDark ? 'text-gph-dark-ink' : 'text-gray-900'}`}>{value}</span>
        <button type="button" onClick={() => onChange(value + 1)} disabled={value >= max}
          className={`${btnBase} ${value >= max ? btnDisabled : btnActive}`}>+</button>
      </div>
    </div>
  );
}

function PlaceholderSection({ label, description, isDark }: { label: string; description: string; isDark: boolean }) {
  return (
    <div className={`px-6 py-10 ${isDark ? 'bg-gph-dark-card' : 'bg-white'}`}>
      <div className={`rounded-xl border-2 border-dashed flex flex-col items-center justify-center py-14 gap-3 ${
        isDark ? 'border-gph-dark-line' : 'border-gray-200'
      }`}>
        <span className={`text-[10px] font-mono font-bold uppercase tracking-[0.12em] px-2.5 py-1 rounded ${
          isDark ? 'bg-gph-dark-linesoft text-gph-dark-muted' : 'bg-gray-100 text-gray-500'
        }`}>Coming soon</span>
        <p className={`text-sm font-semibold ${isDark ? 'text-gph-dark-ink' : 'text-gray-700'}`}>{label}</p>
        <p className={`text-xs text-center max-w-xs ${isDark ? 'text-gph-dark-muted' : 'text-gray-400'}`}>{description}</p>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type EditField = 'title' | 'destination' | 'dates' | 'travelers' | null;
type SectionId = 'overview' | 'itinerary' | 'flights' | 'hotels' | 'budget' | 'notes';

export default function TripDetailPage() {
  const { isDark } = useTheme();
  const params = useParams();
  const { trips, updateTrip, addActivity, patchActivity, removeActivity,
    assignActivityToDay, removeActivityFromDay, patchItineraryActivity,
    reorderActivityInDay, moveActivityToDay } = useTrips();
  const tripId = params.id as string;
  const { flights, hotels } = useBookmarks(tripId);
  const trip: Trip | undefined = trips.find((t) => t.id === tripId);

  // Map expanded overlay
  const [mapExpanded, setMapExpanded] = useState(false);

  // Booked toggles (local state — persisting to data model is a future enhancement)
  const [bookedFlights, setBookedFlights] = useState<Set<string>>(new Set());
  const [bookedHotels, setBookedHotels] = useState<Set<string>>(new Set());
  const toggleBookedFlight = (id: string) =>
    setBookedFlights((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleBookedHotel = (id: string) =>
    setBookedHotels((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  // Edit state
  const [editField, setEditField] = useState<EditField>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editStart, setEditStart] = useState('');
  const [editEnd, setEditEnd] = useState('');
  const [editTravelers, setEditTravelers] = useState<GuestsValue>({ adults: 1, children: 0, pets: 0 });
  const titleInputRef = useRef<HTMLInputElement>(null);
  const datesRef = useRef<HTMLDivElement>(null);
  const travelersRef = useRef<HTMLDivElement>(null);
  const destinationRef = useRef<HTMLDivElement>(null);

  // Activity menu state
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [openSubmenuId, setOpenSubmenuId] = useState<string | null>(null);
  const [expandedNotes, setExpandedNotes] = useState<Set<string>>(new Set());
  function toggleNotes(key: string) {
    setExpandedNotes((prev) => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });
  }

  // Drag state
  const [dragState, setDragState] = useState<{ sourceDate: string; activityId: string; sourceIndex: number } | null>(null);
  const [dropTarget, setDropTarget] = useState<{ date: string; index: number } | null>(null);
  function handleDrop(targetDate: string, targetIndex: number) {
    if (!dragState || !trip) return;
    const { sourceDate, activityId, sourceIndex } = dragState;
    if (sourceDate === targetDate) {
      if (targetIndex !== sourceIndex && targetIndex !== sourceIndex + 1)
        reorderActivityInDay(trip.id, sourceDate, sourceIndex, targetIndex);
    } else {
      moveActivityToDay(trip.id, sourceDate, targetDate, activityId, targetIndex);
    }
    setDragState(null);
    setDropTarget(null);
  }

  // Section scroll refs
  const overviewRef = useRef<HTMLDivElement>(null);
  const itineraryRef = useRef<HTMLElement>(null);
  const flightsRef = useRef<HTMLElement>(null);
  const hotelsRef = useRef<HTMLElement>(null);
  const budgetRef = useRef<HTMLElement>(null);
  const notesRef = useRef<HTMLElement>(null);
  const [activeSection, setActiveSection] = useState<SectionId>('overview');

  useEffect(() => {
    const refs = [
      { id: 'overview'  as const, el: overviewRef.current },
      { id: 'itinerary' as const, el: itineraryRef.current },
      { id: 'flights'   as const, el: flightsRef.current },
      { id: 'hotels'    as const, el: hotelsRef.current },
      { id: 'budget'    as const, el: budgetRef.current },
      { id: 'notes'     as const, el: notesRef.current },
    ];
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting);
        if (!visible.length) return;
        const topmost = visible.reduce((a, b) =>
          a.boundingClientRect.top <= b.boundingClientRect.top ? a : b);
        const found = refs.find((r) => r.el === topmost.target);
        if (found) setActiveSection(found.id);
      },
      { threshold: 0.15 },
    );
    refs.forEach(({ el }) => { if (el) observer.observe(el); });
    return () => observer.disconnect();
  }, [trip?.id]);

  // Close menus on outside click
  useEffect(() => {
    if (!openMenuId) return;
    function onOutside(e: MouseEvent) {
      if (!(e.target as HTMLElement).closest('.activity-menu')) {
        setOpenMenuId(null); setOpenSubmenuId(null);
      }
    }
    document.addEventListener('click', onOutside);
    return () => document.removeEventListener('click', onOutside);
  }, [openMenuId]);

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
    setEditTitle(trip.title); setEditField('title');
    setTimeout(() => titleInputRef.current?.select(), 0);
  }
  function saveTitle() {
    if (trip && editTitle.trim()) updateTrip(trip.id, { title: editTitle.trim() });
    setEditField(null);
  }
  function openDates() {
    if (!trip) return;
    setEditStart(trip.start_date); setEditEnd(trip.end_date); setEditField('dates');
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

  // Style tokens
  const pageBg  = isDark ? 'bg-gph-dark-bg'      : 'bg-gray-100';
  const cardBg  = isDark ? 'bg-gph-dark-card'     : 'bg-white';
  const borderCls = isDark ? 'border-gph-dark-line' : 'border-gray-200';
  const ink     = isDark ? 'text-gph-dark-ink'    : 'text-gray-900';
  const muted   = isDark ? 'text-gph-dark-muted'  : 'text-gray-500';
  const inputCls = isDark
    ? 'border-gph-dark-line bg-gph-dark-linesoft text-gph-dark-ink placeholder:text-gph-dark-muted focus:ring-gph-dark-action'
    : 'border-gray-200 bg-white text-gray-900 placeholder:text-gray-400 focus:ring-gray-400';
  const panelBg = isDark ? 'bg-gph-dark-card border-gph-dark-line' : 'bg-white border-gray-200';
  const dividerCls = isDark ? 'border-gph-dark-line' : 'border-gray-200';

  // Loading states
  if (!trip && trips.length === 0) return <div className={`h-screen ${pageBg}`} />;
  if (!trip) {
    return (
      <div className={`flex flex-col h-screen font-sans ${pageBg}`}>
        <NavBar />
        <div className="flex flex-1 items-center justify-center">
          <p className={`text-sm ${muted}`}>Trip not found.</p>
        </div>
      </div>
    );
  }

  const nights = nightsBetween(trip.start_date, trip.end_date);
  const days = tripDays(trip.start_date, trip.end_date);
  const allItineraryActivities = days.flatMap((d) => (trip.itinerary_days ?? {})[d] ?? []);
  const totalStops = allItineraryActivities.length;
  const bookedFlightCount = bookedFlights.size;
  const bookedHotelCount = bookedHotels.size;

  // Chip for section rail
  const railItems: { id: SectionId; label: string; count?: number }[] = [
    { id: 'overview',  label: 'Overview' },
    { id: 'itinerary', label: 'Itinerary', count: totalStops || undefined },
    { id: 'flights',   label: 'Flights',   count: flights.length || undefined },
    { id: 'hotels',    label: 'Hotels',    count: hotels.length || undefined },
    { id: 'budget',    label: 'Budget' },
    { id: 'notes',     label: 'Notes' },
  ];
  const refMap: Record<SectionId, React.RefObject<HTMLElement | HTMLDivElement | null>> = {
    overview:  overviewRef,
    itinerary: itineraryRef,
    flights:   flightsRef,
    hotels:    hotelsRef,
    budget:    budgetRef,
    notes:     notesRef,
  };

  const PencilIcon = () => (
    <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 112.828 2.828L11.828 15.828a4 4 0 01-1.414.828l-3 1 1-3a4 4 0 01.828-1.414z" />
    </svg>
  );

  return (
    <div className={`min-h-screen font-sans ${pageBg}`}>
      <NavBar />

      {/* ── Hero / Overview ──────────────────────────────────────────────────── */}
      <div ref={overviewRef} className={`${cardBg}`}>
        <div className="px-6 pt-8 pb-6">

          {/* Trip status strip */}
          <div className={`flex items-center gap-3 mb-5 text-[10px] font-mono font-bold uppercase tracking-widest ${muted}`}>
            <Link href="/trip-planner" className={`flex items-center gap-1.5 transition-colors hover:${ink.replace('text-', 'text-')}`}>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
              All trips
            </Link>
            <span className={`w-1 h-1 rounded-full ${isDark ? 'bg-gph-dark-line' : 'bg-gray-300'}`} />
            <span className={`px-2 py-0.5 rounded ${isDark ? 'bg-gph-dark-linesoft text-gph-dark-muted' : 'bg-gray-100 text-gray-500'}`}>
              In progress
            </span>
            <span className={`w-1 h-1 rounded-full ${isDark ? 'bg-gph-dark-line' : 'bg-gray-300'}`} />
            <span>{trip.destination.split(',')[0].toUpperCase()}</span>
          </div>

          {/* Title */}
          {editField === 'title' ? (
            <input
              ref={titleInputRef} autoFocus type="text" value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              onBlur={saveTitle}
              onKeyDown={(e) => { if (e.key === 'Enter') saveTitle(); if (e.key === 'Escape') setEditField(null); }}
              className={`text-4xl md:text-5xl font-black tracking-tight w-full bg-transparent border-b-2 outline-none pb-1 mb-4 transition-colors leading-none ${
                isDark ? 'text-gph-dark-ink border-gph-dark-action' : 'text-gray-900 border-gray-400'
              }`}
            />
          ) : (
            <div
              role="button"
              onClick={openTitle}
              className="group flex items-start gap-2 cursor-pointer mb-4"
            >
              <h1 className={`text-4xl md:text-5xl font-black tracking-tight leading-none ${ink}`}>
                {trip.title}<span className="text-lime-500">.</span>
              </h1>
              <span className={`mt-3 opacity-0 group-hover:opacity-60 transition-opacity ${muted}`}>
                <PencilIcon />
              </span>
            </div>
          )}

          {/* Date + destination row */}
          <div className={`flex flex-wrap items-center gap-3 mb-6 text-sm font-mono font-semibold ${muted}`}>
            {/* Destination pill */}
            {editField === 'destination' ? (
              <div ref={destinationRef} className="w-full max-w-sm">
                <LocationSearch initialValue={trip.destination} onSelect={saveDestination} onClear={() => {}} placeholder="Search destination…" />
              </div>
            ) : (
              <button
                onClick={() => setEditField('destination')}
                className={`flex items-center gap-1.5 transition-colors hover:${ink.replace('text-', 'text-')}`}
              >
                <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z" />
                </svg>
                {trip.destination.split(',')[0]}
              </button>
            )}

            {editField !== 'destination' && (
              <>
                <span className={`w-px h-4 ${isDark ? 'bg-gph-dark-line' : 'bg-gray-300'}`} />

                {/* Dates */}
                <div className="relative">
                  <button onClick={openDates} className={`flex items-center gap-1.5 transition-colors hover:${ink.replace('text-', 'text-')}`}>
                    <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3M3 11h18M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    {formatDateRange(trip.start_date, trip.end_date)}
                  </button>
                  {editField === 'dates' && (
                    <div ref={datesRef} className={`absolute left-0 top-full mt-2 z-50 rounded-xl border shadow-lg p-4 flex flex-col gap-3 min-w-65 ${panelBg}`}>
                      <div className="grid grid-cols-2 gap-3">
                        {(['Start', 'End'] as const).map((lbl) => (
                          <div key={lbl} className="flex flex-col gap-0.5">
                            <label className={`text-[10px] font-semibold uppercase tracking-widest px-1 ${muted}`}>{lbl}</label>
                            <input
                              type="date"
                              value={lbl === 'Start' ? editStart : editEnd}
                              min={lbl === 'End' && editStart ? editStart : undefined}
                              onChange={(e) => {
                                if (lbl === 'Start') { setEditStart(e.target.value); if (editEnd && editEnd < e.target.value) setEditEnd(''); }
                                else setEditEnd(e.target.value);
                              }}
                              className={`rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 ${inputCls} ${isDark ? 'scheme-dark' : 'scheme-light'}`}
                            />
                          </div>
                        ))}
                      </div>
                      <button
                        onClick={saveDates} disabled={!editStart || !editEnd}
                        className={`w-full py-2 rounded-lg disabled:opacity-40 text-sm font-semibold transition-colors ${isDark ? 'bg-gph-dark-action text-gph-dark-bg hover:bg-gph-dark-actionhi' : 'bg-gray-900 text-white hover:bg-gray-800'}`}
                      >Save dates</button>
                    </div>
                  )}
                </div>

                <span className={`w-px h-4 ${isDark ? 'bg-gph-dark-line' : 'bg-gray-300'}`} />
                <span>{nights} night{nights !== 1 ? 's' : ''}</span>
              </>
            )}
          </div>

          {/* Stats strip */}
          <div className={`grid grid-cols-2 md:grid-cols-4 gap-px rounded-xl overflow-hidden border ${borderCls}`}
            style={{ background: isDark ? '#262629' : '#e5e7eb' }}>
            {[
              { label: 'Duration', value: `${nights}N`, sub: `${days.length} days` },
              { label: 'Flights',  value: String(flights.length), sub: bookedFlightCount > 0 ? `${bookedFlightCount} booked` : 'saved' },
              { label: 'Hotels',   value: String(hotels.length),  sub: bookedHotelCount > 0 ? `${bookedHotelCount} booked` : 'saved' },
              { label: 'Stops',    value: String(totalStops),     sub: 'in itinerary' },
            ].map(({ label, value, sub }) => (
              <div key={label} className={`px-5 py-4 ${cardBg}`}>
                <p className={`text-[9px] font-mono font-bold uppercase tracking-widest mb-1 ${muted}`}>{label}</p>
                <p className={`text-2xl font-black tracking-tight font-mono ${ink}`}>{value}</p>
                <p className={`text-[11px] mt-0.5 ${muted}`}>{sub}</p>
              </div>
            ))}
          </div>

          {/* Traveler row */}
          <div className="mt-4 flex items-center justify-between">
            <div className="relative">
              <button
                onClick={openTravelers}
                className={`group flex items-center gap-2.5 rounded-lg px-1 py-0.5 transition-all hover:bg-black/5 ${editField === 'travelers' ? 'bg-black/5' : ''}`}
              >
                <div className="flex items-center">
                  {Array.from({ length: Math.min(trip.travelers.adults, 4) }).map((_, i) => (
                    <div key={i} className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold ring-2 ${
                      isDark ? 'ring-gph-dark-bg' : 'ring-white'
                    } ${i === 0 ? isDark ? 'bg-gph-dark-action text-gph-dark-bg z-10' : 'bg-gray-900 text-white z-10'
                      : isDark ? `bg-gph-dark-linesoft text-gph-dark-muted z-[${10 - i}]` : `bg-gray-100 text-gray-500 z-[${10 - i}]`
                    } ${i > 0 ? '-ml-1.5' : ''}`}>
                      {i === 0 ? (
                        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12 12a4 4 0 100-8 4 4 0 000 8zm0 2c-5.33 0-8 2.67-8 4v1h16v-1c0-1.33-2.67-4-8-4z" />
                        </svg>
                      ) : (
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.5 20.25a8.25 8.25 0 0115 0" />
                        </svg>
                      )}
                    </div>
                  ))}
                </div>
                <span className={`text-sm ${muted}`}>
                  {trip.travelers.adults + trip.travelers.children} traveler{trip.travelers.adults + trip.travelers.children !== 1 ? 's' : ''}
                  {trip.travelers.pets > 0 ? ` · ${trip.travelers.pets} pet${trip.travelers.pets !== 1 ? 's' : ''}` : ''}
                </span>
                <span className={`opacity-0 group-hover:opacity-60 transition-opacity ${muted}`}><PencilIcon /></span>
              </button>
              {editField === 'travelers' && (
                <div ref={travelersRef} className={`absolute left-0 top-full mt-2 z-50 rounded-xl border shadow-lg px-4 pt-3 pb-4 min-w-65 ${panelBg}`}>
                  <div className={`divide-y ${isDark ? 'divide-gph-dark-line' : 'divide-gray-200'}`}>
                    <Stepper label="Adults" sub="Age 18+" value={editTravelers.adults} min={1} max={20}
                      onChange={(v) => setEditTravelers((t) => ({ ...t, adults: v }))} isDark={isDark} />
                    <Stepper label="Children" sub="Ages 0–17" value={editTravelers.children} min={0} max={20}
                      onChange={(v) => setEditTravelers((t) => ({ ...t, children: v }))} isDark={isDark} />
                    <Stepper label="Pets" sub="Dogs, cats & more" value={editTravelers.pets} min={0} max={10}
                      onChange={(v) => setEditTravelers((t) => ({ ...t, pets: v }))} isDark={isDark} />
                  </div>
                  <button
                    onClick={saveTravelers}
                    className={`mt-3 w-full py-2 rounded-lg text-sm font-semibold transition-colors ${isDark ? 'bg-gph-dark-action text-gph-dark-bg hover:bg-gph-dark-actionhi' : 'bg-gray-900 text-white hover:bg-gray-800'}`}
                  >Save</button>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                isDark ? 'border-gph-dark-line text-gph-dark-ink hover:bg-gph-dark-linesoft' : 'border-gray-200 text-gray-700 hover:bg-gray-50'
              }`}>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                </svg>
                Share
              </button>
              <button className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                isDark ? 'border-gph-dark-line text-gph-dark-ink hover:bg-gph-dark-linesoft' : 'border-gray-200 text-gray-700 hover:bg-gray-50'
              }`}>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Export
              </button>
            </div>
          </div>
        </div>

        {/* ── Section Rail ────────────────────────────────────────────────── */}
        <div className={`flex items-center gap-2 px-6 py-3 border-t overflow-x-auto ${borderCls}`}>
          {railItems.map(({ id, label, count }) => {
            const isActive = activeSection === id;
            return (
              <button
                key={id}
                onClick={() => refMap[id].current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold whitespace-nowrap transition-colors ${
                  isActive
                    ? isDark ? 'bg-gph-dark-ink text-gph-dark-bg' : 'bg-gray-900 text-white'
                    : isDark ? 'text-gph-dark-muted hover:text-gph-dark-ink' : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                {label}
                {count !== undefined && (
                  <span className={`text-[10px] font-mono ${isActive ? 'opacity-60' : isDark ? 'text-gph-dark-muted' : 'text-gray-400'}`}>{count}</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Main grid: Itinerary + Sidebar ───────────────────────────────────── */}
      <div className={`grid grid-cols-1 lg:grid-cols-[3fr_2fr] border-t ${borderCls}`}>

        {/* ── Itinerary ──────────────────────────────────────────────────────── */}
        <section
          ref={itineraryRef}
          className={`px-6 py-8 lg:border-r ${borderCls} ${cardBg}`}
        >
          <div className="flex items-center justify-between mb-6">
            <h2 className={`text-xl font-black tracking-tight ${ink}`}>
              Itinerary<span className="text-lime-500">.</span>
            </h2>
          </div>

          {/* Things to Do (unassigned activities) */}
          {(trip.activities ?? []).length > 0 && (
            <div className="mb-8">
              <p className={`text-[10px] font-mono font-bold uppercase tracking-widest mb-3 ${muted}`}>Things to Do · not yet scheduled</p>
              <div className="flex flex-col gap-2">
                {(trip.activities ?? []).map((a) => {
                  const notesKey = a.id;
                  const showNotes = expandedNotes.has(notesKey) || !!a.notes;
                  return (
                    <div key={a.id} className={`rounded-xl border ${isDark ? 'bg-gph-dark-card border-gph-dark-line' : 'bg-white border-gray-200'}`}>
                      <div className="flex items-stretch">
                        {a.photo_url ? (
                          <img src={a.photo_url} alt={a.name} className="w-16 h-16 shrink-0 object-cover rounded-l-xl" />
                        ) : (
                          <div className={`w-16 h-16 shrink-0 flex items-center justify-center text-xl rounded-l-xl ${isDark ? 'bg-gph-dark-linesoft' : 'bg-gray-100'}`}>📍</div>
                        )}
                        <div className="flex-1 min-w-0 flex items-center justify-between gap-3 px-4 py-3">
                          <div className="min-w-0">
                            <p className={`text-sm font-semibold truncate ${ink}`}>{a.name}</p>
                            {a.address && <p className={`text-xs mt-0.5 truncate ${muted}`}>{a.address}</p>}
                          </div>
                          <div className="relative shrink-0 activity-menu">
                            <button
                              onClick={() => { setOpenMenuId(openMenuId === a.id ? null : a.id); setOpenSubmenuId(null); }}
                              className={`w-7 h-7 flex items-center justify-center rounded-full transition-colors ${
                                isDark ? 'text-gph-dark-muted hover:bg-gph-dark-linesoft hover:text-gph-dark-ink' : 'text-gray-400 hover:bg-gray-100 hover:text-gray-700'
                              }`}
                            >
                              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                                <circle cx="12" cy="5" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="12" cy="19" r="1.5" />
                              </svg>
                            </button>
                            {openMenuId === a.id && (
                              <div className={`absolute right-0 top-full mt-1 z-30 w-44 rounded-xl border shadow-lg py-1 ${isDark ? 'bg-gph-dark-card border-gph-dark-line' : 'bg-white border-gray-200'}`}>
                                <div className="relative">
                                  <button
                                    onClick={() => setOpenSubmenuId(openSubmenuId === a.id ? null : a.id)}
                                    className={`w-full flex items-center justify-between gap-2 px-4 py-2.5 text-sm text-left transition-colors ${
                                      isDark ? 'text-gph-dark-ink hover:bg-gph-dark-linesoft' : 'text-gray-900 hover:bg-gray-50'
                                    }`}
                                  >
                                    Move to Itinerary
                                    <svg className="w-3.5 h-3.5 shrink-0 opacity-50" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                                    </svg>
                                  </button>
                                  {openSubmenuId === a.id && (
                                    <div className={`absolute right-full top-0 mr-1 z-40 w-52 rounded-xl border shadow-lg py-1 ${isDark ? 'bg-gph-dark-card border-gph-dark-line' : 'bg-white border-gray-200'}`}>
                                      {days.map((date) => {
                                        const dateActivities = (trip.itinerary_days ?? {})[date] ?? [];
                                        const alreadyAdded = dateActivities.some(
                                          (da) => da.name.toLowerCase() === a.name.toLowerCase()
                                        );
                                        return (
                                          <button
                                            key={date}
                                            disabled={alreadyAdded}
                                            onClick={() => {
                                              if (!alreadyAdded) {
                                                assignActivityToDay(trip.id, date, a);
                                                setOpenMenuId(null);
                                                setOpenSubmenuId(null);
                                              }
                                            }}
                                            className={`w-full px-4 py-2.5 text-sm transition-colors flex items-center justify-between gap-2 ${
                                              alreadyAdded
                                                ? isDark ? 'text-gph-dark-muted cursor-not-allowed' : 'text-gray-300 cursor-not-allowed'
                                                : isDark ? 'text-gph-dark-ink hover:bg-gph-dark-linesoft' : 'text-gray-900 hover:bg-gray-50'
                                            }`}
                                          >
                                            <span className="text-left">{formatDayLabel(date)}</span>
                                            {alreadyAdded && (
                                              <svg className="w-3.5 h-3.5 shrink-0 text-cv-green-500" viewBox="0 0 12 12" fill="none">
                                                <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                              </svg>
                                            )}
                                          </button>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                                <div className={`my-1 border-t ${isDark ? 'border-gph-dark-line' : 'border-gray-200'}`} />
                                <button
                                  onClick={() => { removeActivity(trip.id, a.id); setOpenMenuId(null); }}
                                  className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${isDark ? 'text-rose-400 hover:bg-gph-dark-linesoft' : 'text-rose-500 hover:bg-rose-50'}`}
                                >
                                  Remove from trip
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className={`flex items-center px-4 py-2.5 border-t ${dividerCls}`}>
                        <button
                          onClick={() => toggleNotes(notesKey)}
                          className={`px-2.5 py-1 rounded-full text-xs transition-all hover:scale-[1.03] ${
                            showNotes
                              ? isDark ? 'bg-gph-dark-card text-gph-dark-ink' : 'bg-gray-200 text-gray-700'
                              : isDark ? 'bg-gph-dark-linesoft text-gph-dark-ink' : 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {showNotes ? 'Notes ↑' : '+ Notes'}
                        </button>
                      </div>
                      {showNotes && (
                        <div className={`border-t px-4 pt-2 pb-3 ${dividerCls}`}>
                          <textarea
                            value={a.notes ?? ''}
                            onChange={(e) => patchActivity(trip.id, a.id, { notes: e.target.value || undefined })}
                            placeholder="Add notes…" rows={2}
                            className={`w-full text-xs resize-none bg-transparent outline-none placeholder:opacity-50 ${isDark ? 'text-gph-dark-ink placeholder:text-gph-dark-muted' : 'text-gray-800 placeholder:text-gray-400'}`}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Day-by-day */}
          {days.map((date, di) => {
            const dayActivities = (trip.itinerary_days ?? {})[date] ?? [];
            const { num, day, month } = parseDayParts(date);
            const isFirst = di === 0;
            const isLast = di === days.length - 1;
            const isExternalDropTarget = dragState !== null && dragState.sourceDate !== date && dropTarget?.date === date;

            return (
              <div key={date} className="mb-10">
                {/* Day header */}
                <div className={`flex items-center gap-3 pb-3 mb-4 border-b-2 ${isDark ? 'border-gph-dark-ink' : 'border-gray-900'}`}>
                  <span className={`text-5xl font-black font-mono leading-none tracking-tight ${ink}`}>{num}</span>
                  <span className={`text-[9px] font-mono font-bold tracking-widest ${muted}`}>{month}</span>
                  <span className={`text-base font-bold tracking-tight ${ink}`}>{day}</span>
                  <div className="flex-1" />
                  {isFirst && (
                    <span className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded tracking-widest ${
                      isDark ? 'bg-gph-dark-linesoft text-gph-dark-muted' : 'bg-gray-100 text-gray-500'
                    }`}>↓ ARRIVAL</span>
                  )}
                  {isLast && (
                    <span className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded tracking-widest ${
                      isDark ? 'bg-gph-dark-linesoft text-gph-dark-muted' : 'bg-gray-100 text-gray-500'
                    }`}>DEPARTURE ↑</span>
                  )}
                  <span className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded tracking-widest ${
                    isDark ? 'bg-gph-dark-linesoft text-gph-dark-muted' : 'bg-gray-100 text-gray-500'
                  }`}>{dayActivities.length} STOP{dayActivities.length !== 1 ? 'S' : ''}</span>
                </div>

                {/* Drop zone for empty day */}
                {dayActivities.length === 0 ? (
                  <div
                    className={`py-8 flex items-center justify-center rounded-xl border-2 border-dashed transition-colors ${
                      dropTarget?.date === date
                        ? isDark ? 'border-gph-dark-action bg-gph-dark-linesoft' : 'border-gray-400 bg-gray-50'
                        : isDark ? 'border-gph-dark-line' : 'border-gray-200'
                    } ${isExternalDropTarget ? isDark ? 'ring-1 ring-gph-dark-action' : 'ring-1 ring-gray-400' : ''}`}
                    onDragOver={(e) => { e.preventDefault(); setDropTarget({ date, index: 0 }); }}
                    onDrop={(e) => { e.preventDefault(); handleDrop(date, 0); }}
                  >
                    {dropTarget?.date === date ? (
                      <div className="h-0.5 w-2/3 rounded-full bg-lime-500" />
                    ) : (
                      <p className={`text-sm ${muted}`}>Nothing planned yet</p>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col gap-0" onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); handleDrop(date, dayActivities.length); }}>
                    {dayActivities.map((a, idx) => {
                      const iKey = `${date}::${a.id}`;
                      const showItinNotes = expandedNotes.has(iKey) || !!a.notes;
                      const isDraggingThis = dragState?.activityId === a.id && dragState?.sourceDate === date;

                      return (
                        <Fragment key={a.id}>
                          {dropTarget?.date === date && dropTarget.index === idx && !isDraggingThis && (
                            <div className="h-0.5 rounded-full bg-lime-500 mx-4 mb-1" />
                          )}
                          <div
                            draggable
                            onDragStart={(e) => { e.dataTransfer.effectAllowed = 'move'; setDragState({ sourceDate: date, activityId: a.id, sourceIndex: idx }); }}
                            onDragEnd={() => { setDragState(null); setDropTarget(null); }}
                            onDragOver={(e) => {
                              e.preventDefault(); e.stopPropagation(); e.dataTransfer.dropEffect = 'move';
                              const rect = e.currentTarget.getBoundingClientRect();
                              setDropTarget({ date, index: e.clientY < rect.top + rect.height / 2 ? idx : idx + 1 });
                            }}
                            onDrop={(e) => {
                              e.preventDefault(); e.stopPropagation();
                              const rect = e.currentTarget.getBoundingClientRect();
                              handleDrop(date, e.clientY < rect.top + rect.height / 2 ? idx : idx + 1);
                            }}
                            className={`rounded-xl border overflow-hidden transition-opacity cursor-grab active:cursor-grabbing select-none mb-2 ${
                              isDark ? 'bg-gph-dark-card border-gph-dark-line' : 'bg-white border-gray-200'
                            } ${isDraggingThis ? 'opacity-40' : ''}`}
                          >
                            {/* HxItinerary-style main row */}
                            <div className="grid items-center gap-x-3 px-3 py-3" style={{ gridTemplateColumns: '60px 1fr auto 28px' }}>

                              {/* Time column */}
                              <div className={`flex flex-col items-center justify-center gap-0.5 border-r pr-3 ${isDark ? 'border-gph-dark-line' : 'border-gray-100'}`}>
                                <input
                                  type="time" draggable={false} value={a.time ?? ''}
                                  onChange={(e) => patchItineraryActivity(trip.id, date, a.id, { time: e.target.value || undefined })}
                                  className={`bg-transparent outline-none border-none text-xs font-mono font-bold text-center w-full leading-tight ${ink} ${isDark ? 'scheme-dark' : 'scheme-light'}`}
                                />
                                <span className={`text-[8px] font-mono uppercase tracking-widest ${muted}`}>time</span>
                                <div className={`w-full border-t mt-0.5 pt-0.5 ${isDark ? 'border-gph-dark-line' : 'border-gray-100'}`}>
                                  <input
                                    type="time" draggable={false} value={a.duration ?? ''}
                                    onChange={(e) => patchItineraryActivity(trip.id, date, a.id, { duration: e.target.value || undefined })}
                                    className={`bg-transparent outline-none border-none text-[10px] font-mono text-center w-full leading-tight ${muted} ${isDark ? 'scheme-dark' : 'scheme-light'}`}
                                  />
                                  <span className={`block text-[8px] font-mono uppercase tracking-widest text-center ${muted}`}>dur</span>
                                </div>
                              </div>

                              {/* Content column */}
                              <div className="flex items-center gap-2.5 min-w-0">
                                {a.photo_url ? (
                                  <img src={a.photo_url} alt={a.name} className="w-11 h-11 shrink-0 rounded-lg object-cover" draggable={false} />
                                ) : (
                                  <div className={`w-11 h-11 shrink-0 rounded-lg flex items-center justify-center text-base ${isDark ? 'bg-gph-dark-linesoft' : 'bg-gray-100'}`}>📍</div>
                                )}
                                <div className="flex-1 min-w-0">
                                  <span className={`inline-block text-[8px] font-mono font-bold tracking-widest uppercase px-1.5 py-0.5 rounded mb-0.5 ${getActivityTagCls(a.name, isDark)}`}>
                                    {getActivityTag(a.name)}
                                  </span>
                                  <p className={`text-sm font-semibold truncate leading-tight ${ink}`}>{a.name}</p>
                                  {a.address && <p className={`text-[11px] truncate mt-0.5 ${muted}`}>{a.address}</p>}
                                </div>
                              </div>

                              {/* Cost column */}
                              <div className="flex flex-col items-end justify-center">
                                <div className={`flex items-center gap-0.5 text-sm font-mono font-bold ${ink}`}>
                                  <span>$</span>
                                  <input
                                    type="text" inputMode="decimal" draggable={false} value={a.price ?? 0}
                                    onChange={(e) => { const n = parseFloat(e.target.value); patchItineraryActivity(trip.id, date, a.id, { price: isNaN(n) ? 0 : n }); }}
                                    className={`bg-transparent outline-none border-none text-sm font-mono font-bold w-12 text-right ${ink}`}
                                  />
                                </div>
                                <button
                                  draggable={false}
                                  onClick={() => patchItineraryActivity(trip.id, date, a.id, { price_type: (a.price_type ?? 'per_person') === 'per_person' ? 'total' : 'per_person' })}
                                  className={`text-[8px] font-mono uppercase tracking-wide opacity-50 hover:opacity-100 transition-opacity ${muted}`}
                                >
                                  {(a.price_type ?? 'per_person') === 'per_person' ? '/person' : 'total'}
                                </button>
                              </div>

                              {/* Actions column */}
                              <div className="flex flex-col items-center justify-center gap-1.5">
                                <button
                                  draggable={false}
                                  onClick={() => removeActivityFromDay(trip.id, date, a.id)}
                                  className={`w-6 h-6 flex items-center justify-center rounded-full transition-colors ${
                                    isDark ? 'text-gph-dark-muted hover:bg-gph-dark-linesoft hover:text-gph-dark-ink' : 'text-gray-300 hover:bg-gray-100 hover:text-gray-600'
                                  }`}
                                >
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                  </svg>
                                </button>
                                <button
                                  draggable={false} onClick={() => toggleNotes(iKey)}
                                  className={`w-6 h-6 flex items-center justify-center rounded-full transition-colors ${
                                    showItinNotes
                                      ? isDark ? 'bg-gph-dark-linesoft text-gph-dark-ink' : 'bg-gray-200 text-gray-600'
                                      : isDark ? 'text-gph-dark-muted hover:bg-gph-dark-linesoft hover:text-gph-dark-ink' : 'text-gray-300 hover:bg-gray-100 hover:text-gray-600'
                                  }`}
                                >
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M7 8h10M7 12h6m-6 4h4" />
                                  </svg>
                                </button>
                              </div>
                            </div>

                            {showItinNotes && (
                              <div className={`px-3 pb-3 pt-1 border-t ${dividerCls}`}>
                                <textarea
                                  draggable={false} value={a.notes ?? ''}
                                  onChange={(e) => patchItineraryActivity(trip.id, date, a.id, { notes: e.target.value || undefined })}
                                  placeholder="Add notes…" rows={2}
                                  className={`w-full text-xs resize-none bg-transparent outline-none placeholder:opacity-50 ${isDark ? 'text-gph-dark-ink placeholder:text-gph-dark-muted' : 'text-gray-800 placeholder:text-gray-400'}`}
                                />
                              </div>
                            )}
                          </div>
                          {idx === dayActivities.length - 1 && dropTarget?.date === date && dropTarget.index === dayActivities.length && !isDraggingThis && (
                            <div className="h-0.5 rounded-full bg-lime-500 mx-4 mt-1" />
                          )}
                        </Fragment>
                      );
                    })}
                  </div>
                )}

                <button
                  className={`mt-3 w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl border-2 border-dashed text-xs font-medium transition-colors ${
                    isDark ? 'border-gph-dark-line text-gph-dark-muted hover:border-gph-dark-muted hover:text-gph-dark-ink' : 'border-gray-200 text-gray-400 hover:border-gray-400 hover:text-gray-600'
                  }`}
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                  Add stop to {day} {num}
                </button>
              </div>
            );
          })}

        </section>

        {/* ── Sidebar ────────────────────────────────────────────────────────── */}
        <aside className={`px-5 py-8 flex flex-col gap-6 lg:sticky lg:top-0 lg:h-screen lg:overflow-y-auto ${cardBg}`}>

          {/* Points tip — placeholder */}
          <div className={`p-4 rounded-xl border ${isDark ? 'bg-gph-dark-linesoft border-gph-dark-line' : 'bg-gray-50 border-gray-200'}`}>
            <p className={`text-[9px] font-mono font-bold uppercase tracking-widest mb-2 text-cv-blue-600`}>✦ Pts tip</p>
            <p className={`text-xs leading-relaxed ${isDark ? 'text-gph-dark-muted' : 'text-gray-500'}`}>
              Points transfer bonuses and redemption tips will appear here once you connect your loyalty accounts.
            </p>
            <button className={`mt-3 text-[10px] font-mono font-bold uppercase tracking-[0.08em] px-3 py-1.5 rounded-md transition-colors ${
              isDark ? 'bg-gph-dark-action text-gph-dark-bg' : 'bg-gray-900 text-white'
            }`}>Connect cards →</button>
          </div>

          {/* Map */}
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <p className={`text-[10px] font-mono font-bold uppercase tracking-widest ${muted}`}>{trip.destination.split(',')[0].toUpperCase()} · MAP</p>
              <button
                onClick={() => setMapExpanded(true)}
                className={`flex items-center gap-1 text-[10px] font-mono font-bold tracking-[0.06em] transition-colors ${ink} hover:text-lime-500`}
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
                </svg>
                Expand
              </button>
            </div>
            <div className={`h-[480px] relative rounded-xl overflow-hidden border ${borderCls}`}>
              <TripMap
                lat={trip.destination_lat}
                lng={trip.destination_lng}
                destination={trip.destination}
                isDark={isDark}
                borderCls={borderCls}
                minimized={false}
                onToggleMinimize={() => {}}
                hideHeader
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

          {/* Expanded map overlay */}
          {mapExpanded && (
            <div className="fixed inset-0 z-50 flex flex-col" style={{ background: isDark ? '#0a0a0b' : '#111827' }}>
              {/* Overlay header */}
              <div className={`flex items-center justify-between px-5 py-3 shrink-0 border-b ${
                isDark ? 'bg-gph-dark-card border-gph-dark-line' : 'bg-white border-gray-200'
              }`}>
                <div className="flex items-center gap-3">
                  <span className={`text-[10px] font-mono font-bold uppercase tracking-widest ${muted}`}>{trip.destination.split(',')[0].toUpperCase()} · MAP</span>
                  <span className={`w-px h-3 ${isDark ? 'bg-gph-dark-line' : 'bg-gray-200'}`} />
                  <span className={`text-[10px] font-mono font-semibold ${muted}`}>{(trip.pins ?? []).length} pin{(trip.pins ?? []).length !== 1 ? 's' : ''} · click the map to add stops</span>
                </div>
                <button
                  onClick={() => setMapExpanded(false)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                    isDark ? 'border-gph-dark-line text-gph-dark-ink hover:bg-gph-dark-linesoft' : 'border-gray-200 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5l5.25 5.25" />
                  </svg>
                  Collapse
                </button>
              </div>
              {/* Full map */}
              <div className="flex-1 relative">
                <TripMap
                  lat={trip.destination_lat}
                  lng={trip.destination_lng}
                  destination={trip.destination}
                  isDark={isDark}
                  borderCls={borderCls}
                  minimized={false}
                  onToggleMinimize={() => {}}
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
          )}

          {/* Weather — placeholder */}
          <div className={`rounded-xl border p-4 ${borderCls}`}>
            <p className={`text-[10px] font-mono font-bold uppercase tracking-widest mb-3 ${muted}`}>Weather · forecast</p>
            <div className="grid grid-cols-4 gap-2">
              {days.slice(0, 4).map((d) => {
                const { day } = parseDayParts(d);
                return (
                  <div key={d} className={`flex flex-col items-center gap-1 py-2.5 rounded-lg ${isDark ? 'bg-gph-dark-linesoft' : 'bg-gray-50'}`}>
                    <p className={`text-[9px] font-mono font-bold tracking-widest ${muted}`}>{day}</p>
                    <svg className="w-4 h-4 text-cv-amber-400" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2.25a.75.75 0 01.75.75v2.25a.75.75 0 01-1.5 0V3a.75.75 0 01.75-.75zM7.5 12a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM18.894 6.166a.75.75 0 00-1.06-1.06l-1.591 1.59a.75.75 0 101.06 1.061l1.591-1.59zM21.75 12a.75.75 0 01-.75.75h-2.25a.75.75 0 010-1.5H21a.75.75 0 01.75.75zM17.834 18.894a.75.75 0 001.06-1.06l-1.59-1.591a.75.75 0 10-1.061 1.06l1.59 1.591zM12 18a.75.75 0 01.75.75V21a.75.75 0 01-1.5 0v-2.25A.75.75 0 0112 18zM7.758 17.303a.75.75 0 00-1.061-1.06l-1.591 1.59a.75.75 0 001.06 1.061l1.592-1.59zM6 12a.75.75 0 01-.75.75H3a.75.75 0 010-1.5h2.25A.75.75 0 016 12zM6.697 7.757a.75.75 0 001.06-1.06l-1.59-1.591a.75.75 0 00-1.061 1.06l1.59 1.591z" />
                    </svg>
                    <p className={`text-[11px] font-mono font-bold ${ink}`}>—</p>
                  </div>
                );
              })}
            </div>
            <p className={`text-[9px] font-mono text-center mt-2 ${muted}`}>Weather integration coming soon</p>
          </div>

          {/* Cards in play — placeholder */}
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <p className={`text-[10px] font-mono font-bold uppercase tracking-widest ${muted}`}>Cards in play</p>
              <Link href="/" className={`text-[10px] font-mono font-bold tracking-[0.06em] ${ink}`}>Manage →</Link>
            </div>
            <div className={`rounded-xl border-2 border-dashed flex flex-col items-center justify-center py-6 gap-2 ${borderCls}`}>
              <svg className="w-6 h-6 opacity-30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
              </svg>
              <p className={`text-xs text-center ${muted}`}>Connect your cards to see points across Chase, Amex, Capital One & more.</p>
              <Link href="/" className={`text-[10px] font-mono font-bold uppercase tracking-widest px-3 py-1.5 rounded-md transition-colors ${
                isDark ? 'bg-gph-dark-action text-gph-dark-bg' : 'bg-gray-900 text-white'
              }`}>Add cards</Link>
            </div>
          </div>
        </aside>
      </div>

      {/* ── Flights ──────────────────────────────────────────────────────────── */}
      <section ref={flightsRef}>
        <SectionHead
          isDark={isDark}
          label={`Flights · ${flights.length} saved · ${bookedFlightCount} booked`}
          title="Flights you've shortlisted"
          right={
            <Link
              href={`/?destination=${encodeURIComponent(trip.destination)}&departDate=${trip.start_date}&returnDate=${trip.end_date}&tripType=roundtrip`}
              className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors ${
                isDark ? 'border-gph-dark-line text-gph-dark-ink hover:bg-gph-dark-linesoft' : 'border-gray-200 text-gray-700 hover:bg-gray-50'
              }`}
            >
              + Search more
            </Link>
          }
        />
        <div className={`px-6 pb-10 ${isDark ? 'bg-gph-dark-card' : 'bg-white'}`}>
          {flights.length === 0 ? (
            <div className={`rounded-xl border-2 border-dashed flex flex-col items-center justify-center py-14 gap-3 ${isDark ? 'border-gph-dark-line' : 'border-gray-200'}`}>
              <svg className="w-8 h-8 opacity-20" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
              </svg>
              <p className={`text-sm font-semibold ${isDark ? 'text-gph-dark-muted' : 'text-gray-400'}`}>No flights saved yet</p>
              <p className={`text-xs ${isDark ? 'text-gph-dark-muted' : 'text-gray-400'}`}>Heart a flight from search to save it here</p>
              <Link
                href={`/flights?destination=${encodeURIComponent(trip.destination)}&departDate=${trip.start_date}&returnDate=${trip.end_date}&tripType=roundtrip`}
                className="px-4 py-2 rounded-lg bg-lime-500 hover:bg-lime-400 text-black text-xs font-bold transition-colors"
              >
                Search flights →
              </Link>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {flights.map((bm) => (
                <div key={bm.id} className={`rounded-xl border overflow-hidden transition-colors ${
                  bookedFlights.has(bm.id)
                    ? isDark ? 'border-cv-blue-600 bg-cv-blue-950/30' : 'border-cv-blue-600 bg-cv-blue-50'
                    : isDark ? 'border-gph-dark-line' : 'border-gray-200'
                }`}>
                  <div className="p-4">
                    <FlightCard offer={bm.data} />
                  </div>
                  <div className={`flex items-center justify-between px-4 py-3 border-t ${dividerCls}`}>
                    <div className="flex items-center gap-2">
                      <BookedToggle booked={bookedFlights.has(bm.id)} onClick={() => toggleBookedFlight(bm.id)} isDark={isDark} />
                      <span className={`text-[10px] font-mono font-semibold ${muted}`}>Pts compare coming soon</span>
                    </div>
                    <button
                      onClick={() => {}}
                      className={`text-xs font-medium transition-colors ${isDark ? 'text-gph-dark-muted hover:text-red-400' : 'text-gray-400 hover:text-red-500'}`}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ── Hotels ───────────────────────────────────────────────────────────── */}
      <section ref={hotelsRef}>
        <SectionHead
          isDark={isDark}
          label={`Lodging · ${hotels.length} saved · ${bookedHotelCount} booked`}
          title="Stays you've shortlisted"
          right={
            <Link
              href={`/hotels?destination=${encodeURIComponent(trip.destination)}&lat=${trip.destination_lat ?? ''}&lng=${trip.destination_lng ?? ''}&checkIn=${trip.start_date}&checkOut=${trip.end_date}&adults=${trip.travelers.adults}&children=${trip.travelers.children}`}
              className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors ${
                isDark ? 'border-gph-dark-line text-gph-dark-ink hover:bg-gph-dark-linesoft' : 'border-gray-200 text-gray-700 hover:bg-gray-50'
              }`}
            >
              + Search more
            </Link>
          }
        />
        <div className={`px-6 pb-10 ${isDark ? 'bg-gph-dark-card' : 'bg-white'}`}>
          {hotels.length === 0 ? (
            <div className={`rounded-xl border-2 border-dashed flex flex-col items-center justify-center py-14 gap-3 ${isDark ? 'border-gph-dark-line' : 'border-gray-200'}`}>
              <svg className="w-8 h-8 opacity-20" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" />
              </svg>
              <p className={`text-sm font-semibold ${isDark ? 'text-gph-dark-muted' : 'text-gray-400'}`}>No hotels saved yet</p>
              <p className={`text-xs ${isDark ? 'text-gph-dark-muted' : 'text-gray-400'}`}>Heart a hotel from search to save it here</p>
              <Link
                href={`/hotels?destination=${encodeURIComponent(trip.destination)}&lat=${trip.destination_lat ?? ''}&lng=${trip.destination_lng ?? ''}&checkIn=${trip.start_date}&checkOut=${trip.end_date}&adults=${trip.travelers.adults}`}
                className="px-4 py-2 rounded-lg bg-lime-500 hover:bg-lime-400 text-black text-xs font-bold transition-colors"
              >
                Search hotels →
              </Link>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {hotels.map((bm) => (
                <div key={bm.id} className={`rounded-xl border overflow-hidden transition-colors ${
                  bookedHotels.has(bm.id)
                    ? isDark ? 'border-cv-blue-600 bg-cv-blue-950/30' : 'border-cv-blue-600 bg-cv-blue-50'
                    : isDark ? 'border-gph-dark-line' : 'border-gray-200'
                }`}>
                  <div className="p-4">
                    <HotelCard searchResult={bm.data} defaultCollapsed />
                  </div>
                  <div className={`flex items-center justify-between px-4 py-3 border-t ${dividerCls}`}>
                    <div className="flex items-center gap-2">
                      <BookedToggle booked={bookedHotels.has(bm.id)} onClick={() => toggleBookedHotel(bm.id)} isDark={isDark} />
                      <span className={`text-[10px] font-mono font-semibold ${muted}`}>Pts compare coming soon</span>
                    </div>
                    <button
                      onClick={() => {}}
                      className={`text-xs font-medium transition-colors ${isDark ? 'text-gph-dark-muted hover:text-red-400' : 'text-gray-400 hover:text-red-500'}`}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ── Budget — placeholder ─────────────────────────────────────────────── */}
      <section ref={budgetRef}>
        <SectionHead
          isDark={isDark}
          label="Budget · points + cash"
          title="The numbers behind it"
        />
        <PlaceholderSection
          isDark={isDark}
          label="Budget tracking"
          description="Automatic cost aggregation from your booked flights, hotels, and itinerary stops — with a points vs. cash breakdown — coming soon."
        />
      </section>

      {/* ── Notes — placeholder ──────────────────────────────────────────────── */}
      <section ref={notesRef}>
        <SectionHead
          isDark={isDark}
          label="Notes · derived from your plan"
          title="What you wrote down"
        />
        <PlaceholderSection
          isDark={isDark}
          label="Trip notes"
          description="Notes anchored to flights, hotels, and itinerary stops will be aggregated here automatically. Add notes inside each section above."
        />
      </section>

      {/* ── Footer ──────────────────────────────────────────────────────────── */}
      <footer className={`flex items-center justify-between px-6 py-5 border-t font-mono text-[11px] font-bold tracking-[0.06em] ${
        isDark ? 'bg-gph-dark-navy border-gph-dark-line text-gph-dark-muted' : 'bg-gray-900 border-gray-800 text-gray-400'
      }`}>
        <span className="text-white opacity-60">COVELO · {trip.destination.split(',')[0].toUpperCase()} · Continue building this trip →</span>
        <Link href="/trip-planner" className="text-white opacity-40 hover:opacity-80 transition-opacity">
          All trips ↗
        </Link>
      </footer>
    </div>
  );
}
