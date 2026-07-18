'use client';

import { useState, useRef, useEffect } from 'react';
import { useTheme } from '@/contexts/ThemeContext';

export type GuestsValue = { adults: number; children: number; pets: number };

function Stepper({
  label,
  sub,
  value,
  min,
  max,
  onChange,
  isDark,
}: {
  label: string;
  sub: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
  isDark: boolean;
}) {
  const btnBase     = 'w-7 h-7 rounded-full border text-sm font-semibold flex items-center justify-center transition-colors';
  const btnActive   = isDark
    ? 'border-gph-dark-line text-gph-dark-ink hover:bg-gph-dark-linesoft'
    : 'border-gray-400 text-gray-600 hover:bg-gray-100';
  const btnDisabled = isDark
    ? 'border-gph-dark-linesoft text-gph-dark-muted/40 cursor-not-allowed'
    : 'border-gray-200 text-gray-300 cursor-not-allowed';

  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <div className="flex flex-col">
        <span className={`text-sm font-medium ${isDark ? 'text-gph-dark-ink' : 'text-gray-900'}`}>{label}</span>
        <span className={`text-xs ${isDark ? 'text-gph-dark-muted' : 'text-gray-400'}`}>{sub}</span>
      </div>
      <div className="flex items-center gap-3">
        <button
          onClick={() => onChange(value - 1)}
          disabled={value <= min}
          className={`${btnBase} ${value <= min ? btnDisabled : btnActive}`}
        >
          −
        </button>
        <span className={`w-4 text-center text-sm font-semibold ${isDark ? 'text-gph-dark-ink' : 'text-gray-900'}`}>
          {value}
        </span>
        <button
          onClick={() => onChange(value + 1)}
          disabled={value >= max}
          className={`${btnBase} ${value >= max ? btnDisabled : btnActive}`}
        >
          +
        </button>
      </div>
    </div>
  );
}

export function GuestsDropdown({
  value,
  onChange,
}: {
  value: GuestsValue;
  onChange: (v: GuestsValue) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { isDark } = useTheme();

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const total   = value.adults + value.children;
  const summary = `${value.adults} adult${value.adults !== 1 ? 's' : ''}${value.children > 0 ? `, ${value.children} child${value.children !== 1 ? 'ren' : ''}` : ''}`;

  const boxCls = isDark
    ? 'border-gph-dark-line bg-gph-dark-card'
    : 'border-gray-200 bg-white';
  const panelCls = isDark
    ? 'bg-gph-dark-card border-gph-dark-line shadow-xl'
    : 'bg-white border-gray-200 shadow-xl';

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className={`flex flex-col rounded-lg border px-3 py-2 text-left w-full focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:border-gray-900 transition-colors ${boxCls}`}
      >
        <span className={`text-[9.5px] font-bold font-mono uppercase tracking-widest leading-none ${isDark ? 'text-gph-dark-muted' : 'text-gray-600'}`}>
          Guests
        </span>
        <span className={`text-sm font-semibold mt-1.5 ${isDark ? 'text-gph-dark-ink' : 'text-gray-900'}`}>
          {summary}
        </span>
      </button>

      {open && (
        <div className={`absolute top-full right-0 z-50 mt-1 w-64 rounded-xl border p-3 ${panelCls}`}>
          <Stepper
            label="Adults"
            sub="Age 18+"
            value={value.adults}
            min={1}
            max={16}
            onChange={(v) => onChange({ ...value, adults: v })}
            isDark={isDark}
          />
          <div className={`border-t ${isDark ? 'border-gph-dark-line' : 'border-gray-100'}`} />
          <Stepper
            label="Children"
            sub="Ages 0–17"
            value={value.children}
            min={0}
            max={total < 16 ? 16 - value.adults : 0}
            onChange={(v) => onChange({ ...value, children: v })}
            isDark={isDark}
          />
          <div className={`border-t ${isDark ? 'border-gph-dark-line' : 'border-gray-100'}`} />
          <Stepper
            label="Pets"
            sub="Dogs, cats & more"
            value={value.pets}
            min={0}
            max={10}
            onChange={(v) => onChange({ ...value, pets: v })}
            isDark={isDark}
          />
        </div>
      )}
    </div>
  );
}
