// 16×16 pixel glyphs from the loading design. crispEdges keeps the 8-bit look at any size.
const PATHS = {
  pin: 'M5 1h6v1h2v2h1v5h-1v2h-2v2h-1v2H6v-2H5v-2H3V9H2V4h1V2h2zM6 5h4v3H6z',
  plane: 'M1 7h14v2H1zM6 2h2v1h1v1h1v3H6zM6 9h4v3H9v1H8v1H6zM1 4h2v3H1zM1 9h2v3H1z',
  up: 'M7 4h2v2h2v2h2v2H3V8h2V6h2z',
  down: 'M3 6h10v2h-2v2H9v2H7v-2H5V8H3z',
  check: 'M2 8h3v2h2V8h2V6h2V4h3v3h-2v2h-2v2h-2v2H6v-2H4v-1H2z',
} as const;

export type PixelIconName = keyof typeof PATHS;

export function PixelIcon({ name, className = 'h-3.5 w-3.5' }: { name: PixelIconName; className?: string }) {
  return (
    <svg className={`shrink-0 ${className}`} viewBox="0 0 16 16" fill="currentColor" shapeRendering="crispEdges" aria-hidden="true">
      <path fillRule={name === 'pin' ? 'evenodd' : undefined} d={PATHS[name]} />
    </svg>
  );
}
