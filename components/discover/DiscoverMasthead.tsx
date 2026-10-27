'use client';

import { btn } from '@/components/ui/button';
import Link from 'next/link';
import { todayPill } from '@/lib/discover/offerCopy';

interface Props {
  isDark: boolean;
  offerCount: number;
}

export function DiscoverMasthead({ isDark, offerCount }: Props) {
  const pillBg = isDark ? 'bg-gph-dark-actionsoft text-gph-dark-action' : 'bg-gph-actionsoft text-gph-action';

  return (
    <div className="flex items-end justify-between gap-6 flex-wrap pb-3.5 border-b-2 border-gph-ink">
      <div>
        <div className="flex items-center gap-2.5 mb-2.5">
          <span className={`text-[10px] font-mono font-extrabold tracking-[0.14em] px-2 py-1 rounded ${pillBg}`}>
            {todayPill()}
          </span>
        </div>
        <h1 className="text-4xl md:text-5xl font-extrabold leading-none tracking-tight text-gph-ink">
          Discover
        </h1>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          className={btn('secondary')}
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
          className={btn('primary')}
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
