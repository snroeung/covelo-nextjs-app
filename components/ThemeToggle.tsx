'use client';

import { useTheme } from '@/contexts/ThemeContext';

export function ThemeToggle() {
  const { isDark, toggleTheme } = useTheme();
  const borderCls     = isDark ? 'border-cv-blue-900' : 'border-cv-blue-300';
  const activeCls     = 'bg-cv-blue-600 text-white';
  const lightInactive = isDark ? 'bg-transparent text-cv-blue-300 hover:bg-cv-blue-900' : activeCls;
  const darkInactive  = isDark ? activeCls : 'bg-cv-blue-950 text-white hover:bg-cv-blue-900';

  return (
    <div className={`flex rounded-lg border overflow-hidden text-base font-medium ${borderCls}`}>
      <button
        onClick={() => isDark && toggleTheme()}
        className={`flex-1 flex items-center justify-center px-3 py-2 transition-colors ${lightInactive}`}
      >
        ☀️
      </button>
      <button
        onClick={() => !isDark && toggleTheme()}
        className={`flex-1 flex items-center justify-center px-3 py-2 transition-colors ${darkInactive}`}
      >
        🌙
      </button>
    </div>
  );
}
