import { PixelIcon } from './PixelIcon';
import { LoadingRegion, Shimmer, Stagger, StatusCycle } from './primitives';

const LINES = ['Searching airlines…', 'Checking fare rules…', 'Comparing points value…', 'Sorting by best value…'];

function RowSkeleton({ i }: { i: number }) {
  return (
    <Stagger i={i}>
      <div className="overflow-hidden rounded-2xl border border-gph-line bg-gph-card">
        <div className="grid grid-cols-[40px_1fr_64px] items-center gap-3 p-4 md:grid-cols-[40px_1fr_120px_90px] md:gap-4">
          <Shimmer className="h-10 w-10 rounded-lg!" />
          <div className="flex flex-col gap-2">
            <Shimmer className="h-2.75 w-3/5" />
            <Shimmer className="h-2.25 w-2/5" />
          </div>
          <Shimmer className="hidden h-3 md:block" />
          <Shimmer className="ml-auto h-4.5 w-16" />
        </div>
        <div className="flex items-center gap-3.5 border-t border-gph-line bg-gph-bg px-4 py-3">
          <Shimmer className="h-2.5 w-20" />
          <Shimmer className="h-7.5 flex-1 rounded-lg!" />
        </div>
      </div>
    </Stagger>
  );
}

export function FlightsLoading({ origin, destination }: { origin: string; destination: string }) {
  return (
    <LoadingRegion label="Loading flights" className="flex flex-col gap-3">
      <div className="rounded-2xl border border-gph-line bg-gph-card px-4.5 pb-4 pt-3.5" aria-hidden="true">
        <div className="cv-route text-gph-ink">
          <div className="cv-track" />
          <PixelIcon name="pin" className="absolute left-3.75 top-3.25 h-4 w-4" />
          <PixelIcon name="pin" className="absolute right-3.75 top-3.25 h-4 w-4" />
          <span className="absolute left-3 top-9.5 font-mono text-[11px] font-bold">{origin}</span>
          <span className="absolute right-3 top-9.5 font-mono text-[11px] font-bold">{destination}</span>
          <div className="cv-plane text-gph-accent-green"><PixelIcon name="plane" className="h-4 w-4" /></div>
        </div>
        <StatusCycle lines={LINES} />
      </div>
      <div className="hidden grid-cols-[180px_1fr] items-end gap-6 rounded-2xl border border-gph-line bg-gph-card px-4.5 py-3.5 md:grid" aria-hidden="true">
        <div className="flex flex-col gap-2"><Shimmer className="h-2.25 w-3/4" /><Shimmer className="h-5.5 w-16" /></div>
        <div className="flex h-11 items-end gap-1.25">
          {[40, 62, 48, 80, 55, 70, 35, 58, 66].map((h, k) => <Shimmer key={k} className="flex-1 rounded-b-none! rounded-t-sm!" style={{ height: `${h}%` }} />)}
        </div>
      </div>
      <RowSkeleton i={0} />
      <RowSkeleton i={1} />
      <RowSkeleton i={2} />
    </LoadingRegion>
  );
}
