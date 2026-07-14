'use client';

import { useEffect, useRef, useState } from 'react';
import { useTheme } from '@/contexts/ThemeContext';

export function DateInput({
  label,
  value,
  onChange,
  min,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  min?: string;
}) {
  const { isDark } = useTheme();
  const [today, setToday] = useState<string | undefined>(undefined);

  useEffect(() => {
    // Deliberately not a lazy useState initializer: SSR can't know "today"
    // in the client's timezone, so the first client render must match the
    // SSR'd `undefined` exactly to avoid a hydration mismatch on the
    // input's `min` attribute. Syncing one tick later is the tradeoff.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setToday(new Date().toISOString().split('T')[0]);
  }, []);
  const inputRef = useRef<HTMLInputElement>(null);

  const boxCls = isDark
    ? 'border-gph-dark-line bg-gph-dark-card'
    : 'border-gray-200 bg-white';
  const labelCls = isDark ? 'text-gph-dark-muted' : 'text-gray-400';
  const valueCls = isDark ? 'text-gph-dark-ink scheme-dark' : 'text-gray-900 scheme-light';

  return (
    <div
      onClick={() => inputRef.current?.showPicker?.()}
      className={`flex flex-col rounded-lg border px-3 py-2 cursor-pointer focus-within:ring-2 focus-within:border-gray-900 focus-within:ring-gray-900/20 transition-colors ${boxCls}`}
    >
      <span className={`text-[9.5px] font-bold font-mono uppercase tracking-widest leading-none ${labelCls}`}>
        {label}
      </span>
      <input
        ref={inputRef}
        type="date"
        value={value}
        min={min ?? today}
        onChange={(e) => onChange(e.target.value)}
        className={`text-sm font-semibold mt-1.5 bg-transparent outline-none cursor-pointer w-full ${valueCls}`}
      />
    </div>
  );
}
