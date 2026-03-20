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

  // Auto-collapse on mobile when results first appear
  useEffect(() => {
    if (hasResults) setHeaderOpen(false);
  }, [hasResults]);

  const pageBg       = isDark ? 'bg-cv-blue-950' : 'bg-cv-blue-50';
  const surfaceBg    = isDark ? 'bg-cv-blue-950' : 'bg-white';
  const borderCls    = isDark ? 'border-cv-blue-900' : 'border-cv-blue-100';
  const allCardsMode = selectedCards.length === 0;

  function navLinkCls(href: string) {
    const active = pathname === href;
    const base   = 'px-4 py-1.5 rounded-lg text-sm font-medium transition-colors';
    if (active) return `${base} bg-cv-blue-600 text-white`;
    return isDark
      ? `${base} text-cv-blue-400 hover:text-white`
      : `${base} text-cv-blue-600 hover:text-cv-blue-950`;
  }

  const chevronColor = isDark ? 'text-cv-blue-400' : 'text-cv-blue-600';
  const labelColor   = isDark ? 'text-cv-blue-300' : 'text-cv-blue-900';

  return (
    <div className={`flex flex-col h-screen overflow-hidden font-sans ${pageBg}`}>

      {/* Row 1: Top nav — Flights / Hotels + theme toggle */}
      <nav className={`flex items-center gap-4 px-4 md:px-6 py-3 border-b shrink-0 ${surfaceBg} ${borderCls}`}>
        <span className={`text-lg font-bold tracking-tight ${isDark ? 'text-white' : 'text-cv-blue-950'}`}>
          covelo<span className="text-cv-blue-400">.</span>
        </span>
        <div className="flex items-center gap-1">
          <Link href="/"       className={navLinkCls('/')}>Flights</Link>
          <Link href="/hotels" className={navLinkCls('/hotels')}>Hotels</Link>
        </div>
        {/* Theme toggle visible in nav on mobile; in sidebar on desktop */}
        <div className="ml-auto md:hidden">
          <ThemeToggle />
        </div>
      </nav>

      {/* Row 2 (mobile only): Your Cards dropdown */}
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

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">

        {/* Sidebar — desktop only */}
        <aside className={`hidden md:flex w-72 shrink-0 border-r flex-col overflow-hidden ${surfaceBg} ${borderCls}`}>
          {allCardsMode && (
            <div className={`px-4 py-3 border-b ${isDark ? 'bg-cv-amber-900/40 border-cv-amber-700/40' : 'bg-cv-amber-50 border-cv-amber-200'}`}>
              <p className={`text-xs ${isDark ? 'text-cv-amber-300' : 'text-cv-amber-700'}`}>
                Showing all cards. Select yours for a personalized estimate.
              </p>
            </div>
          )}
          <div className="flex-1 overflow-y-auto p-6">
            <CardSelector />
          </div>
          <div className={`p-3 border-t ${borderCls}`}>
            <ThemeToggle />
          </div>
        </aside>

        {/* Search header + results */}
        <div className="flex flex-1 flex-col overflow-hidden">

          {/* Mobile: collapsible header */}
          <div className={`md:hidden shrink-0 border-b ${surfaceBg} ${borderCls}`}>
            {headerOpen && (
              <div className="px-4 pt-4 pb-2 flex flex-wrap items-end gap-3">
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

          {/* Desktop: always visible header */}
          <header className={`hidden md:flex flex-wrap items-end gap-3 border-b px-8 py-4 shrink-0 ${surfaceBg} ${borderCls}`}>
            {header}
          </header>

          <main className="flex flex-1 justify-center p-4 md:p-8 overflow-y-auto">
            <div className="w-full max-w-xl space-y-4">
              {children}
            </div>
          </main>
        </div>

      </div>
    </div>
  );
}
