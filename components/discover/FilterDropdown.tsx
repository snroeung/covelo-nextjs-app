'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { useScrollLock } from '@/hooks/useScrollLock';

export interface FilterDropdownOption<T extends string> {
  value: T;
  label: string;
  /** Right-aligned detail, e.g. a post count */
  hint?: string;
}

interface Props<T extends string> {
  label: string;
  options: FilterDropdownOption<T>[];
  value: T;
  onChange: (value: T) => void;
}

/**
 * A labelled filter pill. From md up its options open in a popover under the
 * pill; on a phone they open as a bottom sheet, portalled to <body> so a pill
 * inside a scrolling, masked row can neither clip nor fade it.
 */
export function FilterDropdown<T extends string>({ label, options, value, onChange }: Props<T>) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const isPhone = useMediaQuery('(max-width: 767px)');
  useScrollLock(open && isPhone);

  useEffect(() => {
    if (!open) return;
    // The phone sheet has its own backdrop; only the popover needs outside-click
    function handlePointer(e: PointerEvent) {
      if (isPhone) return;
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('pointerdown', handlePointer);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('pointerdown', handlePointer);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open, isPhone]);

  const current = options.find((o) => o.value === value) ?? options[0];

  const list = (
    <ul role="listbox" aria-label={label} className="max-h-[60dvh] md:max-h-80 overflow-y-auto overscroll-contain">
      {options.map((o) => (
        <li key={o.value} role="presentation">
          <button
            type="button"
            role="option"
            aria-selected={o.value === value}
            onClick={() => { onChange(o.value); setOpen(false); }}
            className={`w-full text-left px-4 md:px-3.5 min-h-12 md:min-h-11 flex items-center justify-between gap-3 text-sm font-semibold transition-colors ${
              o.value === value
                ? 'bg-gph-actionsoft text-gph-ink'
                : 'text-gph-ink hover:bg-gph-linesoft'
            }`}
          >
            <span className="min-w-0 truncate">{o.label}</span>
            {o.hint && <span className="shrink-0 font-mono text-[11px] text-gph-muted">{o.hint}</span>}
          </button>
        </li>
      ))}
    </ul>
  );

  // Flush wrapper + padding (never margin), so there is no dead gap under the pill
  const popover = (
    <div className="absolute top-full left-0 z-50 w-56 pt-1.5">
      <div className="rounded-xl border shadow-lg overflow-hidden bg-gph-card border-gph-line">{list}</div>
    </div>
  );

  // Backdrop is see-through and blurred — the page stays readable behind it
  const sheet = (
    <div className="fixed inset-0 z-[60] flex items-end" role="dialog" aria-modal="true" aria-label={label}>
      <div aria-hidden="true" className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setOpen(false)} />
      <div className="relative w-full rounded-t-2xl border-t shadow-lg overflow-hidden bg-gph-card border-gph-line pb-[env(safe-area-inset-bottom)]">
        <div className="flex items-center justify-between px-4 pt-3 pb-1">
          <span className="font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-gph-muted">{label}</span>
          <button type="button" onClick={() => setOpen(false)} aria-label={`Close ${label}`} className="grid min-h-11 min-w-11 place-items-center -mr-2 text-gph-muted">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
          </button>
        </div>
        {list}
      </div>
    </div>
  );

  return (
    <div className="relative shrink-0" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex items-center gap-1.5 min-h-11 px-3.5 rounded-full border text-xs font-bold whitespace-nowrap bg-gph-card border-gph-line text-gph-ink hover:bg-gph-linesoft transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gph-ink"
      >
        <span className="text-gph-muted font-semibold">{label}:</span>
        <span className="max-w-[8.5rem] truncate">{current?.label}</span>
        <svg
          width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true"
          className={`shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
        >
          <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (isPhone ? createPortal(sheet, document.body) : popover)}
    </div>
  );
}
