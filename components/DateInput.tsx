'use client';

import { useRef } from 'react';
import { useTheme } from '@/contexts/ThemeContext';

const today = new Date().toISOString().split('T')[0];

export function DateInput({
  label,
  value,
  onChange,
  min = today,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  min?: string;
}) {
  const { isDark } = useTheme();
  const inputRef = useRef<HTMLInputElement>(null);

  const boxCls = isDark
    ? 'border-cv-blue-900 bg-cv-blue-950'
    : 'border-gray-200 bg-white';
  const labelCls = isDark ? 'text-cv-blue-400' : 'text-gray-400';
  const valueCls = isDark ? 'text-white scheme-dark' : 'text-gray-900 scheme-light';

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
        min={min}
        onChange={(e) => onChange(e.target.value)}
        className={`text-sm font-semibold mt-1.5 bg-transparent outline-none cursor-pointer w-full ${valueCls}`}
      />
    </div>
  );
}
