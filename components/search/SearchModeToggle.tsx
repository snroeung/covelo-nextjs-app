'use client';

import { useTheme } from '@/contexts/ThemeContext';

export type SearchMode = 'flights' | 'hotels';

const PlaneIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3.5 20.5 3 18.5 3.5 17 5l-3.5 3.5L5.3 6.7c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 4.8c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z" />
  </svg>
);
const BedIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 4v16M2 8h18a2 2 0 0 1 2 2v10M2 17h20M6 8V6a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v2" />
  </svg>
);

export function SearchModeToggle({ mode, onChange }: { mode: SearchMode; onChange: (m: SearchMode) => void }) {
  const { isDark } = useTheme();
  const opts: { k: SearchMode; label: string; Icon: typeof PlaneIcon }[] = [
    { k: 'flights', label: 'Flights', Icon: PlaneIcon },
    { k: 'hotels',  label: 'Hotels',  Icon: BedIcon },
  ];

  const wrapCls = isDark ? 'border-gph-dark-line bg-gph-dark-card' : 'border-gray-200 bg-gray-100';

  return (
    <div className={`inline-flex gap-1 rounded-xl border p-1.5 ${wrapCls}`} role="tablist" aria-label="Search type">
      {opts.map(({ k, label, Icon }) => {
        const active = mode === k;
        const activeCls = isDark ? 'bg-gph-dark-action text-gph-dark-bg' : 'bg-gray-900 text-white';
        const idleCls   = isDark ? 'text-gph-dark-muted' : 'text-gray-500';
        return (
          <button
            key={k}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(k)}
            className={`inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-bold min-h-11 transition-colors ${active ? activeCls : idleCls}`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        );
      })}
    </div>
  );
}
