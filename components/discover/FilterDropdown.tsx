'use client';

import { useEffect, useRef, useState } from 'react';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { OptionList } from '@/components/ui/OptionList';

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

  useEffect(() => {
    if (!open) return;
    // The phone sheet has its own backdrop and Escape handling; only the popover needs these
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

  const close = () => setOpen(false);
  const optionList = (
    <OptionList
      label={label}
      options={options.map((o) => ({
        value: o.value,
        label: o.label,
        trailing: o.hint ? <span className="shrink-0 font-mono text-[11px] text-gph-muted">{o.hint}</span> : undefined,
      }))}
      value={value}
      onSelect={(v) => { onChange(v); close(); }}
      className="max-h-[60dvh] md:max-h-80 overflow-y-auto overscroll-contain"
    />
  );

  // Flush wrapper + padding (never margin), so there is no dead gap under the pill
  const popover = (
    <div className="absolute top-full left-0 z-50 w-56 pt-1.5">
      <div className="rounded-xl border shadow-lg overflow-hidden bg-gph-card border-gph-line">{optionList}</div>
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

      {open && !isPhone && popover}
      <BottomSheet open={open && isPhone} onClose={close} label={label}>
        <div className="-mx-4 -my-1">{optionList}</div>
      </BottomSheet>
    </div>
  );
}
