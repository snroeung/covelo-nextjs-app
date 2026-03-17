'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CardSelector } from '@/components/CardSelector';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useSelectedCards } from '@/contexts/SelectedCardsContext';
import { useTheme } from '@/contexts/ThemeContext';

export function AppShell({
  header,
  children,
}: {
  header: React.ReactNode;
  children: React.ReactNode;
}) {
  const { isDark } = useTheme();
  const { selectedCards } = useSelectedCards();
  const pathname = usePathname();

  const pageBg        = isDark ? 'bg-cv-blue-950' : 'bg-cv-blue-50';
  const surfaceBg     = isDark ? 'bg-cv-blue-950' : 'bg-white';
  const borderCls     = isDark ? 'border-cv-blue-900' : 'border-cv-blue-100';
  const allCardsMode  = selectedCards.length === 0;

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

      {/* Top nav */}
      <nav className={`flex items-center gap-4 px-6 py-3 border-b shrink-0 ${surfaceBg} ${borderCls}`}>
        <span className={`text-lg font-bold tracking-tight ${isDark ? 'text-white' : 'text-cv-blue-950'}`}>
          covelo<span className="text-cv-blue-400">.</span>
        </span>
        <div className="flex items-center gap-1">
          <Link href="/"       className={navLinkCls('/')}>Flights</Link>
          <Link href="/hotels" className={navLinkCls('/hotels')}>Hotels</Link>
        </div>
      </nav>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">

        {/* Sidebar */}
        <aside className={`w-72 shrink-0 border-r flex flex-col overflow-hidden ${surfaceBg} ${borderCls}`}>
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

        {/* Page content */}
        <div className="flex flex-1 flex-col overflow-hidden">
          <header className={`flex flex-wrap items-end gap-3 border-b px-8 py-4 shrink-0 ${surfaceBg} ${borderCls}`}>
            {header}
          </header>
          <main className="flex flex-1 justify-center p-8 overflow-y-auto">
            <div className="w-full max-w-xl space-y-4">
              {children}
            </div>
          </main>
        </div>

      </div>
    </div>
  );
}
