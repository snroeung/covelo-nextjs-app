'use client';

import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { BoardIcon } from './icons';

// Shared modal for the board: composer, report, offer details, topic list.
//
// Follows the app's modal rules — a see-through blurred backdrop (the page
// stays readable), fixed to the viewport — and adds what a dialog owes
// keyboard and screen-reader users: focus moves in, Tab stays inside, Escape
// closes, focus goes back to whatever opened it. On a phone it is a bottom
// sheet; from md up it is centred.

let openCount = 0;

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

interface Props {
  /** Accessible name; also the visible title when `title` is omitted */
  label: string;
  onClose: () => void;
  children: React.ReactNode;
  /** Panel width from md up */
  width?: 'sm' | 'md' | 'lg';
  /** Element to focus first; defaults to the first focusable control */
  initialFocus?: React.RefObject<HTMLElement | null>;
}

const WIDTH = { sm: 'md:max-w-[440px]', md: 'md:max-w-[520px]', lg: 'md:max-w-[640px]' } as const;

export function Dialog({ label, onClose, children, width = 'md', initialFocus }: Props) {
  const panel = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    openCount++;
    document.body.style.overflow = 'hidden';

    const first = initialFocus?.current ?? panel.current?.querySelector<HTMLElement>(FOCUSABLE) ?? panel.current;
    first?.focus();

    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (e.key !== 'Tab' || !panel.current) return;
      const items = [...panel.current.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.offsetParent !== null);
      if (items.length === 0) { e.preventDefault(); return; }
      const firstEl = items[0], lastEl = items[items.length - 1];
      if (e.shiftKey && (document.activeElement === firstEl || document.activeElement === panel.current)) { e.preventDefault(); lastEl.focus(); }
      else if (!e.shiftKey && document.activeElement === lastEl) { e.preventDefault(); firstEl.focus(); }
    }
    document.addEventListener('keydown', onKey);

    return () => {
      document.removeEventListener('keydown', onKey);
      if (--openCount === 0) document.body.style.overflow = '';
      opener?.focus?.();
    };
    // Focus and scroll lock are set up once per mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (typeof document === 'undefined') return null;
  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-end justify-center md:items-center md:p-4">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onMouseDown={() => onCloseRef.current()} aria-hidden="true" />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        className={`relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-2xl border border-gph-line bg-gph-card text-gph-ink shadow-2xl outline-none md:max-h-[90dvh] md:rounded-xl ${WIDTH[width]}`}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}

export function DialogHeader({ title, kicker, onClose }: { title: string; kicker?: string; onClose: () => void }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-gph-line px-5 py-3">
      <div className="min-w-0 pt-1.5">
        {kicker && <div className="mb-0.5 font-mono text-[10px] font-extrabold tracking-[0.12em] text-gph-muted">{kicker}</div>}
        <h2 className="text-base font-extrabold leading-tight tracking-tight text-gph-ink">{title}</h2>
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="grid min-h-11 min-w-11 shrink-0 place-items-center rounded-full text-gph-muted hover:bg-gph-linesoft hover:text-gph-ink focus-visible:outline-2 focus-visible:outline-gph-ink"
      >
        <BoardIcon name="x" size={16} />
      </button>
    </div>
  );
}

/** The scrolling middle of a dialog. */
export function DialogBody({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`flex-1 overflow-y-auto px-5 py-4 ${className}`}>{children}</div>;
}

export function DialogFooter({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap items-center justify-end gap-2 border-t border-gph-line bg-gph-bg px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">{children}</div>;
}
