'use client';

import { useEffect, useRef, useState } from 'react';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { CHAPTERS } from './steps';
import { useDeckScript } from './useDeckScript';
import { Stage } from './Stage';

const two = (n: number) => String(n + 1).padStart(2, '0');

const IBTN = 'flex h-11 w-11 items-center justify-center rounded-[10px] border border-gph-line bg-gph-card text-gph-ink';

/**
 * Auto-playing product walkthrough. The chrome (header, progress, controls) is
 * interactive; the Stage is display-only. Starts paused on step 1 and begins
 * playing when the deck is ≥35% visible AND the intro is gone (`active`).
 */
export function Deck({ active }: { active: boolean }) {
  const mobile = useMediaQuery('(max-width: 640px)');
  const deck = useDeckScript({ mobile });
  const { state, win } = deck;

  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [containerW, setContainerW] = useState(0);
  const [visible, setVisible] = useState(false);

  // Measure the stage container width (scale) + watch visibility (autoplay gate).
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver((es) => {
      const w = es[0].contentRect.width;
      setContainerW((prev) => (Math.abs(w - prev) > 1 ? w : prev));
    });
    ro.observe(el);
    const io = new IntersectionObserver((es) => setVisible(es[0].isIntersecting), { threshold: 0.35 });
    io.observe(el);
    return () => { ro.disconnect(); io.disconnect(); };
  }, []);

  // Begin playing once the deck is in view and the intro is gone.
  useEffect(() => {
    if (active && visible) deck.play();
  }, [active, visible, deck]);

  const chap = CHAPTERS[state.ch];
  const step = chap.steps[state.st];

  return (
    <section id="walkthrough" className="mx-auto max-w-[1280px] px-6 pt-14" style={{ scrollSnapAlign: 'start' }}>
      <div className="overflow-hidden rounded-[14px] border border-gph-line bg-gph-card">
        {/* Step header */}
        <div className="flex flex-col gap-3.5 border-b border-gph-line px-6 pt-5 pb-3.5">
          <div>
            <div className="flex items-center gap-2.5 font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-gph-muted">
              <span className="text-gph-ink">STEP {two(state.st)} / {two(chap.steps.length - 1)}</span>
              <span>{chap.name.toUpperCase()}</span>
            </div>
            <h2 aria-live="polite" className="mt-2 text-[30px] font-extrabold leading-[1.1] tracking-[-0.03em] text-gph-ink">{step.title}</h2>
            <p className="mt-2 max-w-[640px] text-[15px] leading-[1.55] text-gph-muted">{step.body}</p>
          </div>
          {/* Segmented progress */}
          <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${chap.steps.length}, minmax(0, 1fr))` }}>
            {chap.steps.map((s, i) => {
              const fill =
                i < state.st ? { width: '100%' }
                : i === state.st
                  ? (state.auto
                    ? { width: 0, animation: `${state.seq % 2 ? 'cv-fillA' : 'cv-fillB'} ${s.dur}ms linear forwards` }
                    : { width: '100%' })
                  : { width: 0 };
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => deck.jumpStep(i)}
                  aria-current={i === state.st ? 'step' : undefined}
                  aria-label={`Step ${i + 1}: ${s.label}`}
                  className="flex min-h-11 flex-col gap-[7px] text-left"
                >
                  <span className="relative block h-[3px] w-full overflow-hidden bg-gph-line">
                    <span className="absolute left-0 top-0 bottom-0 bg-gph-ink" style={fill} />
                  </span>
                  <span className={`font-mono text-[10px] font-bold uppercase tracking-[0.08em] ${i === state.st ? 'text-gph-ink' : 'text-gph-muted'}`}>{s.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Stage */}
        <div ref={wrapRef}>
          <Stage state={state} win={win} url={step.url} containerW={containerW} id={step.id} />
        </div>
      </div>

      {/* Hint line */}
      <p className="mt-3 text-center font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-gph-muted">
        {state.auto ? 'Playing · sample data' : 'Paused · use the arrows · sample data'}
      </p>

      {/* Controls */}
      <div
        className="mt-3.5 flex items-center justify-between gap-2.5"
        style={{ scrollSnapAlign: 'end', scrollMarginBottom: 20 }}
      >
        <button type="button" onClick={deck.prev} aria-label="Previous step" className={IBTN}>
          <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor" style={{ shapeRendering: 'crispEdges' }}><path d="M9 2h2v2H9zM7 4h2v2H7zM5 6h2v4H5zM7 10h2v2H7zM9 12h2v2H9z" /></svg>
        </button>
        <div className="flex min-w-0 items-center gap-2">
          <div className="flex gap-0.5 rounded-[9px] border border-gph-line bg-gph-bg p-[3px]">
            {CHAPTERS.map((c, i) => {
              const activeCh = i === state.ch;
              return (
                <button
                  key={c.short}
                  type="button"
                  onClick={() => deck.pickChapter(i)}
                  aria-pressed={activeCh}
                  className={`min-h-[38px] rounded-[7px] px-4 text-[12px] font-bold ${activeCh ? 'bg-gph-card text-gph-ink shadow-sm' : 'bg-transparent text-gph-muted'}`}
                >
                  {c.short}
                </button>
              );
            })}
          </div>
          <button type="button" onClick={deck.toggle} aria-label={state.auto ? 'Pause walkthrough' : 'Play walkthrough'} className={IBTN}>
            {state.auto
              ? <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor" style={{ shapeRendering: 'crispEdges' }}><path d="M4 2h3v12H4zM9 2h3v12H9z" /></svg>
              : <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor" style={{ shapeRendering: 'crispEdges' }}><path d="M4 2h2v12H4zM6 3h2v10H6zM8 4h2v8H8zM10 5h2v6h-2z" /></svg>}
          </button>
        </div>
        <button type="button" onClick={deck.next} aria-label="Next step" className={IBTN}>
          <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor" style={{ shapeRendering: 'crispEdges' }}><path d="M5 2h2v2H5zM7 4h2v2H7zM9 6h2v4H9zM7 10h2v2H7zM5 12h2v2H5z" /></svg>
        </button>
      </div>
    </section>
  );
}
