import type { CSSProperties, ReactNode } from 'react';

/** Gradient shimmer block. Size it with `className` (h-*, w-*, rounded-*). */
export function Shimmer({ className = '', style }: { className?: string; style?: CSSProperties }) {
  return <div className={`cv-sk ${className}`} style={style} aria-hidden="true" />;
}

/** Stepped square spinner. Colour follows `currentColor`, so it works on any fill. */
export function PixelSpinner({ className = '' }: { className?: string }) {
  return <span className={`cv-pxspin ${className}`} aria-hidden="true" />;
}

/** 2–4 mono lines taking turns in one slot. Decorative: pair with a `LoadingRegion` label for screen readers. */
export function StatusCycle({ lines, className = '' }: { lines: string[]; className?: string }) {
  const n = Math.min(lines.length, 4);
  const variant = n === 2 ? 'cv-cyc-2' : n === 3 ? 'cv-cyc-3' : '';
  return (
    <div className={`cv-cyc ${variant} ${className}`} aria-hidden="true">
      {lines.slice(0, 4).map((line) => (
        <span key={line}><i className="cv-dot" />{line.toUpperCase()}</span>
      ))}
    </div>
  );
}

/** Fades a skeleton block in on a stagger. `i` is its position (0–3). */
export function Stagger({ i = 0, className = '', children }: { i?: number; className?: string; children: ReactNode }) {
  return <div className={`cv-stg ${i ? `cv-stg-${Math.min(i, 3)}` : ''} ${className}`} aria-hidden="true">{children}</div>;
}

/** Status wrapper: announces `label` once; everything inside is decorative. */
export function LoadingRegion({ label, className = '', children }: { label: string; className?: string; children: ReactNode }) {
  return (
    <div role="status" aria-live="polite" className={className}>
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}
