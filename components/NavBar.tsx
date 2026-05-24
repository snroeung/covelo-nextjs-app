'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { ProfilePopup } from '@/components/ProfilePopup';

export function NavBar() {
  const { isDark }   = useTheme();
  const { user, profile, loading } = useAuth();
  const pathname     = usePathname();
  const router       = useRouter();
  const avatarRef    = useRef<HTMLButtonElement>(null);
  const [popupOpen, setPopupOpen] = useState(false);

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

  const initials = profile?.display_name
    ? profile.display_name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()
    : user?.email?.[0]?.toUpperCase() ?? '?';

  return (
    <nav className={`flex items-center gap-4 px-4 md:px-6 py-3 border-b shrink-0 ${surfaceBg} ${borderCls}`}>
      <Link href="/" className={`text-lg font-bold tracking-tight ${isDark ? 'text-white' : 'text-gray-900'}`}>
        covelo<span className={isDark ? 'text-gph-dark-muted' : 'text-gray-400'}>.</span>
      </Link>
      <div className="flex items-center gap-1">
        <Link href="/flights"      className={navLinkCls('/flights')}>Flights</Link>
        <Link href="/hotels"       className={navLinkCls('/hotels')}>Hotels</Link>
        <Link href="/trip-planner" className={navLinkCls('/trip-planner')}>Trip Planner</Link>
      </div>

      <div className="ml-auto flex items-center gap-2">
        <ThemeToggle compact />

        {/* Auth area */}
        {loading ? (
          <div className="w-9 h-9 rounded-full bg-gray-200 dark:bg-gray-700 animate-pulse" />
        ) : user ? (
          <div className="relative">
            <button
              ref={avatarRef}
              onClick={() => setPopupOpen((v) => !v)}
              className="w-9 h-9 rounded-full bg-green-700 flex items-center justify-center text-white text-xs font-bold select-none hover:bg-green-600 transition-colors focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
              aria-label="Open profile"
              aria-expanded={popupOpen}
            >
              {initials}
            </button>
            {popupOpen && (
              <ProfilePopup
                anchorRef={avatarRef}
                onClose={() => setPopupOpen(false)}
              />
            )}
          </div>
        ) : (
          <button
            onClick={() => router.push('/auth')}
            className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
              isDark
                ? 'bg-white text-gray-900 hover:bg-gray-100'
                : 'bg-gray-900 text-white hover:bg-gray-700'
            }`}
          >
            Sign in
          </button>
        )}
      </div>
    </nav>
  );
}
