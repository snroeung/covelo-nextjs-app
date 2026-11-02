import { LoadingRegion, StatusCycle } from './primitives';

const COLS = 8;
const ROWS = 5;
// Tiles fade in on a diagonal wave, same formula as the design script.
const TILES = Array.from({ length: COLS * ROWS }, (_, i) => {
  const r = Math.floor(i / COLS);
  const c = i % COLS;
  return +((r + c) * 0.06 + ((i * 37) % 5) * 0.03).toFixed(2);
});

/** Covers the map until Mapbox fires `load`. `count` = pins about to drop, when known. */
export function MapLoading({ count }: { count?: number }) {
  const lines = ['Loading map tiles…', count ? `Placing ${count} ${count === 1 ? 'hotel' : 'hotels'}…` : 'Placing price pins…', 'Map ready'];
  return (
    <LoadingRegion label="Loading map" className="absolute inset-0 z-10 overflow-hidden bg-gph-linesoft">
      <div className="absolute inset-0 grid" style={{ gridTemplateColumns: `repeat(${COLS}, minmax(0, 1fr))`, gridTemplateRows: `repeat(${ROWS}, minmax(0, 1fr))` }} aria-hidden="true">
        {TILES.map((d, i) => <div key={i} className="cv-tile" style={{ animationDelay: `${d}s` }} />)}
      </div>
      <div className="cv-water" style={{ left: -30, top: 0, width: 90, height: '100%', transform: 'skewX(-8deg)' }} aria-hidden="true" />
      <div className="cv-park" style={{ right: '8%', top: '12%', width: 150, height: 90 }} aria-hidden="true" />
      <div className="cv-road" style={{ left: 0, top: '52%', width: '100%', height: 6, transform: 'rotate(-4deg)' }} aria-hidden="true" />
      <div className="cv-road" style={{ left: '17%', top: 0, width: 5, height: '100%' }} aria-hidden="true" />
      <div className="cv-road" style={{ left: 0, top: '78%', width: '100%', height: 4 }} aria-hidden="true" />
      <div className="cv-road" style={{ left: '41%', top: 0, width: 4, height: '100%', transform: 'rotate(6deg)' }} aria-hidden="true" />
      <div className="cv-ping" aria-hidden="true" />
      <div className="absolute inset-x-3 bottom-3 max-w-sm rounded-[10px] border border-gph-line bg-gph-card px-3 py-2.5" aria-hidden="true">
        <StatusCycle lines={lines} />
        <div className="cv-mtrack"><i /></div>
      </div>
    </LoadingRegion>
  );
}
