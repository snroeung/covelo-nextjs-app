'use client';

import { useState } from 'react';
import { AffiliateAdSpot } from '@/components/offers/AffiliateAdSpot';
import { BalancePanel } from '@/components/BalancePanel';
import { CardSelector } from '@/components/CardSelector';
import { NavBar } from '@/components/NavBar';
import { Footer } from '@/components/Footer';
import { useAuth } from '@/contexts/AuthContext';
import { useSelectedCards } from '@/contexts/SelectedCardsContext';
import { useTheme } from '@/contexts/ThemeContext';

export function AppShell({
  header,
  children,
  sidebar,
  hasResults = false,
}: {
  header: React.ReactNode;
  children: React.ReactNode;
  sidebar?: React.ReactNode;
  hasResults?: boolean;
}) {
  const { isDark } = useTheme();
  const { user } = useAuth();
  const { selectedCards } = useSelectedCards();
  const [headerOpen, setHeaderOpen] = useState(true);
  // Auto-collapse once when results load, without fighting a manual reopen
  // afterward — adjusted during render (React's documented alternative to
  // an effect for this), not via useEffect.
  const [prevHasResults, setPrevHasResults] = useState(hasResults);
  if (hasResults !== prevHasResults) {
    setPrevHasResults(hasResults);
    if (hasResults) setHeaderOpen(false);
  }

  const pageBg    = isDark ? 'bg-gph-dark-bg'   : 'bg-gray-100';
  const surfaceBg = isDark ? 'bg-gph-dark-card' : 'bg-white';
  const borderCls = isDark ? 'border-gph-dark-line' : 'border-gray-200';
  const allCardsMode = selectedCards.length === 0;

  const chevronColor = isDark ? 'text-gph-dark-muted' : 'text-gray-500';

  return (
    <div className={`flex flex-col h-screen overflow-hidden font-sans ${pageBg}`}>

      {/* ① Nav — shared across all pages */}
      <NavBar />


      {/* ③ Search bar — full width, above the sidebar/results split */}

      {/* Mobile: collapsible */}
      <div className={`md:hidden shrink-0 border-b ${surfaceBg} ${borderCls}`}>
        {headerOpen && (
          <div className="px-4 pt-4 pb-2">
            {header}
          </div>
        )}
        <button
          onClick={() => setHeaderOpen(o => !o)}
          className={`w-full flex items-center justify-center gap-1.5 py-2 text-xs font-medium ${chevronColor}`}
        >
          <span>{headerOpen ? 'Collapse search' : 'Modify search'}</span>
          <svg
            className={`w-3 h-3 transition-transform ${headerOpen ? 'rotate-180' : ''}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>

      {/* Desktop: always visible, full width */}
      <header className={`hidden md:block border-b px-6 py-4 shrink-0 ${surfaceBg} ${borderCls}`}>
        {header}
      </header>

      {/* ④ Body: cards sidebar | results */}
      <div className="flex flex-1 overflow-hidden">

        {/* Sidebar — desktop only */}
        <aside className={`hidden md:flex w-64 shrink-0 border-r flex-col overflow-hidden ${surfaceBg} ${borderCls}`}>
          {allCardsMode && (
            <div className={`px-4 py-3 border-b ${isDark ? 'bg-cv-amber-900/40 border-cv-amber-700/40' : 'bg-cv-amber-50 border-cv-amber-200'}`}>
              <p className={`text-xs ${isDark ? 'text-cv-amber-300' : 'text-cv-amber-900'}`}>
                Showing all cards. Select yours for a personalized estimate.
              </p>
            </div>
          )}
          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            {sidebar}
            <AffiliateAdSpot slot="sidebar" isDark={isDark} />
            {user ? <BalancePanel /> : <CardSelector />}
          </div>
        </aside>

        {/* Results */}
        <main className="flex-1 p-4 md:p-6 overflow-y-auto">
          {children}
        </main>

      </div>

      <Footer />
    </div>
  );
}
