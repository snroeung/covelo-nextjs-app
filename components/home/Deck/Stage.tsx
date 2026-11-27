'use client';

import { clampTranslate, type DeckState, type Win } from './useDeckScript';
import { StageScreens } from './screens/StageScreens';

// Display-only recreation of an app screen, scaled to the container and framed
// by the camera. inert + aria-hidden + pointer-events:none — never focusable,
// never announced. The 1100×600 content shows through a window (`win`): 1100×600
// on desktop, 620×700 on mobile.
export function Stage({ state, win, url, containerW, id }: {
  state: DeckState; win: Win; url: string; containerW: number; id: string;
}) {
  const sc = Math.min((containerW || win.w) / win.w, 1.2);
  const { tx, ty, z } = clampTranslate(state.cam, win);

  return (
    <div
      style={{
        background: 'color-mix(in srgb, var(--gph-accent-green) 7%, var(--gph-bg))',
        padding: 24,
        borderRadius: 14,
      }}
    >
      <div style={{ position: 'relative', height: Math.round((win.h + 40) * sc) }}>
        <div
          className="cv-stage"
          inert
          aria-hidden="true"
          style={{
            pointerEvents: 'none',
            position: 'absolute',
            left: 0,
            top: 0,
            width: win.w,
            height: win.h + 40,
            transformOrigin: '0 0',
            transform: `scale(${sc.toFixed(4)})`,
            borderRadius: 14,
            overflow: 'hidden',
            background: 'var(--b-fff)',
            border: '1px solid var(--l-e3e3e1)',
            boxShadow: '0 18px 40px rgba(0,0,0,.10)',
            fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
            color: 'var(--c-111418)',
            textAlign: 'left',
          }}
        >
          {/* Browser chrome bar */}
          <div style={{ height: 40, display: 'flex', alignItems: 'center', gap: 7, padding: '0 16px', borderBottom: '1px solid var(--l-ececea)', background: 'var(--b-fff)' }}>
            <i style={{ width: 9, height: 9, borderRadius: '50%', background: 'var(--b-dcdcd8)' }} />
            <i style={{ width: 9, height: 9, borderRadius: '50%', background: 'var(--b-dcdcd8)' }} />
            <i style={{ width: 9, height: 9, borderRadius: '50%', background: 'var(--b-dcdcd8)' }} />
            <span className="m" style={{ marginLeft: 14, fontSize: 12, color: 'var(--c-4b5058)' }}>{url}</span>
          </div>
          {/* Content window + camera layer */}
          <div style={{ position: 'relative', height: win.h, overflow: 'hidden', background: 'var(--b-e4e6e9)' }}>
            <div style={{ width: 1100, height: 600, transformOrigin: '0 0', transition: 'transform .55s cubic-bezier(.2,.8,.2,1)', willChange: 'transform', transform: `translate(${tx.toFixed(1)}px,${ty.toFixed(1)}px) scale(${z})` }}>
              <StageScreens state={state} id={id} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
