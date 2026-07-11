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
    setToday(new Date().toISOString().split('T')[0]);
  }, []);
  const inputRef = useRef<HTMLInputElement>(null);

  const boxCls = isDark
    ? 'border-gph-dark-line bg-gph-dark-card'
    : 'border-gray-200 bg-white';
  const labelCls = isDark ? 'text-gph-dark-muted' : 'text-gray-500';
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
        aria-label={label}
        value={value}
        min={min ?? today}
        onChange={(e) => onChange(e.target.value)}
        className={`text-sm font-semibold mt-1.5 bg-transparent outline-none cursor-pointer w-full ${valueCls}`}
      />
    </div>
  );
}
