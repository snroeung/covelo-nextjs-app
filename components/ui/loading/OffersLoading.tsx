import { LoadingRegion, Shimmer, Stagger, StatusCycle } from './primitives';

const LINES = ['Fetching live offers…', 'Checking expiry dates…', 'Matching your cards…', 'Ranking by value…'];
const ROWS = [
  { a: '52%', b: '70%' }, { a: '44%', b: '62%' }, { a: '58%', b: '66%' },
  { a: '48%', b: '58%' }, { a: '62%', b: '72%' }, { a: '56%', b: '80%' },
];

/** Rows shaped like the offer list. `compact` is the phone layout: 40px icon, no value column. */
export function OffersLoading({ compact = false }: { compact?: boolean }) {
  return (
    <LoadingRegion label="Loading offers" className="flex flex-col py-2">
      <StatusCycle lines={LINES} className="mb-4" />
      {ROWS.map((r, i) => (
        <Stagger key={i} i={i % 4} className={i >= 4 ? 'hidden md:block' : ''}>
          <div className={`grid items-center gap-3 border-b border-gph-line py-3.5 md:gap-4 md:py-4 ${compact ? 'grid-cols-[40px_1fr_56px] md:grid-cols-[48px_1fr_110px_90px]' : 'grid-cols-[48px_1fr_110px_90px]'}`}>
            <Shimmer className="h-10 w-10 rounded-[10px]! md:h-12 md:w-12" />
            <div className="flex flex-col gap-2"><Shimmer className="h-3" style={{ width: r.a }} /><Shimmer className="h-2.25" style={{ width: r.b }} /></div>
            <Shimmer className="hidden h-5.5 w-20 md:block" />
            <Shimmer className="h-8 rounded-lg! md:h-9" />
          </div>
        </Stagger>
      ))}
    </LoadingRegion>
  );
}
