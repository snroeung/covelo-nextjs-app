'use client';

import { useTheme } from '@/contexts/ThemeContext';

// Shared site footer. Token/className-based (matches the /search hub design).
export function Footer() {
  const { isDark } = useTheme();
  const surface = isDark ? 'bg-gph-dark-card border-gph-dark-line' : 'bg-white border-gray-200';
  const ink     = isDark ? 'text-gph-dark-ink' : 'text-gray-900';
  const muted   = isDark ? 'text-gph-dark-muted' : 'text-gray-500';

  return (
    <footer className={`border-t px-4 md:px-8 py-6 flex justify-between text-[11px] font-mono font-bold uppercase tracking-widest ${surface} ${muted}`}>
      <span className={ink}>covelo.</span>
      <span className="hidden sm:inline">Every portal. One search.</span>
      <span>Privacy · Terms · Contact</span>
    </footer>
  );
}
