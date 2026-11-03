import type { ReactNode } from 'react';

export interface Option<T extends string> {
  value: T;
  label: string;
  /** Right-aligned detail: a count, a badge */
  trailing?: ReactNode;
}

/**
 * One-of-many list used inside popovers and bottom sheets. Rows are 48px on a phone and 44px from md up
 * (never under the 44px tap target). Callers own open/close: `onSelect` just reports the choice.
 */
export function OptionList<T extends string>({ label, options, value, onSelect, className = '' }: {
  label: string;
  options: Option<T>[];
  value: T;
  onSelect: (value: T) => void;
  className?: string;
}) {
  return (
    <ul role="listbox" aria-label={label} className={className}>
      {options.map((o) => (
        <li key={o.value} role="presentation">
          <button
            type="button"
            role="option"
            aria-selected={o.value === value}
            onClick={() => onSelect(o.value)}
            className={`flex min-h-12 w-full items-center justify-between gap-3 px-4 text-left text-sm font-semibold transition-colors md:min-h-11 md:px-3.5 ${
              o.value === value ? 'bg-gph-actionsoft text-gph-ink' : 'text-gph-ink hover:bg-gph-linesoft'
            }`}
          >
            <span className="min-w-0 truncate">{o.label}</span>
            {o.trailing}
          </button>
        </li>
      ))}
    </ul>
  );
}
