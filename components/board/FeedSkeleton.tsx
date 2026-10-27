export function FeedSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="flex animate-pulse flex-col gap-2.5" role="status" aria-label="Loading posts">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="grid grid-cols-[44px_1fr] gap-3 rounded-[10px] border border-gph-line bg-gph-card px-3 py-4">
          <div className="mx-auto h-16 w-7 rounded bg-gph-linesoft" />
          <div className="flex flex-col gap-2.5">
            <div className="h-3 w-1/3 rounded bg-gph-linesoft" />
            <div className="h-4 w-4/5 rounded bg-gph-linesoft" />
            <div className="h-3 w-full rounded bg-gph-linesoft" />
          </div>
        </div>
      ))}
    </div>
  );
}
