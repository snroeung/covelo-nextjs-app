'use client';

import { gphTheme } from '@/lib/discover/theme';

// Shared site footer — adopts the Discover/Offers graphite theme, CSS-reactive
// via app/globals.css (no isDark ternary needed).
export function Footer() {
  const { cardBg, line, ink, muted } = gphTheme;

  return (
    <footer className={`border-t px-4 md:px-8 py-6 flex justify-between text-[11px] font-mono font-bold uppercase tracking-widest ${cardBg} ${line} ${muted}`}>
      <span className={ink}>covelo<span className="text-gph-accent-green">.</span></span>
      <span className="hidden sm:inline">Every portal. One search.</span>
      <span>Privacy · Terms · Contact</span>
    </footer>
  );
}
