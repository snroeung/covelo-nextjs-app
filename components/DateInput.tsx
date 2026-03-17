'use client';

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
  return (
    <div className="flex flex-col gap-0.5">
      <label className={`text-[10px] font-semibold uppercase tracking-widest px-1 ${isDark ? 'text-cv-blue-300' : 'text-cv-blue-900'}`}>
        {label}
      </label>
      <input
        type="date"
        value={value}
        min={min}
        onChange={(e) => onChange(e.target.value)}
        className={`rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cv-blue-600 ${
          isDark
            ? 'border-cv-blue-900 bg-cv-blue-950 text-white scheme-dark'
            : 'border-cv-blue-100 bg-white text-cv-blue-950 scheme-light'
        }`}
      />
    </div>
  );
}
