'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useScrollLock } from '@/hooks/useScrollLock';

/**
 * Phone-only sheet that rises from the bottom over a dimmed, blurred page (the page stays readable).
 * Portalled to <body> so a scrolling or masked parent can't clip it. Callers render it only for
 * small screens (e.g. inside an `md:hidden` trigger) — it has no desktop layout of its own.
 */
export function BottomSheet({ open, onClose, label, footer, children }: {
  open: boolean;
  onClose: () => void;
  label: string;
  /** Pinned under the scrolling body, e.g. a primary "Show results" button */
  footer?: ReactNode;
  children: ReactNode;
}) {
  useScrollLock(open);
  const closeRef = useRef<HTMLButtonElement>(null);
  // Callers pass inline handlers; keep the latest in a ref so re-renders don't re-run the focus effect
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; });

  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onCloseRef.current();
    }
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      prev?.focus?.();
    };
  }, [open]);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-end" role="dialog" aria-modal="true" aria-label={label}>
      <div aria-hidden="true" className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative flex max-h-[85dvh] w-full flex-col overflow-hidden rounded-t-2xl border-t border-gph-line bg-gph-card shadow-lg">
        <div aria-hidden="true" className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-gph-line" />
        <div className="flex shrink-0 items-center justify-between px-4 pt-1">
          <h2 className="font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-gph-muted">{label}</h2>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label={`Close ${label}`}
            className="-mr-2 grid min-h-11 min-w-11 place-items-center text-gph-muted focus-visible:outline-2 focus-visible:outline-gph-ink"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-4 pt-1">{children}</div>
        {footer && <div className="shrink-0 border-t border-gph-line px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}
