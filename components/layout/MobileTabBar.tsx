'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { isEnabled } from '@/lib/feature-flags';

// Phone-only bottom navigation (Search / Offers / You). The top NavBar keeps
// just the wordmark and theme toggle below md; from md up this bar is gone.

const HIDDEN_ON = ['/admin', '/auth', '/onboarding'];

type TabKey = 'search' | 'offers' | 'you';

const TABS: Array<{ key: TabKey; label: string; href: string; enabled: boolean; match: (p: string) => boolean }> = [
  {
    key: 'search', label: 'Search', href: '/search', enabled: isEnabled('ui:search'),
    match: (p) => p === '/search' || p.startsWith('/flights') || p.startsWith('/hotels'),
  },
  {
    key: 'offers', label: 'Offers', href: '/discover', enabled: isEnabled('ui:discover'),
    match: (p) => p.startsWith('/discover') || p.startsWith('/offers'),
  },
  {
    key: 'you', label: 'You', href: '/you', enabled: isEnabled('ui:you'),
    match: (p) => p.startsWith('/you') || p.startsWith('/settings'),
  },
];

function TabIcon({ tab, active }: { tab: TabKey; active: boolean }) {
  const props = {
    width: 22, height: 22, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
    strokeWidth: active ? 2.3 : 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true,
  };
  if (tab === 'search') return <svg {...props}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>;
  if (tab === 'offers') return <svg {...props}><path d="M13 2 4 14h7l-1 8 9-12h-7z" /></svg>;
  return <svg {...props}><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></svg>;
}

export function MobileTabBar() {
  const pathname = usePathname();
  const visible = !HIDDEN_ON.some((p) => pathname.startsWith(p));
  const tabs = TABS.filter((t) => t.enabled);

  // Reserves the bar's height at the bottom of the page (see globals.css)
  useEffect(() => {
    if (!visible) return;
    document.body.classList.add('has-tabbar');
    return () => document.body.classList.remove('has-tabbar');
  }, [visible]);

  if (!visible || tabs.length === 0) return null;

  return (
    <nav
      aria-label="Sections"
      data-testid="mobile-tab-bar"
      className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t bg-gph-card border-gph-line pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="grid h-14" style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}>
        {tabs.map((t) => {
          const active = t.match(pathname);
          return (
            <li key={t.key} className="min-w-0">
              <Link
                href={t.href}
                aria-current={active ? 'page' : undefined}
                className={`relative flex h-full min-h-11 flex-col items-center justify-center gap-1 text-[10.5px] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-gph-ink ${
                  active ? 'font-extrabold text-gph-ink' : 'font-semibold text-gph-muted'
                }`}
              >
                {active && <span aria-hidden="true" className="absolute top-0 left-1/2 h-[2.5px] w-[34px] -translate-x-1/2 rounded-sm bg-gph-ink" />}
                <TabIcon tab={t.key} active={active} />
                {t.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
