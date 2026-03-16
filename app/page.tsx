'use client';

import { useState } from 'react';
import { CardSelector } from '@/components/CardSelector';
import { PointsGrid } from '@/components/PointsGrid';
import { usePointsCalc } from '@/hooks/usePointsCalc';
import { useSelectedCards } from '@/contexts/SelectedCardsContext';
import { useTheme } from '@/contexts/ThemeContext';
import { BookingType } from '@/lib/points/types';

type TripType = 'roundtrip' | 'oneway';

function DateInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const { isDark } = useTheme();
  return (
    <div className="flex flex-col gap-0.5">
      <label className={`text-[10px] font-semibold uppercase tracking-widest px-1 ${isDark ? 'text-cv-blue-300' : 'text-cv-blue-900'}`}>
        {label}
      </label>
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cv-blue-600 scheme-dark ${
          isDark
            ? 'border-cv-blue-900 bg-cv-blue-950 text-white'
            : 'border-cv-blue-100 bg-white text-cv-blue-950 scheme-light'
        }`}
      />
    </div>
  );
}

function ThemeToggle() {
  const { isDark, toggleTheme } = useTheme();
  const borderCls = isDark ? 'border-cv-blue-900' : 'border-cv-blue-300';
  const activeCls = 'bg-cv-blue-600 text-white';

  // Each button needs independent inactive styles
  const lightInactive = isDark
    ? 'bg-transparent text-cv-blue-300 hover:bg-cv-blue-900'  // in dark mode, "Light" is the inactive option
    : activeCls;                                                // in light mode, "Light" is active
  const darkInactive = isDark
    ? activeCls                                                 // in dark mode, "Dark" is active
    : 'bg-cv-blue-950 text-white hover:bg-cv-blue-900';        // in light mode, dark swatch with high-contrast text

  return (
    <div className={`flex rounded-lg border overflow-hidden text-xs font-medium w-full ${borderCls}`}>
      <button
        onClick={() => isDark && toggleTheme()}
        className={`flex-1 flex items-center justify-center gap-1.5 py-2 transition-colors ${lightInactive}`}
      >
        ☀️ Light
      </button>
      <button
        onClick={() => !isDark && toggleTheme()}
        className={`flex-1 flex items-center justify-center gap-1.5 py-2 transition-colors ${darkInactive}`}
      >
        🌙 Dark
      </button>
    </div>
  );
}

function MainContent() {
  const [location, setLocation] = useState('');
  const [bookingType, setBookingType] = useState<BookingType>('hotel');
  const [tripType, setTripType] = useState<TripType>('roundtrip');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const { selectedCards } = useSelectedCards();
  const { isDark } = useTheme();

  const DEMO_PRICE = 620;
  const result = usePointsCalc(DEMO_PRICE, bookingType);

  const allCardsMode = selectedCards.length === 0;
  const noLocation   = location.trim().length === 0;
  const showEndDate  = bookingType === 'hotel' || tripType === 'roundtrip';

  // Theme-driven classes
  const pageBg       = isDark ? 'bg-cv-blue-950' : 'bg-cv-blue-50';
  const sidebarBg    = isDark ? 'bg-cv-blue-950' : 'bg-white';
  const sidebarBorder = isDark ? 'border-cv-blue-900' : 'border-cv-blue-100';
  const headerBg     = isDark ? 'bg-cv-blue-950' : 'bg-white';
  const headerBorder = isDark ? 'border-cv-blue-900' : 'border-cv-blue-100';
  const labelCls     = isDark ? 'text-cv-blue-300' : 'text-cv-blue-900';
  const inputCls     = isDark
    ? 'border-cv-blue-900 bg-cv-blue-950 text-white placeholder:text-cv-blue-400/60'
    : 'border-cv-blue-100 bg-white text-cv-blue-950 placeholder:text-cv-blue-400';
  const toggleActiveCls   = isDark ? 'bg-cv-blue-600 text-white' : 'bg-cv-blue-600 text-white';
  const toggleInactiveCls = isDark
    ? 'bg-cv-blue-950 text-cv-blue-300 hover:bg-cv-blue-900'
    : 'bg-white text-cv-blue-900 hover:bg-cv-blue-50';
  const toggleBorderCls  = isDark ? 'border-cv-blue-900' : 'border-cv-blue-100';
  const headingCls   = isDark ? 'text-cv-blue-300' : 'text-cv-blue-900';
  const subTextCls   = isDark ? 'text-cv-blue-400' : 'text-cv-blue-500';
  const emptyBorderCls = isDark ? 'border-cv-blue-900' : 'border-cv-blue-200';
  const emptyTextCls   = isDark ? 'text-cv-blue-400' : 'text-cv-blue-500';

  return (
    <div className={`flex min-h-screen font-sans ${pageBg}`}>

      {/* Left sidebar */}
      <aside className={`w-72 shrink-0 border-r flex flex-col overflow-hidden ${sidebarBg} ${sidebarBorder}`}>
        {allCardsMode && (
          <div className={`px-4 py-3 border-b ${isDark ? 'bg-cv-amber-900/40 border-cv-amber-700/40' : 'bg-cv-amber-50 border-cv-amber-200'}`}>
            <p className={`text-xs ${isDark ? 'text-cv-amber-300' : 'text-cv-amber-700'}`}>
              Showing all cards. Select yours for a personalized estimate.
            </p>
          </div>
        )}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="mb-8">
            <span className={`text-xl font-bold tracking-tight ${isDark ? 'text-white' : 'text-cv-blue-950'}`}>
              covelo
            </span>
            <span className="text-cv-blue-400 text-xl font-bold">.</span>
          </div>
          <CardSelector />
        </div>

        {/* Theme toggle pinned to sidebar bottom */}
        <div className={`p-3 border-t ${sidebarBorder}`}>
          <ThemeToggle />
        </div>
      </aside>

      {/* Main area */}
      <div className="flex flex-1 flex-col overflow-hidden">

        {/* Top bar */}
        <header className={`flex items-end gap-3 border-b px-8 py-4 ${headerBg} ${headerBorder}`}>

          {/* Round trip / One way — flights only */}
          {bookingType === 'flight' && (
            <div className="flex flex-col gap-0.5">
              <span className={`text-[10px] font-semibold uppercase tracking-widest px-1 ${labelCls}`}>Trip</span>
              <div className={`flex rounded-lg border overflow-hidden text-sm font-medium ${toggleBorderCls}`}>
                {(['roundtrip', 'oneway'] as TripType[]).map((t) => (
                  <button
                    key={t}
                    onClick={() => setTripType(t)}
                    className={`px-3 py-2 whitespace-nowrap transition-colors ${tripType === t ? toggleActiveCls : toggleInactiveCls}`}
                  >
                    {t === 'roundtrip' ? 'Round trip' : 'One way'}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Location search */}
          <div className="flex flex-col gap-0.5 flex-1 min-w-0">
            <span className={`text-[10px] font-semibold uppercase tracking-widest px-1 ${labelCls}`}>Location</span>
            <div className="relative">
              <svg className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${isDark ? 'text-cv-blue-400' : 'text-cv-blue-400'}`}
                fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
              </svg>
              <input
                type="text"
                placeholder="City, neighborhood, or address"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className={`w-full rounded-lg border pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cv-blue-600 ${inputCls}`}
              />
            </div>
          </div>

          {/* Date pickers */}
          <DateInput label={bookingType === 'hotel' ? 'Check-in' : 'Depart'} value={startDate} onChange={setStartDate} />
          {showEndDate && (
            <DateInput label={bookingType === 'hotel' ? 'Check-out' : 'Return'} value={endDate} onChange={setEndDate} />
          )}

          {/* Booking type toggle */}
          <div className="flex flex-col gap-0.5">
            <span className={`text-[10px] font-semibold uppercase tracking-widest px-1 ${labelCls}`}>Type</span>
            <div className={`flex rounded-lg border overflow-hidden text-sm font-medium ${toggleBorderCls}`}>
              {(['hotel', 'flight'] as BookingType[]).map((type) => (
                <button
                  key={type}
                  onClick={() => setBookingType(type)}
                  className={`px-4 py-2 capitalize transition-colors ${bookingType === type ? toggleActiveCls : toggleInactiveCls}`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>
        </header>

        {/* Center content */}
        <main className="flex flex-1 items-center justify-center p-8">
          <div className="w-full max-w-xl space-y-4">
            {noLocation ? (
              <div className={`flex items-center justify-center rounded-xl border border-dashed py-16 ${emptyBorderCls}`}>
                <p className={`text-sm ${emptyTextCls}`}>Search for a location to see your points breakdown.</p>
              </div>
            ) : result ? (
              <>
                <div className="flex items-baseline justify-between">
                  <h2 className={`text-xs font-semibold uppercase tracking-widest ${headingCls}`}>
                    Points breakdown
                  </h2>
                  <span className={`text-xs ${subTextCls}`}>{location} · {bookingType}</span>
                </div>
                <PointsGrid result={result} />
              </>
            ) : (
              <div className={`flex items-center justify-center rounded-xl border border-dashed py-16 ${emptyBorderCls}`}>
                <p className={`text-sm ${emptyTextCls}`}>Something went wrong calculating points.</p>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

export default function Home() {
  return <MainContent />;
}
