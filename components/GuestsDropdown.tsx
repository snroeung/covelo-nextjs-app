'use client';

import { useState, useRef, useEffect } from 'react';
import { useTheme } from '@/contexts/ThemeContext';

export type GuestsValue = { adults: number; children: number };

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
  const btnBase = `w-7 h-7 rounded-full border text-sm font-semibold flex items-center justify-center transition-colors`;
  const btnActive = isDark
    ? 'border-cv-blue-600 text-cv-blue-300 hover:bg-cv-blue-800'
    : 'border-cv-blue-500 text-cv-blue-600 hover:bg-cv-blue-100';
  const btnDisabled = isDark ? 'border-cv-blue-900 text-cv-blue-700 cursor-not-allowed' : 'border-cv-blue-100 text-cv-blue-300 cursor-not-allowed';
  const textCls = isDark ? 'text-white' : 'text-cv-blue-950';
  const subCls = isDark ? 'text-cv-blue-400' : 'text-cv-blue-400';

  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <div className="flex flex-col">
        <span className={`text-sm font-medium ${textCls}`}>{label}</span>
        <span className={`text-xs ${subCls}`}>{sub}</span>
      </div>
      <div className="flex items-center gap-3">
        <button
          onClick={() => onChange(value - 1)}
          disabled={value <= min}
          className={`${btnBase} ${value <= min ? btnDisabled : btnActive}`}
        >
          −
        </button>
        <span className={`w-4 text-center text-sm font-semibold ${textCls}`}>{value}</span>
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

  const total = value.adults + value.children;
  const summary = `${value.adults} adult${value.adults !== 1 ? 's' : ''}${value.children > 0 ? `, ${value.children} child${value.children !== 1 ? 'ren' : ''}` : ''}`;

  const labelCls = isDark ? 'text-cv-blue-300' : 'text-cv-blue-900';
  const inputCls = isDark
    ? 'border-cv-blue-900 bg-cv-blue-950 text-white'
    : 'border-cv-blue-100 bg-white text-cv-blue-950';
  const panelCls = isDark
    ? 'bg-cv-blue-950 border-cv-blue-800 shadow-xl'
    : 'bg-white border-cv-blue-100 shadow-xl';
  const dividerCls = isDark ? 'border-cv-blue-800' : 'border-cv-blue-100';

  return (
    <div className="relative flex flex-col gap-0.5" ref={ref}>
      <span className={`text-[10px] font-semibold uppercase tracking-widest px-1 ${labelCls}`}>
        Guests
      </span>
      <button
        onClick={() => setOpen((o) => !o)}
        className={`rounded-lg border px-3 py-2 text-sm text-left focus:outline-none focus:ring-2 focus:ring-cv-blue-600 ${inputCls}`}
      >
        {summary}
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
          <div className={`border-t ${dividerCls}`} />
          <Stepper
            label="Children"
            sub="Ages 0–17"
            value={value.children}
            min={0}
            max={total < 16 ? 16 - value.adults : 0}
            onChange={(v) => onChange({ ...value, children: v })}
            isDark={isDark}
          />
        </div>
      )}
    </div>
  );
}
