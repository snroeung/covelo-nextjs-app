'use client';

import { useEffect, useRef, useState } from 'react';

export interface FilterDropdownOption<T extends string> {
  value: T;
  label: string;
}

interface Props<T extends string> {
  label: string;
  options: FilterDropdownOption<T>[];
  value: T;
  onChange: (value: T) => void;
}

export function FilterDropdown<T extends string>({ label, options, value, onChange }: Props<T>) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const current = options.find((o) => o.value === value) ?? options[0];

  return (
    <div className="relative shrink-0" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex items-center gap-1.5 min-h-11 px-3.5 rounded-full border text-xs font-bold whitespace-nowrap bg-gph-card border-gph-line text-gph-ink hover:bg-gph-linesoft transition-colors"
      >
        <span className="text-gph-muted font-semibold">{label}:</span>
        <span>{current?.label}</span>
        <svg
          width="10" height="10" viewBox="0 0 10 10" fill="none"
          className={`transition-transform ${open ? 'rotate-180' : ''}`}
        >
          <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1.5 z-50 w-48">
          <ul
            role="listbox"
            aria-label={label}
            className="rounded-xl border shadow-lg overflow-hidden bg-gph-card border-gph-line"
          >
            {options.map((o) => (
              <li key={o.value}>
                <button
                  type="button"
                  role="option"
                  aria-selected={o.value === value}
                  onClick={() => { onChange(o.value); setOpen(false); }}
                  className={`w-full text-left px-3.5 min-h-11 flex items-center text-sm font-semibold transition-colors ${
                    o.value === value
                      ? 'bg-gph-actionsoft text-gph-ink'
                      : 'text-gph-ink hover:bg-gph-linesoft'
                  }`}
                >
                  {o.label}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
