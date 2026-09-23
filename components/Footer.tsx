'use client';

// Shared site footer — adopts the Discover/Offers graphite theme, CSS-reactive
// via app/globals.css (no isDark ternary needed).
export function Footer() {
  return (
    <footer className="border-t px-4 md:px-8 py-6 flex justify-between text-[11px] font-mono font-bold uppercase tracking-widest bg-gph-card border-gph-line text-gph-muted">
      <span className="text-gph-ink">covelo<span className="text-gph-accent-green">.</span></span>
      <span className="hidden sm:inline">Every portal. One search.</span>
      <span>Privacy · Terms · Contact</span>
    </footer>
  );
}
