'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
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
  /** Adds a search box above the options that filters as you type */
  searchPlaceholder?: string;
}

/**
 * A labelled filter pill. From md up its options open in a popover under the
 * pill; on a phone they open as a bottom sheet, portalled to <body> so a pill
 * inside a scrolling, masked row can neither clip nor fade it.
 */
export function FilterDropdown<T extends string>({ label, options, value, onChange, searchPlaceholder }: Props<T>) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(-1);
  const searchRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const ref = useRef<HTMLDivElement>(null);
  const isPhone = useMediaQuery('(max-width: 767px)');

  const close = () => { setOpen(false); setQuery(''); setActive(-1); };

  useEffect(() => {
    if (!open) return;
    // The phone sheet has its own backdrop and Escape handling; only the popover needs these
    function handlePointer(e: PointerEvent) {
      if (isPhone) return;
      if (ref.current && !ref.current.contains(e.target as Node)) close();
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') close();
    }
    document.addEventListener('pointerdown', handlePointer);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('pointerdown', handlePointer);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open, isPhone]);

  const current = options.find((o) => o.value === value) ?? options[0];

  // Label starts-with first, then a word that starts with it, then contains
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    const rank = (l: string) => (l.startsWith(q) ? 0 : l.split(/[\s·-]+/).some((w) => w.startsWith(q)) ? 1 : 2);
    return options
      .filter((o) => o.label.toLowerCase().includes(q))
      .sort((a, b) => rank(a.label.toLowerCase()) - rank(b.label.toLowerCase()));
  }, [options, query]);

  // Desktop focuses the box on open; on a phone the sheet keeps focus so the keyboard doesn't cover the list
  useEffect(() => {
    if (open && !isPhone && searchPlaceholder) searchRef.current?.focus();
  }, [open, isPhone, searchPlaceholder]);
  useEffect(() => {
    if (active >= 0) document.getElementById(`${listId}-${active}`)?.scrollIntoView({ block: 'nearest' });
  }, [active, listId]);

  function choose(v: T) { onChange(v); close(); }
  function onSearchKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, shown.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
    else if (e.key === 'Enter') {
      e.preventDefault();
      const pick = shown[active >= 0 ? active : query.trim() ? 0 : -1];
      if (pick) choose(pick.value);
    } else if (e.key === 'Escape' && query) {
      // Escape clears the box first; the next one closes the list
      e.stopPropagation();
      setQuery(''); setActive(-1);
    }
  }

  const optionList = (
    <>
      {searchPlaceholder && (
        <div className="border-b border-gph-line p-2">
          <input
            ref={searchRef}
            type="text"
            role="combobox"
            aria-label={`Search ${label.toLowerCase()}`}
            aria-expanded="true"
            aria-controls={`${listId}-list`}
            aria-autocomplete="list"
            aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
            autoComplete="off"
            value={query}
            placeholder={searchPlaceholder}
            onChange={(e) => { setQuery(e.target.value); setActive(e.target.value.trim() ? 0 : -1); }}
            onKeyDown={onSearchKey}
            className="min-h-11 w-full rounded-lg border border-gph-line bg-gph-card px-3 text-base text-gph-ink placeholder:text-gph-muted focus:border-gph-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-gph-ink/20 md:text-[13.5px]"
          />
        </div>
      )}
      {shown.length === 0 && <p role="status" className="px-4 py-3 text-sm text-gph-muted">No {label.toLowerCase()} matches &ldquo;{query.trim()}&rdquo;</p>}
    <OptionList
      label={label}
      idPrefix={searchPlaceholder ? listId : undefined}
      activeValue={active >= 0 ? shown[active]?.value : undefined}
      options={shown.map((o) => ({
        value: o.value,
        label: o.label,
        trailing: o.hint ? <span className="shrink-0 font-mono text-[11px] text-gph-muted">{o.hint}</span> : undefined,
      }))}
      value={value}
      onSelect={choose}
      className={`max-h-[60dvh] md:max-h-80 overflow-y-auto overscroll-contain ${shown.length === 0 ? 'hidden' : ''}`}
    />
    </>
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
        onClick={() => (open ? close() : setOpen(true))}
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
