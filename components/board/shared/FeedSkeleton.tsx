import { PixelIcon } from '@/components/ui/loading/PixelIcon';
import { LoadingRegion, Shimmer, Stagger } from '@/components/ui/loading/primitives';

const TITLE_WIDTHS = [
  ['90%', '58%'],
  ['82%', '70%'],
  ['94%', '40%'],
];

export function FeedSkeleton({ count = 3, label = 'Loading posts' }: { count?: number; label?: string }) {
  return (
    <LoadingRegion label={label} className="flex flex-col gap-2.5">
      {Array.from({ length: count }, (_, i) => {
        const [t1, t2] = TITLE_WIDTHS[i % TITLE_WIDTHS.length];
        return (
          <Stagger key={i} i={i}>
            <div className="grid grid-cols-[44px_1fr] gap-3 rounded-[10px] border border-gph-line bg-gph-card py-4 pl-1.5 pr-3.5">
              <div className="flex flex-col items-center gap-1.5 text-gph-line">
                <PixelIcon name="up" className="h-4 w-4" />
                <Shimmer className="h-2.5 w-4" />
                <PixelIcon name="down" className="h-4 w-4" />
              </div>
              <div>
                <div className="mb-3 flex items-center gap-2">
                  <Shimmer className="h-5 w-5 rounded-full!" />
                  <Shimmer className="h-2.25 w-20" />
                  <Shimmer className="h-3.5 w-11 rounded!" />
                </div>
                <Shimmer className="h-3.25" style={{ width: t1 }} />
                <Shimmer className="mt-2 h-3.25" style={{ width: t2 }} />
                <div className="mt-3.5 flex gap-3.5">
                  <Shimmer className="h-2.25 w-17.5" />
                  <Shimmer className="h-2.25 w-10" />
                  <Shimmer className="h-2.25 w-9" />
                </div>
              </div>
            </div>
          </Stagger>
        );
      })}
    </LoadingRegion>
  );
}
