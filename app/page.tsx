'use client';

import { useState } from 'react';
import { CardSelector } from '@/components/CardSelector';
import { PointsGrid } from '@/components/PointsGrid';
import { usePointsCalc } from '@/hooks/usePointsCalc';
import { useSelectedCards } from '@/contexts/SelectedCardsContext';
import { BookingType } from '@/lib/points/types';

function MainContent() {
  const [location, setLocation] = useState('');
  const [bookingType, setBookingType] = useState<BookingType>('hotel');
  const { selectedCards } = useSelectedCards();

  // Price comes from search results later — demo value for now
  const DEMO_PRICE = 620;
  const result = usePointsCalc(DEMO_PRICE, bookingType);

  const allCardsMode = selectedCards.length === 0;
  const noLocation = location.trim().length === 0;

  return (
    <div className="flex min-h-screen bg-gray-50 font-sans">

      {/* Left sidebar — card picker */}
      <aside className="w-72 shrink-0 border-r border-gray-200 bg-white flex flex-col overflow-hidden">
        {/* Amber disclaimer pinned to top of sidebar */}
        {allCardsMode && (
          <div className="px-4 py-3 bg-amber-50 border-b border-amber-200">
            <p className="text-xs text-amber-700">
              Showing all cards. Select yours for a personalized estimate.
            </p>
          </div>
        )}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="mb-6">
            <span className="text-lg font-bold text-gray-900 tracking-tight">covelo</span>
          </div>
          <CardSelector />
        </div>
      </aside>

      {/* Main area */}
      <div className="flex flex-1 flex-col overflow-hidden">

        {/* Top bar */}
        <header className="flex items-center justify-end gap-3 border-b border-gray-200 bg-white px-8 py-4">
          {/* Booking type toggle */}
          <div className="flex rounded-lg border border-gray-200 overflow-hidden text-sm font-medium">
            {(['hotel', 'flight'] as BookingType[]).map((type) => (
              <button
                key={type}
                onClick={() => setBookingType(type)}
                className={`px-4 py-2 capitalize transition-colors ${
                  bookingType === type
                    ? 'bg-gray-900 text-white'
                    : 'bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                {type}
              </button>
            ))}
          </div>

          {/* Location search */}
          <div className="relative">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4"
              fill="none" stroke="currentColor" strokeWidth={2}
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
            </svg>
            <input
              type="text"
              placeholder="City, neighborhood, or address"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="w-72 rounded-lg border border-gray-200 bg-white pl-9 pr-4 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </header>

        {/* Center content */}
        <main className="flex flex-1 items-center justify-center p-8">
          <div className="w-full max-w-xl space-y-4">
            {noLocation ? (
              <EmptyState message="Search for a location to see your points breakdown." />
            ) : result ? (
              <>
                <div className="flex items-baseline justify-between">
                  <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
                    Points breakdown
                  </h2>
                  <span className="text-xs text-gray-400">
                    {location} · {bookingType}
                  </span>
                </div>
                <PointsGrid result={result} />
              </>
            ) : (
              <EmptyState message="Something went wrong calculating points." />
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-gray-300 py-16 text-center">
      <p className="text-sm text-gray-400">{message}</p>
    </div>
  );
}

export default function Home() {
  return <MainContent />;
}
