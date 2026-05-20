'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useTheme } from '@/contexts/ThemeContext';

export function NavBar() {
  const { isDark } = useTheme();
  const pathname   = usePathname();

  const surfaceBg = isDark ? 'bg-gph-dark-card' : 'bg-white';
  const borderCls = isDark ? 'border-gph-dark-line' : 'border-gray-200';

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

  return (
    <nav className={`flex items-center gap-4 px-4 md:px-6 py-3 border-b shrink-0 ${surfaceBg} ${borderCls}`}>
      <span className={`text-lg font-bold tracking-tight ${isDark ? 'text-white' : 'text-gray-900'}`}>
        covelo<span className={isDark ? 'text-gph-dark-muted' : 'text-gray-400'}>.</span>
      </span>
      <div className="flex items-center gap-1">
        <Link href="/"             className={navLinkCls('/')}>Flights</Link>
        <Link href="/hotels"       className={navLinkCls('/hotels')}>Hotels</Link>
        <Link href="/trip-planner" className={navLinkCls('/trip-planner')}>Trip Planner</Link>
      </div>
      <div className="ml-auto flex items-center gap-2">
        <ThemeToggle compact />
        <div className="w-9 h-9 rounded-full bg-green-700 flex items-center justify-center text-white text-xs font-bold select-none">
          NR
        </div>
      </div>
    </nav>
  );
}
