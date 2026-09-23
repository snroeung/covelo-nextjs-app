'use client';

import Link from 'next/link';
import { todayPill } from '@/lib/discover/offerCopy';
import { gphTheme } from '@/lib/discover/theme';

interface Props {
  isDark: boolean;
  offerCount: number;
}

export function DiscoverMasthead({ isDark, offerCount }: Props) {
  const { ink, rule, accent } = gphTheme;
  const pillBg = isDark ? 'bg-gph-dark-actionsoft text-gph-dark-action' : 'bg-gph-actionsoft text-gph-action';
  const ghostCls = isDark
    ? 'bg-gph-dark-card border border-gph-dark-line text-gph-dark-ink hover:bg-gph-dark-linesoft'
    : 'bg-gph-card border border-gph-line text-gph-ink hover:bg-gph-linesoft';
  const solidCls = isDark
    ? 'bg-gph-dark-action text-gph-dark-bg hover:bg-gph-dark-actionhi'
    : 'bg-gph-action text-white hover:bg-gph-actionhi';

  return (
    <div className={`flex items-end justify-between gap-6 flex-wrap pb-3.5 border-b-2 ${rule}`}>
      <div>
        <div className="flex items-center gap-2.5 mb-2.5">
          <span className={`text-[10px] font-mono font-extrabold tracking-[0.14em] px-2 py-1 rounded ${pillBg}`}>
            {todayPill()}
          </span>
        </div>
        <h1 className={`text-4xl md:text-5xl font-extrabold leading-none tracking-tight ${ink}`}>
          Discover<span className={accent}>.</span>
        </h1>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-md text-xs font-bold transition-colors min-h-11 ${ghostCls}`}
        >
          <svg className="w-3 h-3" viewBox="0 0 14 14" fill="none">
            <path d="M7 12.2S1.5 9 1.5 5.3A2.8 2.8 0 0 1 7 4.1a2.8 2.8 0 0 1 5.5 1.2C12.5 9 7 12.2 7 12.2z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
          </svg>
          Saved · 3
        </button>
        <Link
          href="/offers"
          target="_blank"
          rel="noopener noreferrer"
          className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-xs font-bold transition-colors min-h-11 ${solidCls}`}
        >
          See all offers · {offerCount}
          <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none">
            <path d="M2 6h8M6.5 2.5L10 6l-3.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
      </div>
    </div>
  );
}
