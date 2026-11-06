import { PixelIcon } from './PixelIcon';
import { LoadingRegion, Shimmer, Stagger, StatusCycle } from './primitives';

const LINES = ['Finding stays…', 'Checking room rates…', 'Comparing points value…', 'Sorting by best value…'];
const PINS = [
  { left: '12%', top: '28%', delay: '.2s' },
  { left: '34%', top: '52%', delay: '.9s' },
  { left: '62%', top: '24%', delay: '1.6s' },
  { left: '82%', top: '58%', delay: '2.3s' },
];

function CardSkeleton({ i }: { i: number }) {
  return (
    <Stagger i={i}>
      <div className="flex flex-col overflow-hidden rounded-2xl border border-gph-line bg-gph-card md:flex-row">
        <Shimmer className="h-36 w-full rounded-none! md:h-auto md:min-h-36 md:w-44 md:shrink-0" />
        <div className="flex flex-1 flex-col gap-2 p-4">
          <Shimmer className="h-3.25 w-3/5" />
          <Shimmer className="h-2.25 w-2/5" />
          <Shimmer className="h-2.25 w-1/2" />
          <div className="mt-auto flex items-end justify-between pt-2">
            <Shimmer className="h-2.25 w-1/4" />
            <Shimmer className="h-5.5 w-20" />
          </div>
        </div>
      </div>
    </Stagger>
  );
}

export function HotelsLoading() {
  return (
    <LoadingRegion label="Loading hotels" className="flex flex-col gap-3">
      <div className="relative h-28 overflow-hidden rounded-2xl border border-gph-line bg-gph-linesoft md:h-40" aria-hidden="true">
        {[22, 50, 78].map((t) => <div key={t} className="cv-gl left-0 h-px w-full" style={{ top: `${t}%` }} />)}
        {[15, 38, 62, 85].map((l) => <div key={l} className="cv-gl top-0 h-full w-px" style={{ left: `${l}%` }} />)}
        {PINS.map((p) => (
          <div key={p.left} className="cv-pin" style={{ left: p.left, top: p.top, animationDelay: p.delay }}>
            <PixelIcon name="pin" className="h-4 w-4" />
          </div>
        ))}
        <div className="cv-scan" />
      </div>
      <StatusCycle lines={LINES} className="mb-1" />
      <CardSkeleton i={0} />
      <CardSkeleton i={1} />
      <CardSkeleton i={2} />
    </LoadingRegion>
  );
}
