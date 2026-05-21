'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { LocationSearch } from '@/components/LocationSearch';
import { NavBar } from '@/components/NavBar';
import { useTheme } from '@/contexts/ThemeContext';
import { useTrips } from '@/hooks/useTrips';
import { trpc } from '@/lib/trpc-client';
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

// ─── World Map SVG ────────────────────────────────────────────────────────────

function WorldMapDotted({ isDark }: { isDark: boolean }) {
  const dotColor = isDark ? '#2c2c30' : '#c9c9c2';
  const bgColor  = isDark ? '#0a0a0b' : '#eef1ec';

  const continents = [
    // North America
    'M 90 110 L 130 88 L 200 78 L 280 78 L 330 90 L 365 110 L 385 130 L 400 152 L 392 175 L 365 188 L 372 210 L 388 230 L 380 252 L 358 252 L 340 240 L 318 232 L 295 245 L 300 268 L 320 288 L 345 305 L 360 318 L 348 322 L 318 305 L 290 280 L 268 258 L 248 240 L 232 222 L 215 205 L 200 188 L 188 168 L 178 148 L 158 128 L 132 112 L 100 105 Z',
    // Baja California
    'M 222 220 L 235 235 L 250 268 L 240 275 L 224 250 Z',
    // Greenland
    'M 480 60 L 540 56 L 568 85 L 560 125 L 525 138 L 495 122 L 482 92 Z',
    // South America
    'M 348 320 L 410 318 L 458 348 L 478 388 L 472 432 L 455 472 L 435 502 L 410 528 L 388 540 L 372 528 L 365 498 L 362 462 L 363 425 L 360 388 L 355 354 L 350 332 Z',
    // Europe
    'M 605 138 L 660 130 L 720 138 L 745 158 L 740 182 L 712 198 L 678 203 L 642 200 L 612 192 L 600 168 Z',
    // British Isles
    'M 588 145 L 605 148 L 608 178 L 595 185 L 582 165 Z',
    // Scandinavia
    'M 648 75 L 690 80 L 712 105 L 700 132 L 678 130 L 655 110 Z',
    // Iceland
    'M 555 105 L 580 100 L 588 122 L 568 128 L 552 118 Z',
    // Africa
    'M 620 215 L 705 208 L 760 222 L 790 248 L 802 290 L 798 335 L 778 380 L 752 422 L 720 452 L 692 462 L 670 452 L 652 422 L 638 380 L 628 335 L 620 290 L 618 250 Z',
    // Arabian Peninsula
    'M 745 222 L 790 218 L 810 245 L 818 280 L 800 302 L 770 298 L 752 275 L 745 248 Z',
    // Madagascar
    'M 778 388 L 792 405 L 788 442 L 772 435 L 770 408 Z',
    // Asia main
    'M 745 105 L 830 92 L 920 85 L 1010 88 L 1080 100 L 1130 118 L 1138 145 L 1118 168 L 1080 180 L 1052 195 L 1075 215 L 1098 245 L 1085 268 L 1055 278 L 1022 268 L 992 252 L 968 252 L 980 282 L 962 298 L 938 292 L 912 270 L 888 252 L 860 232 L 832 222 L 802 215 L 778 205 L 758 188 L 745 162 L 738 132 Z',
    // India
    'M 870 232 L 920 262 L 920 305 L 895 318 L 875 290 L 866 258 Z',
    // Indochina
    'M 982 262 L 1008 280 L 1018 312 L 1000 322 L 982 302 L 975 280 Z',
    // Japan
    'M 1118 178 L 1138 192 L 1132 228 L 1115 222 L 1108 198 Z',
    // Indonesia west
    'M 960 318 L 998 320 L 1028 326 L 1022 340 L 985 340 L 958 333 Z',
    // Borneo cluster
    'M 1038 318 L 1075 318 L 1082 338 L 1052 340 L 1035 332 Z',
    // New Guinea
    'M 1095 340 L 1138 342 L 1148 358 L 1112 360 L 1095 352 Z',
    // Philippines
    'M 1060 268 L 1072 285 L 1070 308 L 1058 308 L 1055 285 Z',
    // Australia
    'M 1078 405 L 1148 398 L 1182 410 L 1192 438 L 1170 460 L 1118 462 L 1080 452 L 1065 432 Z',
    // New Zealand
    'M 1198 458 L 1215 470 L 1208 498 L 1192 488 L 1192 468 Z',
  ];

  return (
    <svg
      viewBox="0 0 1280 760"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      className="absolute inset-0 w-full h-full"
    >
      <defs>
        <pattern id="tp-land-dots" width="10" height="10" patternUnits="userSpaceOnUse">
          <circle cx="2" cy="2" r="1.4" fill={dotColor} />
        </pattern>
        <mask id="tp-land-mask">
          <rect width="1280" height="760" fill="black" />
          <g transform="translate(40, 80)" fill="white">
            {continents.map((d, i) => <path key={i} d={d} />)}
          </g>
        </mask>
      </defs>
      <rect width="1280" height="760" fill={bgColor} />
      <rect width="1280" height="760" fill="url(#tp-land-dots)" mask="url(#tp-land-mask)" />
      {/* Equator guide */}
      <line
        x1="0" y1="380" x2="1280" y2="380"
        stroke={isDark ? '#1a1a1d' : '#dcdcd6'}
        strokeWidth="0.5"
        strokeDasharray="2 4"
        opacity="0.6"
      />
    </svg>
  );
}

// ─── Decorative Map Pins ──────────────────────────────────────────────────────

interface PinDef {
  // percent of SVG viewBox (1280×760)
  xPct: number;
  yPct: number;
  label: string;
}

const MAP_PINS: PinDef[] = [
  { xPct: 615 / 1280, yPct: 258 / 760, label: 'LIS' },
  { xPct: 740 / 1280, yPct: 242 / 760, label: 'IST' },
  { xPct: 712 / 1280, yPct: 498 / 760, label: 'CPT' },
  { xPct: 1110 / 1280, yPct: 270 / 760, label: 'TYO' },
  { xPct: 1028 / 1280, yPct: 395 / 760, label: 'SIN' },
  { xPct: 470 / 1280, yPct: 460 / 760, label: 'RIO' },
];

function MapPin({ pin, isDark }: { pin: PinDef; isDark: boolean }) {
  const inkColor  = isDark ? '#f3f3f1' : '#0c0c0d';
  const cardColor = isDark ? '#161618' : '#ffffff';
  const lineColor = isDark ? '#262629' : '#e3e3e1';

  return (
    <div
      className="absolute flex-col items-center gap-1 pointer-events-none hidden md:flex"
      style={{ left: `${pin.xPct * 100}%`, top: `${pin.yPct * 100}%`, transform: 'translate(-50%,-50%)' }}
    >
      {/* Halo */}
      <div className="absolute inset-0 rounded-full opacity-20" style={{ background: '#84cc16', width: 30, height: 30, margin: -7 }} />
      {/* Dot */}
      <div
        className="w-4 h-4 rounded-full border-2 shadow-sm"
        style={{ background: inkColor, borderColor: cardColor }}
      />
      {/* Label */}
      <div
        className="text-[9px] font-mono font-black tracking-wider px-1.5 py-0.5 rounded border whitespace-nowrap"
        style={{ background: cardColor, color: inkColor, borderColor: lineColor }}
      >
        {pin.label}
      </div>
    </div>
  );
}

// ─── Premium Feature Badge ────────────────────────────────────────────────────

function PremiumBadge() {
  return (
    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[8px] font-mono font-black tracking-wider bg-lime-500 text-black uppercase">
      Soon
    </span>
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

function SectionLabel({ children, isDark }: { children: React.ReactNode; isDark: boolean }) {
  return (
    <p className={`text-[10px] font-semibold uppercase tracking-widest mb-2 ${isDark ? 'text-gph-dark-muted' : 'text-gray-500'}`}>
      {children}
    </p>
  );
}

// ─── Compact Trip Card (for bottom rail) ─────────────────────────────────────

// Muted palette for destination thumbnails — cycled by trip index
const THUMB_COLORS = ['#8FA3BF', '#C4A882', '#8A9BAD', '#9BAF8A', '#B08FAD'];

function TripRailCard({
  trip, index, onDelete, isDark,
}: { trip: Trip; index: number; onDelete: () => void; isDark: boolean }) {
  const router = useRouter();
  const nights = nightsBetween(trip.start_date, trip.end_date);
  const cardBg = isDark
    ? 'bg-gph-dark-card border-gph-dark-line hover:bg-gph-dark-linesoft hover:border-gph-dark-muted'
    : 'bg-white border-gray-200 hover:bg-gray-50 hover:border-gray-300';
  const textPrimary = isDark ? 'text-gph-dark-ink' : 'text-gray-900';
  const textMuted = isDark ? 'text-gph-dark-muted' : 'text-gray-500';
  const thumbColor = THUMB_COLORS[index % THUMB_COLORS.length];
  const cityName = trip.destination.split(',')[0].trim();

  const { data: photoUrl } = useQuery({
    queryKey: ['place-photo', trip.destination],
    queryFn: () => trpc.places.getPhoto.query({ name: cityName, address: trip.destination }),
    staleTime: 1000 * 60 * 60 * 24 * 7,
  });

  const dateStr = (() => {
    const s = new Date(trip.start_date + 'T00:00:00');
    const e = new Date(trip.end_date + 'T00:00:00');
    const fmt = (d: Date) => d.toLocaleDateString([], { month: 'short', day: 'numeric' });
    return `${fmt(s)} – ${fmt(e)}`;
  })();

  return (
    <div
      className={`flex items-stretch rounded-xl border shrink-0 w-72 cursor-pointer group transition-colors overflow-hidden ${cardBg}`}
      onClick={() => router.push(`/trip-planner/${trip.id}`)}
    >
      {/* Photo / colour swatch */}
      <div className="w-20 shrink-0 relative">
        {photoUrl ? (
          <img
            src={photoUrl}
            alt={cityName}
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <div className="absolute inset-0" style={{ background: thumbColor }} />
        )}
      </div>

      {/* Text */}
      <div className="flex-1 min-w-0 flex items-center gap-2 px-4 py-4">
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-bold truncate leading-snug ${textPrimary}`}>{trip.title}</p>
          <p className={`text-[10px] font-mono font-semibold tracking-wider mt-1 uppercase ${textMuted}`}>
            {dateStr} · {nights}N
          </p>
        </div>

        {/* Remove button */}
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center transition-colors opacity-0 group-hover:opacity-100 ${isDark ? 'hover:bg-gph-dark-line text-gph-dark-muted hover:text-gph-dark-ink' : 'hover:bg-gray-200 text-gray-400 hover:text-gray-700'}`}
          aria-label="Remove trip"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}

// ─── Duplicate Warning ────────────────────────────────────────────────────────

function DupeWarning({
  dupeTrips, onDelete, onIgnore, isDark,
}: {
  dupeTrips: Trip[];
  onDelete: (id: string) => void;
  onIgnore: () => void;
  isDark: boolean;
}) {
  const router = useRouter();
  const cardBg = isDark ? 'bg-gph-dark-card border-gph-dark-line' : 'bg-white border-gray-200';
  const textPrimary = isDark ? 'text-gph-dark-ink' : 'text-gray-900';
  const textMuted = isDark ? 'text-gph-dark-muted' : 'text-gray-500';

  return (
    <div className="w-full flex flex-col gap-3 mt-4">
      <div className={`rounded-xl px-4 py-3 flex items-start gap-3 ${isDark ? 'bg-cv-amber-900/40 border border-cv-amber-700/40' : 'bg-amber-50 border border-amber-200'}`}>
        <svg className={`w-4 h-4 mt-0.5 shrink-0 ${isDark ? 'text-cv-amber-300' : 'text-amber-700'}`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
        </svg>
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-medium ${isDark ? 'text-cv-amber-300' : 'text-amber-900'}`}>
            You already have {dupeTrips.length === 1 ? 'a trip' : 'trips'} in this area
          </p>
          <p className={`text-xs mt-0.5 ${isDark ? 'text-cv-amber-400' : 'text-amber-700'}`}>
            Continue planning an existing trip, or create a new one anyway.
          </p>
        </div>
        <button
          onClick={onIgnore}
          className={`shrink-0 text-xs font-medium underline underline-offset-2 ${isDark ? 'text-cv-amber-300 hover:text-cv-amber-200' : 'text-amber-900 hover:text-amber-700'}`}
        >
          Create anyway
        </button>
      </div>
      {dupeTrips.map((trip) => {
        const nights = nightsBetween(trip.start_date, trip.end_date);
        return (
          <div key={trip.id} className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${cardBg}`}>
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-bold truncate ${textPrimary}`}>{trip.title}</p>
              <p className={`text-xs mt-0.5 ${textMuted}`}>{formatDateRange(trip.start_date, trip.end_date)} · {nights}n</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => onDelete(trip.id)}
                className={`text-xs font-medium transition-colors ${isDark ? 'text-gph-dark-muted hover:text-red-400' : 'text-gray-500 hover:text-red-500'}`}
              >
                Delete
              </button>
              <button
                onClick={() => router.push(`/trip-planner/${trip.id}`)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${isDark ? 'bg-gph-dark-action text-gph-dark-bg' : 'bg-gray-900 text-white'}`}
              >
                Open →
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Trip Creation Form ───────────────────────────────────────────────────────

function TripCreateForm({
  destination,
  startDate, endDate, title, travelers,
  onStartDate, onEndDate, onTitle, onTravelers,
  onSave, onBack,
  isDark,
}: {
  destination: SelectedPlace;
  startDate: string; endDate: string; title: string; travelers: TripTravelers;
  onStartDate: (v: string) => void; onEndDate: (v: string) => void;
  onTitle: (v: string) => void; onTravelers: (t: TripTravelers) => void;
  onSave: () => void; onBack: () => void;
  isDark: boolean;
}) {
  const today   = new Date().toISOString().split('T')[0];
  const cardBg  = isDark ? 'bg-gph-dark-card border-gph-dark-line' : 'bg-white border-gray-200';
  const divider = isDark ? 'border-gph-dark-line' : 'border-gray-200';
  const inputCls = isDark
    ? 'border-gph-dark-line bg-gph-dark-linesoft text-gph-dark-ink placeholder:text-gph-dark-muted focus:ring-gph-dark-action'
    : 'border-gray-200 bg-white text-gray-900 placeholder:text-gray-400 focus:ring-gray-400';

  return (
    <div className={`w-full rounded-2xl border shadow-lg overflow-hidden mt-3 ${cardBg}`}>
      {/* Destination header */}
      <div className={`flex items-center justify-between gap-3 px-5 py-3 border-b ${divider}`}>
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-2 h-2 rounded-full bg-lime-500 shrink-0" />
          <span className={`text-sm font-bold truncate ${isDark ? 'text-gph-dark-ink' : 'text-gray-900'}`}>
            {destination.description.split(',')[0].trim()}
          </span>
          <span className={`text-xs truncate ${isDark ? 'text-gph-dark-muted' : 'text-gray-500'}`}>
            {destination.description.split(',').slice(1).join(',').trim()}
          </span>
        </div>
        <button
          onClick={onBack}
          className={`shrink-0 flex items-center gap-1 text-xs font-medium transition-colors ${isDark ? 'text-gph-dark-muted hover:text-gph-dark-ink' : 'text-gray-500 hover:text-gray-900'}`}
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Change
        </button>
      </div>

      {/* Dates */}
      <div className="px-5 pt-4 pb-3">
        <SectionLabel isDark={isDark}>Dates</SectionLabel>
        <div className="grid grid-cols-2 gap-3">
          {(['Start', 'End'] as const).map((lbl) => {
            const val = lbl === 'Start' ? startDate : endDate;
            const minVal = lbl === 'Start' ? today : (startDate || today);
            const onChange = lbl === 'Start' ? onStartDate : onEndDate;
            return (
              <div key={lbl} className="flex flex-col gap-0.5">
                <label className={`text-[10px] font-semibold uppercase tracking-widest px-1 ${isDark ? 'text-gph-dark-muted' : 'text-gray-500'}`}>{lbl}</label>
                <input
                  type="date" value={val} min={minVal}
                  onChange={(e) => onChange(e.target.value)}
                  className={`rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 ${inputCls} ${isDark ? 'scheme-dark' : 'scheme-light'}`}
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* Travelers */}
      <div className={`border-t ${divider}`} />
      <div className="px-5 py-3">
        <SectionLabel isDark={isDark}>Travelers</SectionLabel>
        <div className={`divide-y ${isDark ? 'divide-gph-dark-line' : 'divide-gray-200'}`}>
          <Stepper label="Adults" sub="Age 18+" value={travelers.adults} min={1} max={20}
            onChange={(v) => onTravelers({ ...travelers, adults: v })} isDark={isDark} />
          <Stepper label="Children" sub="Ages 0–17" value={travelers.children} min={0} max={20}
            onChange={(v) => onTravelers({ ...travelers, children: v })} isDark={isDark} />
          <Stepper label="Pets" sub="Dogs, cats & more" value={travelers.pets} min={0} max={10}
            onChange={(v) => onTravelers({ ...travelers, pets: v })} isDark={isDark} />
        </div>
      </div>

      {/* Trip name */}
      <div className={`border-t ${divider}`} />
      <div className="px-5 py-3">
        <SectionLabel isDark={isDark}>Trip name</SectionLabel>
        <input
          type="text" value={title} onChange={(e) => onTitle(e.target.value)}
          placeholder="Give your trip a name…"
          className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 ${inputCls}`}
        />
      </div>

      {/* Save */}
      <div className={`border-t px-5 py-4 flex justify-end ${divider}`}>
        <button
          type="button" onClick={onSave} disabled={!startDate || !endDate}
          className="px-6 py-2.5 rounded-xl disabled:opacity-40 disabled:cursor-not-allowed text-sm font-bold transition-colors bg-lime-500 hover:bg-lime-400 text-black"
        >
          Start planning →
        </button>
      </div>
    </div>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function TripPlannerPage() {
  const router = useRouter();
  const { isDark } = useTheme();
  const { trips, addTrip, removeTrip } = useTrips();

  const [destination, setDestination] = useState<SelectedPlace | null>(null);
  const [startDate, setStartDate]     = useState('');
  const [endDate, setEndDate]         = useState('');
  const [travelers, setTravelers]     = useState<TripTravelers>({ adults: 1, children: 0, pets: 0 });
  const [title, setTitle]             = useState('');
  const [searchKey, setSearchKey]     = useState(0);
  const [dupeTrips, setDupeTrips]     = useState<Trip[]>([]);

  const showForm    = destination !== null && dupeTrips.length === 0;
  const showWarning = destination !== null && dupeTrips.length > 0;

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
    setSearchKey((k) => k + 1);
  }

  function handleStartDate(v: string) {
    setStartDate(v);
    if (endDate && endDate < v) setEndDate('');
  }

  function handleIgnoreWarning() {
    if (!destination) return;
    setDupeTrips([]);
    setTitle(`Trip to ${destination.description.split(',')[0].trim()}`);
  }

  function handleDupeDelete(id: string) {
    removeTrip(id);
    setDupeTrips((prev) => {
      const next = prev.filter((t) => t.id !== id);
      if (next.length === 0 && destination) {
        setTitle(`Trip to ${destination.description.split(',')[0].trim()}`);
      }
      return next;
    });
  }

  function handleSave() {
    if (!destination || !startDate || !endDate) return;
    const newTrip = addTrip({
      title: title.trim() || `Trip to ${destination.description.split(',')[0].trim()}`,
      destination: destination.description,
      destination_place_id: undefined,
      destination_lat: destination.latitude || undefined,
      destination_lng: destination.longitude || undefined,
      start_date: startDate,
      end_date: endDate,
      travelers,
    });
    router.push(`/trip-planner/${newTrip.id}`);
    setDestination(null);
    setDupeTrips([]);
    setStartDate('');
    setEndDate('');
    setTitle('');
    setTravelers({ adults: 1, children: 0, pets: 0 });
    setSearchKey((k) => k + 1);
  }

  // Style tokens
  const inkColor   = isDark ? '#f3f3f1' : '#0c0c0d';
  const cardColor  = isDark ? '#161618' : '#ffffff';
  const lineColor  = isDark ? '#262629' : '#e3e3e1';
  const mutedColor = isDark ? '#8a8a90' : '#5f6066';

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const activeTrips   = trips.filter(t => new Date(t.end_date + 'T00:00:00') >= today);
  const archivedCount = trips.length - activeTrips.length;

  return (
    <div className={`flex flex-col h-screen overflow-hidden font-sans ${isDark ? 'bg-gph-dark-bg' : 'bg-[#eef1ec]'}`}>
      <NavBar />

      {/* ── Map Canvas ─────────────────────────────────────────────────────── */}
      <main className="relative flex-1 overflow-hidden">
        <WorldMapDotted isDark={isDark} />

        {/* Decorative map pins */}
        {MAP_PINS.map((pin) => (
          <MapPin key={pin.label} pin={pin} isDark={isDark} />
        ))}

        {/* ── SEARCH PHASE — fades up and out when destination chosen ─── */}
        <div
          className="absolute inset-0 z-20"
          style={{
            opacity: showForm ? 0 : 1,
            transform: showForm ? 'translateY(-14px) scale(0.99)' : 'translateY(0) scale(1)',
            transition: 'opacity 280ms cubic-bezier(0.4, 0, 1, 1), transform 280ms cubic-bezier(0.4, 0, 1, 1)',
            pointerEvents: showForm ? 'none' : 'auto',
          }}
        >
          {/* Compass chrome — top right */}
          <div className="absolute right-5 top-5 hidden md:flex flex-col gap-2 items-end">
            <div
              className="px-2.5 py-1.5 rounded-md text-[9px] font-mono font-black tracking-wider border"
              style={{ background: cardColor, color: mutedColor, borderColor: lineColor }}
            >
              N↑ · WORLD · 1:24,000,000
            </div>
            <div
              className="px-2.5 py-1.5 rounded-md text-[9px] font-mono font-black tracking-wider border flex items-center gap-1.5"
              style={{ background: cardColor, color: inkColor, borderColor: lineColor }}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-lime-500 inline-block" />
              {trips.filter(t => new Date(t.end_date + 'T00:00:00') >= new Date()).length} PLANNING · {trips.filter(t => new Date(t.end_date + 'T00:00:00') < new Date()).length} TRAVELED
            </div>
          </div>

          {/* Headline plaque — top left, desktop only */}
          <div
            className="absolute left-5 top-5 p-4 md:p-5 rounded-xl border shadow-sm max-w-70 md:max-w-xs hidden md:block"
            style={{ background: cardColor, borderColor: lineColor }}
          >
            <h1 className="text-4xl md:text-5xl font-black leading-none tracking-tight" style={{ color: inkColor }}>
              Where to<br />
              next<span className="text-lime-500">?</span>
            </h1>
            <p className="mt-3 text-xs leading-relaxed" style={{ color: mutedColor }}>
              Drop a destination and we&apos;ll start a trip — flights, hotels, and points-value already wired in.
            </p>
          </div>

          {/* Mobile headline */}
          <div className="md:hidden absolute top-4 inset-x-4 text-center">
            <h1 className="text-3xl font-black leading-none tracking-tight" style={{ color: inkColor }}>
              Where to next<span className="text-lime-500">?</span>
            </h1>
          </div>

          {/* Command bar */}
          <div className="absolute left-0 right-0 top-[30%] md:top-[38%] flex justify-center px-4">
            <div className="w-full max-w-xl">
              <div
                className="rounded-lg"
                style={{
                  boxShadow: isDark
                    ? `0 8px 40px rgba(0,0,0,0.6), 0 0 0 2px ${inkColor}`
                    : `0 8px 40px rgba(12,12,13,0.12), 0 0 0 2px ${inkColor}, 0 0 0 6px rgba(132,204,22,0.35)`,
                }}
              >
                <LocationSearch
                  key={searchKey}
                  placeholder="Search a city, airport, or destination…"
                  onSelect={handleDestinationSelect}
                  onClear={handleDestinationClear}
                />
              </div>

              {/* Duplicate warning */}
              {showWarning && destination && (
                <DupeWarning
                  dupeTrips={dupeTrips}
                  onDelete={handleDupeDelete}
                  onIgnore={handleIgnoreWarning}
                  isDark={isDark}
                />
              )}

              {/* AI banner */}
              {!showWarning && (
                <div
                  className="mt-4 flex items-center gap-3 px-4 py-3 rounded-2xl border"
                  style={{ background: cardColor, borderColor: lineColor }}
                >
                  <div className="flex items-center gap-2 shrink-0">
                    <svg className="w-4 h-4 text-lime-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                    </svg>
                    <PremiumBadge />
                  </div>
                  <p className="text-xs font-semibold flex-1" style={{ color: mutedColor }}>
                    <span style={{ color: inkColor }}>AI trip planning</span> — surprise me, itinerary ideas, and smart point recommendations are coming as a premium feature.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── FORM PHASE — slides up and in after destination chosen ────── */}
        <div
          className="absolute inset-0 z-20 flex items-center justify-center px-4 py-8 overflow-y-auto"
          style={{
            opacity: showForm ? 1 : 0,
            transform: showForm ? 'translateY(0) scale(1)' : 'translateY(20px) scale(0.99)',
            transition: 'opacity 350ms cubic-bezier(0, 0, 0.2, 1), transform 350ms cubic-bezier(0, 0, 0.2, 1)',
            pointerEvents: showForm ? 'auto' : 'none',
          }}
        >
          {showForm && destination && (
            <div className="w-full max-w-xl">
              <TripCreateForm
                destination={destination}
                startDate={startDate}
                endDate={endDate}
                title={title}
                travelers={travelers}
                onStartDate={handleStartDate}
                onEndDate={setEndDate}
                onTitle={setTitle}
                onTravelers={setTravelers}
                onSave={handleSave}
                onBack={handleBack}
                isDark={isDark}
              />
            </div>
          )}
        </div>

        {/* ── Continue planning — bottom rail ───────────────────────────── */}
        {trips.length > 0 && !showForm && (
          <div
            className="absolute bottom-0 left-0 right-0 z-30 border-t"
            style={{ background: cardColor, borderColor: lineColor }}
          >
            <div className="flex items-center gap-4 px-5 py-3">
              <span
                className="text-[10px] font-mono font-black tracking-widest"
                style={{ color: inkColor }}
              >
                ↗ CONTINUE PLANNING
              </span>
              <span
                className="text-[10px] font-mono font-semibold tracking-wider"
                style={{ color: mutedColor }}
              >
                {activeTrips.length} ACTIVE{archivedCount > 0 ? ` · ${archivedCount} ARCHIVED` : ''}
              </span>
            </div>
            <div className="flex gap-3 px-5 pb-5 overflow-x-auto">
              {trips.map((trip, i) => (
                <TripRailCard
                  key={trip.id}
                  trip={trip}
                  index={i}
                  onDelete={() => removeTrip(trip.id)}
                  isDark={isDark}
                />
              ))}
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
