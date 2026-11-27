'use client';

import { useEffect, useRef, useState } from 'react';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { LogoAnimation } from '@/components/home/LogoAnimation';

/**
 * Full-screen intro overlay. The logo animation plays, then the screen can be
 * "dragged" up (wheel / touch / down-arrow) to leave. Past 150px it slides off
 * and calls onDismiss; under 150px it springs back. Input is ignored until the
 * animation finishes at 2.7s (immediate under reduced motion). Scroll is locked
 * while it is up. Carries the commission/FTC disclosure at the bottom.
 */
export function IntroScreen({ onDismiss }: { onDismiss: () => void }) {
  const reduce = useMediaQuery('(prefers-reduced-motion: reduce)');
  const isMobile = useMediaQuery('(max-width: 640px)');

  const [ready, setReady]       = useState(false);
  const [drag, setDrag]         = useState(0);
  const [dragging, setDragging] = useState(false);
  const [leaving, setLeaving]   = useState(false);

  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchY = useRef<number | null>(null);

  // Input gate: ready after the 2.7s animation (immediate under reduced motion).
  useEffect(() => {
    const t = setTimeout(() => setReady(true), reduce ? 0 : 2700);
    return () => clearTimeout(t);
  }, [reduce]);

  // Lock background scroll while the intro is mounted.
  useEffect(() => {
    const root = document.documentElement;
    const prevRoot = root.style.overflow;
    const prevBody = document.body.style.overflow;
    root.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    return () => {
      root.style.overflow = prevRoot;
      document.body.style.overflow = prevBody;
    };
  }, []);

  useEffect(() => () => {
    if (idleTimer.current) clearTimeout(idleTimer.current);
    if (leaveTimer.current) clearTimeout(leaveTimer.current);
  }, []);

  function dismiss() {
    if (!ready || leaving) return;
    if (idleTimer.current) clearTimeout(idleTimer.current);
    setLeaving(true);
    setDragging(false);
    leaveTimer.current = setTimeout(onDismiss, reduce ? 0 : 650);
  }

  function dragBy(dy: number) {
    if (!ready || leaving) return;
    // Rubber-band: the further it is pulled, the harder it resists.
    setDrag((prev) => {
      const d = Math.max(0, prev + dy * (1 - Math.min(prev, 300) / 420));
      if (d > 150) {
        // schedule dismiss outside the updater
        queueMicrotask(dismiss);
        return d;
      }
      if (idleTimer.current) clearTimeout(idleTimer.current);
      idleTimer.current = setTimeout(() => {
        setLeaving((lv) => {
          if (!lv) {
            setDrag(0);
            setDragging(false);
          }
          return lv;
        });
      }, 180);
      return d;
    });
    setDragging(true);
  }

  const transform =
    leaving ? 'translateY(-100%)'
    : dragging ? `translateY(${(-drag).toFixed(1)}px)`
    : 'translateY(0)';
  const transition =
    leaving ? 'transform .65s cubic-bezier(.7,0,.2,1)'
    : dragging ? 'transform .06s linear'
    : 'transform .45s cubic-bezier(.2,1.4,.4,1)';

  return (
    <section
      aria-label="Covelo intro. Scroll or press the down arrow to continue."
      tabIndex={0}
      onWheel={(e) => { if (e.deltaY > 0) dragBy(e.deltaY); }}
      onTouchStart={(e) => { touchY.current = e.touches[0].clientY; }}
      onTouchMove={(e) => {
        const y = e.touches[0].clientY;
        const dy = (touchY.current ?? y) - y;
        touchY.current = y;
        if (dy > 0) dragBy(dy * 1.4);
      }}
      onKeyDown={(e) => {
        if (['ArrowDown', 'PageDown', ' ', 'Enter'].includes(e.key)) {
          e.preventDefault();
          dismiss();
        }
      }}
      className="fixed inset-0 z-[80] flex items-center justify-center overflow-hidden bg-gph-bg outline-none"
      style={{ height: '100dvh', transform, transition, boxShadow: dragging ? '0 30px 60px rgba(0,0,0,.18)' : undefined }}
    >
      <LogoAnimation size={isMobile ? 72 : 150} />

      {/* Bottom stack: scroll cue + commission / FTC disclosure */}
      <div className="absolute inset-x-0 bottom-0 flex flex-col items-center gap-3 px-6 pb-[calc(24px+env(safe-area-inset-bottom))]">
        <button
          type="button"
          onClick={dismiss}
          className="cv-scroll-cue flex min-h-11 flex-col items-center gap-2 text-gph-muted"
          aria-label="Scroll to continue"
        >
          <span className="font-mono text-[10px] font-bold uppercase tracking-[0.08em]">Scroll to continue</span>
          <svg className="cv-chev" viewBox="0 0 16 16" width="18" height="18" style={{ fill: 'var(--gph-ink)', shapeRendering: 'crispEdges' }} aria-hidden="true">
            <path d="M3 5h2v2h2v2h2V7h2V5h2v2h-2v2h-2v2H7V9H5V7H3z" />
          </svg>
        </button>
        <p className="max-w-2xl text-center text-[11px] leading-relaxed text-gph-muted">
          Covelo may earn a commission when you book through some partner links. Points values are our own estimates
          (<span className="font-mono">~est.</span>), not offers — prices, award rates and availability change. Verify
          every price with the airline, hotel or card portal before you book.
        </p>
      </div>
    </section>
  );
}
