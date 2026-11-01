'use client';

import { useRouter } from 'next/navigation';
import { btn } from '@/components/ui/button';

/** Phone results bar: back · "PHL → SFO" + dates · Edit. Edit reopens the search form. */
export function MobileResultsHeader({ title, subtitle, onEdit }: { title: string; subtitle: string; onEdit: () => void }) {
  const router = useRouter();
  return (
    <header data-testid="mobile-results-header" className="flex items-center gap-2.5 px-3 py-2">
      <button type="button" onClick={() => router.back()} aria-label="Back" className={btn('secondary', 'icon', 'shrink-0')}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="m15 18-6-6 6-6" />
        </svg>
      </button>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15.5px] font-bold leading-tight tracking-tight text-gph-ink">{title}</p>
        <p className="truncate font-mono text-[10px] tracking-wide text-gph-muted">{subtitle}</p>
      </div>
      <button type="button" onClick={onEdit} className={btn('secondary', 'md', 'shrink-0 bg-gph-bg!')}>Edit</button>
    </header>
  );
}
