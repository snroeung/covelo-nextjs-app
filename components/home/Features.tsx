'use client';

import Link from 'next/link';

const CAP = 'font-mono text-[10px] font-bold uppercase tracking-widest';
const ROW = 'flex min-h-10 items-center justify-between rounded-[10px] border border-gph-line bg-gph-card px-3 text-[13px] font-semibold text-gph-ink';
const KIND = `${CAP} rounded border border-gph-line px-1.5 py-0.5 text-gph-muted`;

// Features section: heading + 3 tiles, each with a mini-UI visual, title,
// description and a mono CTA. No trailing period on the heading (wordmark only).
export function Features() {
  return (
    <section id="features" className="mx-auto max-w-[1280px] px-6 pt-20" style={{ scrollSnapAlign: 'start' }}>
      <div className="mt-3 border-b-2 border-gph-ink pb-4">
        <h2 className="text-[40px] font-extrabold leading-none tracking-[-0.04em] text-gph-ink sm:text-[56px]">Features</h2>
      </div>
      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        {/* Search */}
        <Link href="/search" className="flex flex-col overflow-hidden rounded-[14px] border border-gph-line bg-gph-card">
          <div className="flex h-[150px] flex-col justify-center gap-2 border-b border-gph-line bg-gph-bg px-5 py-4">
            <div className="grid grid-cols-2 gap-2">
              <div className="flex min-w-0 flex-col gap-1"><span className={`${CAP} text-gph-muted`}>From</span><div className={`${ROW} overflow-hidden whitespace-nowrap font-medium`}>PHL · Philadelphia</div></div>
              <div className="flex min-w-0 flex-col gap-1"><span className={`${CAP} text-gph-muted`}>To</span><div className={`${ROW} overflow-hidden whitespace-nowrap font-medium`}>SFO · San Francisco</div></div>
            </div>
            <span className="flex min-h-10 w-full items-center justify-center rounded-[10px] bg-gph-action px-5 text-sm font-bold text-gph-bg">Search →</span>
          </div>
          <div className="flex flex-1 flex-col gap-2 px-5 pb-[22px] pt-5">
            <h3 className="text-xl font-extrabold tracking-[-0.02em] text-gph-ink">Search</h3>
            <p className="text-sm leading-[1.55] text-gph-muted">Search flights and hotels and see estimated points and prices from 40+ credit card, hotel and flights partners.</p>
            <span className={`${CAP} mt-auto pt-2.5 text-gph-ink`}>Open search →</span>
          </div>
        </Link>

        {/* Discover */}
        <Link href="/discover" className="flex flex-col overflow-hidden rounded-[14px] border border-gph-line bg-gph-card">
          <div className="flex h-[150px] flex-col justify-center gap-2 border-b border-gph-line bg-gph-bg p-5">
            <div className={ROW}><span className="flex items-center gap-2.5"><span className={KIND}>BONUS</span>Transfer bonus</span></div>
            <div className={ROW}><span className="flex items-center gap-2.5"><span className={KIND}>DEAL</span>Partner deal</span></div>
            <div className={ROW}><span className="flex items-center gap-2.5"><span className={KIND}>CREDIT</span>Statement credit</span></div>
          </div>
          <div className="flex flex-1 flex-col gap-2 px-5 pb-[22px] pt-5">
            <h3 className="text-xl font-extrabold tracking-[-0.02em] text-gph-ink">Discover</h3>
            <p className="text-sm leading-[1.55] text-gph-muted">Browse transfer bonuses, partner deals and credits, curated by real people.</p>
            <span className={`${CAP} mt-auto pt-2.5 text-gph-ink`}>Browse offers →</span>
          </div>
        </Link>

        {/* Trip planner */}
        <Link href="/trip-planner" className="flex flex-col overflow-hidden rounded-[14px] border border-gph-line bg-gph-card">
          <div className="flex h-[150px] flex-col justify-center gap-1.5 border-b border-gph-line bg-gph-bg p-5">
            <div className={ROW}><span className="flex items-center gap-2.5"><span className={KIND}>D1</span>Fly PHL → SFO</span><span className={`${CAP} font-medium text-gph-muted`}>7:05A</span></div>
            <div className={ROW}><span className="flex items-center gap-2.5"><span className={KIND}>D2</span>Ferry Building, dinner</span><span className={`${CAP} font-medium text-gph-muted`}>2 STOPS</span></div>
            <div className={ROW}><span className="flex items-center gap-2.5"><span className={KIND}>D3</span>Fly home</span><span className={`${CAP} font-medium text-gph-muted`}>5:20P</span></div>
          </div>
          <div className="flex flex-1 flex-col gap-2 px-5 pb-[22px] pt-5">
            <h3 className="text-xl font-extrabold tracking-[-0.02em] text-gph-ink">Trip planner</h3>
            <p className="text-sm leading-[1.55] text-gph-muted">Turn a search into a day-by-day plan, with your flights, stays and things to do in one place.</p>
            <span className={`${CAP} mt-auto pt-2.5 text-gph-ink`}>Plan a trip →</span>
          </div>
        </Link>
      </div>
    </section>
  );
}
