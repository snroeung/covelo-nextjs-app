'use client';

import { useState } from 'react';

/**
 * Animated covelo wordmark: a pixel globe flies in on a plane, settles, shrinks
 * to the baseline dot, then the letters rise in. Timings live in globals.css
 * (`.cv-logo-mark`). Clicking replays by remounting the SVG (key bump).
 * Reduced motion: everything visible, no animation (globals.css guard).
 */
export function LogoAnimation({ size = 150 }: { size?: number }) {
  const [playKey, setPlayKey] = useState(0);

  return (
    <button
      type="button"
      onClick={() => setPlayKey((k) => k + 1)}
      aria-label="Replay the covelo logo animation"
      title="Replay"
      style={{ border: 0, background: 'transparent', padding: 0, cursor: 'pointer', color: 'var(--gph-ink)', font: 'inherit' }}
    >
      <span key={playKey} className="cv-logo-mark" style={{ fontSize: size }}>
        <span className="cv-letters">
          <span>c</span><span>o</span><span>v</span><span>e</span><span>l</span><span>o</span>
        </span>
        <svg className="cv-globe" viewBox="0 0 16 16" shapeRendering="crispEdges" aria-hidden="true">
          <defs>
            <clipPath id="cv-lm-earth">
              <path d="M6 0h4v1h3v2h2v3h1v4h-1v3h-2v2h-3v1H6v-1H3v-2H1v-3H0V6h1V3h2V1h3z" />
            </clipPath>
            <path id="cv-lm-flight" d="M1 14 C5 10 10 5 16 0" />
          </defs>
          <path fill="var(--cv-ocean)" d="M6 0h4v1h3v2h2v3h1v4h-1v3h-2v2h-3v1H6v-1H3v-2H1v-3H0V6h1V3h2V1h3z" />
          <g clipPath="url(#cv-lm-earth)" fill="var(--gph-accent-green)">
            <path d="M3 2h3v1h2v1h1v2H8v1H7v2H6v2H5v2H4v-2H3v-2H2V6h1V4h1z" />
            <path d="M8 5h2v1h2v2h-1v1h-1v2H9v2H8v-2H7v-2H6V8h1V6h1z" />
            <path d="M10 3h2v1h2v2h1v2h-2v1h-1V8h-2V7H9V5h1z" />
            <path d="M11 10h2v1h1v2h-1v2h-2v-1h-1v-2h1zM4 14h1v1H4z" />
          </g>
          <path
            d="M1 14 C5 10 10 5 16 0"
            fill="none"
            stroke="var(--cv-smoke)"
            strokeWidth=".7"
            strokeLinecap="round"
            opacity=".32"
            strokeDasharray="22"
            strokeDashoffset="22"
          >
            <animate attributeName="stroke-dashoffset" from="22" to="0" dur="1.5s" begin=".15s" fill="freeze" />
          </path>
          <g opacity="0">
            <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;.08;.68;1" dur="1.5s" begin=".15s" fill="freeze" />
            <animateMotion dur="1.5s" begin=".15s" rotate="auto" fill="freeze">
              <mpath href="#cv-lm-flight" />
            </animateMotion>
            <path
              fill="var(--cv-plane)"
              d="M-.7-.45h2.1l.65-1.8.5.15-.2 1.65h1.8c.35 0 .55.15.55.4s-.2.4-.55.4h-1.8l.2 1.65-.5.15-.65-1.8H-.7z"
              transform="scale(.82)"
            />
          </g>
        </svg>
      </span>
    </button>
  );
}
