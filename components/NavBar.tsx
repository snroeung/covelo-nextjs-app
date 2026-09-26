'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useAuth } from '@/contexts/AuthContext';
import { ProfilePopup } from '@/components/ProfilePopup';
import { isEnabled } from '@/lib/feature-flags';

const flightsEnabled    = isEnabled('ui:flights');
const hotelsEnabled     = isEnabled('ui:hotels');
const discoverEnabled   = isEnabled('ui:discover');

export function NavBar() {
  const { user, profile, loading } = useAuth();
  const pathname     = usePathname();
  const router       = useRouter();
  const avatarRef    = useRef<HTMLButtonElement>(null);
  const searchRef    = useRef<HTMLDivElement>(null);
  const discoverRef  = useRef<HTMLDivElement>(null);
  const [popupOpen, setPopupOpen]     = useState(false);
  const [searchOpen, setSearchOpen]   = useState(false);
  const [discoverOpen, setDiscoverOpen] = useState(false);

  const searchActive = pathname === '/search' || pathname === '/flights' || pathname === '/hotels';
  const searchLabel  = pathname === '/flights' ? 'Flights' : pathname === '/hotels' ? 'Hotels' : null;

  function navLinkCls(active: boolean) {
    const base = 'px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors';
    if (active) return `${base} bg-cv-green-800 text-white`;
    return `${base} text-gph-muted hover:text-gph-accent-green`;
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

  return (
    <nav className="flex items-center gap-4 px-4 md:px-6 py-3 border-b shrink-0 bg-gph-card border-gph-line">
      <Link href="/" className="text-lg font-bold tracking-tight text-gph-ink">
        covelo<span className="text-gph-accent-green">.</span>
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
              <span className="text-[10px] font-semibold uppercase tracking-widest px-1.5 py-0.5 rounded-md bg-white text-cv-green-800">
                {searchLabel}
              </span>
            )}
          </button>

          {searchOpen && (
            <div className="absolute top-full left-0 w-61 pt-1.5 z-50">
              <div className="rounded-xl border shadow-lg overflow-hidden p-1.5 flex flex-col gap-1 bg-gph-card border-gph-line">
                <SearchDropdownItem
                  href="/flights"
                  label="Flights"
                  description=""
                  enabled={flightsEnabled}
                  active={pathname === '/flights'}
                  onClick={() => setSearchOpen(false)}
                />
                <SearchDropdownItem
                  href="/hotels"
                  label="Hotels"
                  description=""
                  enabled={hotelsEnabled}
                  active={pathname === '/hotels'}
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
              className={navLinkCls(pathname.startsWith('/discover') || pathname.startsWith('/offers'))}
              aria-haspopup="true"
              aria-expanded={discoverOpen}
            >
              Discover
            </Link>

            {discoverOpen && (
              <div className="absolute top-full left-0 w-[244px] pt-1.5 z-50">
                <div className="rounded-xl border shadow-lg overflow-hidden p-1.5 flex flex-col gap-1 bg-gph-card border-gph-line">
                  <div className="px-3.5 py-2.5 rounded-lg cursor-default text-gph-muted">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-bold tracking-tight">The board</span>
                      <span className="text-[10px] font-semibold uppercase tracking-widest px-1.5 py-0.5 rounded-md bg-gph-linesoft">
                        Soon
                      </span>
                    </div>
                    <div className="text-[10.5px] font-mono mt-0.5 tracking-wide">Community offers and tips</div>
                  </div>
                  <Link
                    href="/offers"
                    onClick={closeDiscover}
                    className={`block px-3.5 py-2.5 rounded-lg transition-colors hover:bg-gph-linesoft ${
                      pathname === '/offers' ? 'bg-gph-linesoft' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-bold tracking-tight text-gph-ink">All offers</span>
                      {pathname === '/offers' && (
                        <svg className="w-3 h-3 text-gph-ink" viewBox="0 0 12 12" fill="none">
                          <path d="M2.5 6.5l2.5 2.5 4.5-4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </div>
                    <div className="text-[10.5px] font-mono mt-0.5 tracking-wide text-gph-muted">
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
          <div className="w-9 h-9 rounded-full bg-gph-linesoft animate-pulse" />
        ) : user ? (
          <div className="relative">
            <button
              ref={avatarRef}
              onClick={() => setPopupOpen((v) => !v)}
              className="w-9 h-9 rounded-full bg-cv-green-800 flex items-center justify-center text-white text-xs font-bold select-none hover:bg-cv-green-700 transition-colors focus:outline-none focus:ring-2 focus:ring-cv-green-500 focus:ring-offset-2"
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
            className="px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors bg-cv-green-800 text-white hover:brightness-110"
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
  description: string;
  enabled: boolean;
  active: boolean;
  onClick: () => void;
}

function SearchDropdownItem({ href, label, description, enabled, active, onClick }: SearchDropdownItemProps) {
  if (!enabled) {
    return (
      <div className="px-3.5 py-2.5 rounded-lg cursor-default text-gph-muted">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-bold tracking-tight">{label}</span>
          <span className="text-[10px] font-semibold uppercase tracking-widest px-1.5 py-0.5 rounded-md bg-gph-linesoft">
            Soon
          </span>
        </div>
        <div className="text-[10.5px] font-mono mt-0.5 tracking-wide">{description}</div>
      </div>
    );
  }

  return (
    <Link
      href={href}
      onClick={onClick}
      className={`block px-3.5 py-2.5 rounded-lg transition-colors hover:bg-gph-linesoft ${active ? 'bg-gph-linesoft' : ''}`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-bold tracking-tight text-gph-ink">{label}</span>
        {active && (
          <svg className="w-3 h-3 text-gph-ink" viewBox="0 0 12 12" fill="none">
            <path d="M2.5 6.5l2.5 2.5 4.5-4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </div>
      <div className="text-[10.5px] font-mono mt-0.5 tracking-wide text-gph-muted">{description}</div>
    </Link>
  );
}
