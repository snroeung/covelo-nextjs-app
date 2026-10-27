'use client';

import { useEffect, useId, useRef, useState } from 'react';

interface Props {
  options: Array<{ id: string; name: string }>;
  /** Selected topic ids; the first is the post's primary topic */
  value: string[];
  onChange: (next: string[]) => void;
  max?: number;
  isDark: boolean;
  /** Same classes the editor's other inputs use, so the trigger matches them */
  inputClassName: string;
}

/**
 * A dropdown of checkboxes: pick up to `max` topics. Selected ones also show
 * as removable chips underneath. Closes on Escape or a click outside, and the
 * list is reachable by keyboard (Tab through the checkboxes).
 */
export function TopicMultiSelect({ options, value, onChange, max = 5, isDark, inputClassName }: Props) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const listId = useId();
  const nameOf = (id: string) => options.find((o) => o.id === id)?.name ?? 'Unknown topic';

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);

  const toggle = (id: string) =>
    onChange(value.includes(id) ? value.filter((v) => v !== id) : value.length < max ? [...value, id] : value);

  const muted = isDark ? 'text-gph-dark-muted' : 'text-gray-500';
  const panel = isDark ? 'bg-gph-dark-card border-gph-dark-line' : 'bg-white border-gray-200';
  const chip = isDark ? 'bg-gph-dark-linesoft text-gph-dark-ink' : 'bg-gray-100 text-gray-800';

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((v) => !v)}
        className={`${inputClassName} flex min-h-11 items-center justify-between text-left`}
      >
        <span>{value.length === 0 ? 'Select topics…' : `${value.length} of ${max} topics selected`}</span>
        <svg aria-hidden="true" className={`size-4 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          <path d="m4 6 4 4 4-4" />
        </svg>
      </button>

      {open && (
        <div id={listId} role="listbox" aria-multiselectable="true" aria-label="Topics" className={`absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border p-1 shadow-lg ${panel}`}>
          {options.map((o) => {
            const on = value.includes(o.id);
            const full = !on && value.length >= max;
            return (
              <label key={o.id} role="option" aria-selected={on} className={`flex min-h-11 items-center gap-3 rounded-md px-3 text-sm ${full ? 'opacity-50' : 'cursor-pointer hover:bg-black/5'}`}>
                <input type="checkbox" checked={on} disabled={full} onChange={() => toggle(o.id)} className="size-4" />
                {o.name}
              </label>
            );
          })}
          {options.length === 0 && <p className={`px-3 py-3 text-sm ${muted}`}>No topics available.</p>}
        </div>
      )}

      {value.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-1.5" aria-label="Selected topics">
          {value.map((id, i) => (
            <li key={id} className={`inline-flex items-center gap-1 rounded-full py-0.5 pl-2.5 pr-1 text-xs font-semibold ${chip}`}>
              {nameOf(id)}{i === 0 && <span className={`font-mono text-[9px] ${isDark ? 'text-gph-dark-muted' : 'text-gray-600'}`}> · PRIMARY</span>}
              <button type="button" aria-label={`Remove ${nameOf(id)}`} onClick={() => toggle(id)} className="flex min-h-6 min-w-6 items-center justify-center rounded-full hover:bg-black/10">×</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
