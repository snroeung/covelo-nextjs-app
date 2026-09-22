'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { ProfilePopup } from '@/components/ProfilePopup';
import { isEnabled } from '@/lib/feature-flags';

const flightsEnabled    = isEnabled('ui:flights');
const hotelsEnabled     = isEnabled('ui:hotels');
const discoverEnabled   = isEnabled('ui:discover');

export function NavBar() {
  const { isDark }   = useTheme();
  const { user, profile, loading } = useAuth();
  const pathname     = usePathname();
  const router       = useRouter();
  const avatarRef    = useRef<HTMLButtonElement>(null);
  const searchRef    = useRef<HTMLDivElement>(null);
  const discoverRef  = useRef<HTMLDivElement>(null);
  const [popupOpen, setPopupOpen]     = useState(false);
  const [searchOpen, setSearchOpen]   = useState(false);
  const [discoverOpen, setDiscoverOpen] = useState(false);

  const surfaceBg = isDark ? 'bg-gph-dark-card' : 'bg-white';
  const borderCls = isDark ? 'border-gph-dark-line' : 'border-gray-200';

  const searchActive = pathname === '/search' || pathname === '/flights' || pathname === '/hotels';
  const searchLabel  = pathname === '/flights' ? 'Flights' : pathname === '/hotels' ? 'Hotels' : null;

  function navLinkCls(active: boolean) {
    const base = 'px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors';
    if (active) return isDark
      ? `${base} bg-white text-gray-900`
      : `${base} bg-gray-900 text-white`;
    return isDark
      ? `${base} text-gph-dark-muted hover:text-gph-dark-ink`
      : `${base} text-gray-500 hover:text-gray-900`;
  }

  function closeSearch() {
    setSearchOpen(false);
  }

  function closeDiscover() {
    setDiscoverOpen(false);
  }

  // Close the Search / Discover dropdowns when clicking outside
  useEffect(() => {
    if (!searchOpen && !discoverOpen) return;
    function handleClick(e: MouseEvent) {
      if (searchOpen && searchRef.current && !searchRef.current.contains(e.target as Node)) {
        closeSearch();
      }
      if (discoverOpen && discoverRef.current && !discoverRef.current.contains(e.target as Node)) {
        closeDiscover();
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [searchOpen, discoverOpen]);

  // Close Search/Discover dropdowns on navigation — adjusted during render
  // (React's documented alternative to an effect for this), not via useEffect.
  const [prevPathname, setPrevPathname] = useState(pathname);
  if (pathname !== prevPathname) {
    setPrevPathname(pathname);
    closeSearch();
    closeDiscover();
  }

  const initials = profile?.display_name
    ? profile.display_name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()
    : user?.email?.[0]?.toUpperCase() ?? '?';

  const dropdownSurface = isDark
    ? 'bg-gph-dark-card border-gph-dark-line'
    : 'bg-white border-gray-200';

  return (
    <nav className={`flex items-center gap-4 px-4 md:px-6 py-3 border-b shrink-0 ${surfaceBg} ${borderCls}`}>
      <Link href="/" className={`text-lg font-bold tracking-tight ${isDark ? 'text-white' : 'text-gray-900'}`}>
        covelo<span className={isDark ? 'text-gph-dark-muted' : 'text-gray-400'}>.</span>
      </Link>

      <div className="flex items-center gap-1">
        {/* Search dropdown */}
        <div
          ref={searchRef}
          className="relative"
          onMouseEnter={() => setSearchOpen(true)}
          onMouseLeave={() => setSearchOpen(false)}
        >
          <button
            onClick={() => { closeSearch(); router.push('/search'); }}
            className={`${navLinkCls(searchActive)} flex items-center gap-1.5`}
            aria-haspopup="true"
            aria-expanded={searchOpen}
          >
            Search
            {searchLabel && (
              <span className={`text-[10px] font-semibold uppercase tracking-widest px-1.5 py-0.5 rounded-md ${
                isDark
                  ? 'bg-black/15 text-gray-900'
                  : 'bg-white/20 text-white'
              }`}>
                {searchLabel}
              </span>
            )}
          </button>

          {searchOpen && (
            <div className="absolute top-full left-0 w-44 pt-1.5 z-50">
            <div className={`rounded-xl border shadow-lg overflow-hidden ${dropdownSurface}`}>
              <SearchDropdownItem
                href="/flights"
                label="Flights"
                enabled={flightsEnabled}
                active={pathname === '/flights'}
                isDark={isDark}
                onClick={() => setSearchOpen(false)}
              />
              <SearchDropdownItem
                href="/hotels"
                label="Hotels"
                enabled={hotelsEnabled}
                active={pathname === '/hotels'}
                isDark={isDark}
                onClick={() => setSearchOpen(false)}
              />
            </div>
            </div>
          )}
        </div>

        {/* Trip Planner temporarily hidden — ui:trip-planner disabled in lib/feature-flags.ts
        <Link href="/trip-planner" className={navLinkCls(pathname === '/trip-planner')}>
          Trip Planner
        </Link>
        */}

        {discoverEnabled && (
          <div
            ref={discoverRef}
            className="relative"
            onMouseEnter={() => setDiscoverOpen(true)}
            onMouseLeave={() => setDiscoverOpen(false)}
          >
            <Link
              href="/discover"
              onClick={closeDiscover}
              className={`${navLinkCls(pathname.startsWith('/discover') || pathname.startsWith('/offers'))} flex items-center gap-1.5`}
              aria-haspopup="true"
              aria-expanded={discoverOpen}
            >
              Discover
              <svg className="w-2.5 h-2.5" viewBox="0 0 10 10" fill="none">
                <path d="M2 3.5l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>

            {discoverOpen && (
              <div className="absolute top-full left-0 w-[244px] pt-1.5 z-50">
                <div className={`rounded-xl border shadow-lg overflow-hidden p-1.5 ${dropdownSurface}`}>
                  <div className={`px-3.5 py-2.5 rounded-lg cursor-default ${isDark ? 'text-gph-dark-muted' : 'text-gray-400'}`}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-bold tracking-tight">The board</span>
                      <span className={`text-[10px] font-semibold uppercase tracking-widest px-1.5 py-0.5 rounded-md ${
                        isDark ? 'bg-gph-dark-line' : 'bg-gray-100'
                      }`}>
                        Soon
                      </span>
                    </div>
                    <div className="text-[10.5px] font-mono mt-0.5 tracking-wide">Community offers and tips</div>
                  </div>
                  <Link
                    href="/offers"
                    onClick={closeDiscover}
                    className={`block px-3.5 py-2.5 rounded-lg transition-colors ${
                      pathname === '/offers'
                        ? isDark ? 'bg-white/10' : 'bg-gray-100'
                        : isDark ? 'hover:bg-white/5' : 'hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className={`text-sm font-bold tracking-tight ${isDark ? 'text-gph-dark-ink' : 'text-gray-900'}`}>All offers</span>
                      {pathname === '/offers' && (
                        <svg className={`w-3 h-3 ${isDark ? 'text-gph-dark-ink' : 'text-gray-900'}`} viewBox="0 0 12 12" fill="none">
                          <path d="M2.5 6.5l2.5 2.5 4.5-4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </div>
                    <div className={`text-[10.5px] font-mono mt-0.5 tracking-wide ${isDark ? 'text-gph-dark-muted' : 'text-gray-400'}`}>
                      Every active offer, filterable by card
                    </div>
                  </Link>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="ml-auto flex items-center gap-2">
        <ThemeToggle compact />

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

interface SearchDropdownItemProps {
  href: string;
  label: string;
  enabled: boolean;
  active: boolean;
  isDark: boolean;
  onClick: () => void;
}

function SearchDropdownItem({ href, label, enabled, active, isDark, onClick }: SearchDropdownItemProps) {
  const base = 'flex items-center justify-between w-full px-4 py-2.5 text-sm font-semibold transition-colors';

  if (!enabled) {
    return (
      <div className={`${base} ${isDark ? 'text-gph-dark-muted' : 'text-gray-400'} cursor-default`}>
        {label}
        <span className={`text-[10px] font-semibold uppercase tracking-widest px-1.5 py-0.5 rounded-md ${
          isDark ? 'bg-gph-dark-line text-gph-dark-muted' : 'bg-gray-100 text-gray-400'
        }`}>
          Soon
        </span>
      </div>
    );
  }

  return (
    <Link
      href={href}
      onClick={onClick}
      className={`${base} ${
        active
          ? isDark ? 'bg-white/10 text-white' : 'bg-gray-100 text-gray-900'
          : isDark ? 'text-gph-dark-ink hover:bg-white/5' : 'text-gray-700 hover:bg-gray-50'
      }`}
    >
      {label}
    </Link>
  );
}
