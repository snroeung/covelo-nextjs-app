import { LoadingRegion, Shimmer, Stagger, StatusCycle } from './primitives';

const LINES = ['Finding offers…', 'Checking expiry dates…', 'Sorting by newest…'];

/** Lead story, then two secondary stories and a text rail: the real page's `[1fr_1fr_0.95fr]` shape. */
export function DiscoverLoading() {
  return (
    <LoadingRegion label="Loading offers" className="flex flex-col gap-6">
      <StatusCycle lines={LINES} />
      <Stagger>
        <div className="grid gap-5 md:grid-cols-[1.1fr_1fr] md:gap-8">
          <Shimmer className="h-48 rounded-2xl! md:h-64" />
          <div className="flex flex-col gap-3.5 md:pt-1.5">
            <Shimmer className="h-2.5 w-4/5" />
            <Shimmer className="mt-1.5 h-6 w-full" />
            <Shimmer className="h-6 w-11/12" />
            <Shimmer className="h-6 w-3/5" />
            <Shimmer className="mt-2 h-3 w-3/4" />
          </div>
        </div>
      </Stagger>
      <div className="grid gap-6 border-t border-gph-line pt-6 md:grid-cols-[1fr_1fr_0.95fr]">
        {[1, 2].map((i) => (
          <Stagger key={i} i={i} className={i === 2 ? 'hidden md:block' : ''}>
            <div className="flex flex-col gap-3">
              <Shimmer className="h-36 rounded-xl!" />
              <Shimmer className="h-2.5 w-3/4" />
              <Shimmer className="h-4 w-11/12" />
              <Shimmer className="h-4 w-3/5" />
            </div>
          </Stagger>
        ))}
        <Stagger i={3} className="hidden md:block">
          <div className="flex flex-col gap-4">
            {[0, 1, 2].map((r) => (
              <div key={r} className="flex flex-col gap-2 border-b border-gph-line pb-4 last:border-0">
                <Shimmer className="h-2.5 w-1/2" />
                <Shimmer className="h-4 w-full" />
              </div>
            ))}
          </div>
        </Stagger>
      </div>
    </LoadingRegion>
  );
}
