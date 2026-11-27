'use client';

// "What's next" — two roadmap cards. No eyebrow, no "Planned" badges.
export function Roadmap() {
  return (
    <section id="next" className="mx-auto max-w-[1280px] px-6 pt-20" style={{ scrollSnapAlign: 'start' }}>
      <div className="mt-3 border-b-2 border-gph-ink pb-4">
        <h2 className="text-[40px] font-extrabold leading-none tracking-[-0.04em] text-gph-ink sm:text-[56px]">What&apos;s next</h2>
      </div>
      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-2.5 rounded-[14px] border border-gph-line bg-gph-card px-6 pb-6 pt-[22px]">
          <div className="flex items-center justify-between">
            <div className="flex h-12 w-12 items-center justify-center rounded-[10px] bg-gph-linesoft">
              <svg viewBox="0 0 16 16" width="20" height="20" fill="currentColor" className="text-gph-ink" style={{ shapeRendering: 'crispEdges' }}><path d="M2 2h12v8H9v2H8v2H7v-2H6v-2H2z" /></svg>
            </div>
          </div>
          <h3 className="mt-1.5 text-xl font-extrabold tracking-[-0.02em] text-gph-ink">Claude and ChatGPT connector</h3>
          <p className="text-sm leading-[1.55] text-gph-muted">Ask your AI assistant to search Covelo and compare portal prices without leaving the chat.</p>
        </div>
        <div className="flex flex-col gap-2.5 rounded-[14px] border border-gph-line bg-gph-card px-6 pb-6 pt-[22px]">
          <div className="flex items-center justify-between">
            <div className="flex h-12 w-12 items-center justify-center rounded-[10px] bg-gph-linesoft">
              <svg viewBox="0 0 16 16" width="20" height="20" fill="currentColor" className="text-gph-ink" style={{ shapeRendering: 'crispEdges' }}><path d="M7 1h2v1H7zM5 2h6v1H5zM4 3h8v5H4zM3 8h10v2H3zM2 10h12v2H2zM6 13h4v2H6z" /></svg>
            </div>
          </div>
          <h3 className="mt-1.5 text-xl font-extrabold tracking-[-0.02em] text-gph-ink">Price notifications</h3>
          <p className="text-sm leading-[1.55] text-gph-muted">Get an alert when a flight or hotel you&apos;re watching drops in points or cash.</p>
        </div>
      </div>
    </section>
  );
}
