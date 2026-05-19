'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { CardSelector } from '@/components/CardSelector';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useSelectedCards } from '@/contexts/SelectedCardsContext';
import { useTheme } from '@/contexts/ThemeContext';

export function AppShell({
  header,
  children,
  hasResults = false,
}: {
  header: React.ReactNode;
  children: React.ReactNode;
  hasResults?: boolean;
}) {
  const { isDark } = useTheme();
  const { selectedCards } = useSelectedCards();
  const pathname = usePathname();
  const [cardDropdownOpen, setCardDropdownOpen] = useState(false);
  const [headerOpen, setHeaderOpen] = useState(true);
  useEffect(() => {
    if (hasResults) setHeaderOpen(false);
  }, [hasResults]);

  const pageBg    = isDark ? 'bg-gph-dark-bg'   : 'bg-gray-100';
  const surfaceBg = isDark ? 'bg-gph-dark-card' : 'bg-white';
  const borderCls = isDark ? 'border-gph-dark-line' : 'border-gray-200';
  const allCardsMode = selectedCards.length === 0;

  function navLinkCls(href: string) {
    const active = pathname === href;
    const base   = 'px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors';
    if (active) return isDark
      ? `${base} bg-white text-gray-900`
      : `${base} bg-gray-900 text-white`;
    return isDark
      ? `${base} text-gph-dark-muted hover:text-gph-dark-ink`
      : `${base} text-gray-500 hover:text-gray-900`;
  }

  const chevronColor = isDark ? 'text-gph-dark-muted' : 'text-gray-500';
  const labelColor   = isDark ? 'text-gph-dark-ink'   : 'text-gray-900';

  return (
    <div className={`flex flex-col h-screen overflow-hidden font-sans ${pageBg}`}>

      {/* ① Nav — full width */}
      <nav className={`flex items-center gap-4 px-4 md:px-6 py-3 border-b shrink-0 ${surfaceBg} ${borderCls}`}>
        <span className={`text-lg font-bold tracking-tight ${isDark ? 'text-white' : 'text-gray-900'}`}>
          covelo<span className={isDark ? 'text-gph-dark-muted' : 'text-gray-400'}>.</span>
        </span>
        <div className="flex items-center gap-1">
          <Link href="/"              className={navLinkCls('/')}>Flights</Link>
          <Link href="/hotels"        className={navLinkCls('/hotels')}>Hotels</Link>
          <Link href="/trip-planner"  className={navLinkCls('/trip-planner')}>Trip Planner</Link>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <ThemeToggle compact />
          <div className="w-9 h-9 rounded-full bg-green-700 flex items-center justify-center text-white text-xs font-bold select-none">
            NR
          </div>
        </div>
      </nav>

      {/* ② Mobile: Your Cards dropdown */}
      <div className={`md:hidden shrink-0 border-b ${surfaceBg} ${borderCls}`}>
        <button
          onClick={() => setCardDropdownOpen(v => !v)}
          className={`w-full flex items-center justify-between px-4 py-3 ${labelColor}`}
        >
          <span className="text-xs font-semibold uppercase tracking-widest">
            Your Cards
            {selectedCards.length > 0 && (
              <span className={`ml-2 font-normal normal-case tracking-normal ${chevronColor}`}>
                · {selectedCards.length} selected
              </span>
            )}
            {allCardsMode && (
              <span className={`ml-2 font-normal normal-case tracking-normal ${isDark ? 'text-cv-amber-300' : 'text-cv-amber-700'}`}>
                · showing all
              </span>
            )}
          </span>
          <svg
            className={`w-4 h-4 transition-transform ${cardDropdownOpen ? 'rotate-180' : ''} ${chevronColor}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        {cardDropdownOpen && (
          <div className={`px-4 pb-4 border-t ${borderCls} overflow-y-auto max-h-60`}>
            <div className="pt-4">
              <CardSelector />
            </div>
          </div>
        )}
      </div>

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
              <p className={`text-xs ${isDark ? 'text-cv-amber-300' : 'text-cv-amber-700'}`}>
                Showing all cards. Select yours for a personalized estimate.
              </p>
            </div>
          )}
          <div className="flex-1 overflow-y-auto p-5">
            <CardSelector />
          </div>
        </aside>

        {/* Results */}
        <main className="flex-1 p-4 md:p-6 overflow-y-auto">
          {children}
        </main>

      </div>
    </div>
  );
}
