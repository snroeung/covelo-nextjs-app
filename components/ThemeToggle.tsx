'use client';

import { useTheme } from '@/contexts/ThemeContext';

function SunIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
      className="w-4 h-4">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
      className="w-4 h-4">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const { isDark, toggleTheme } = useTheme();

  if (compact) {
    return (
      <button
        onClick={toggleTheme}
        aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        className={`w-9 h-9 flex items-center justify-center rounded-lg border transition-colors ${
          isDark
            ? 'border-gph-dark-line text-gph-dark-ink hover:bg-gph-dark-linesoft'
            : 'border-gray-200 text-gray-500 hover:bg-gray-100'
        }`}
      >
        {isDark ? <MoonIcon /> : <SunIcon />}
      </button>
    );
  }

  const borderCls     = isDark ? 'border-gph-dark-line' : 'border-gray-200';
  const activeCls     = isDark ? 'bg-gph-dark-action text-gph-dark-bg' : 'bg-gray-900 text-white';
  const lightInactive = isDark ? 'bg-transparent text-gph-dark-ink hover:bg-gph-dark-linesoft' : activeCls;
  const darkInactive  = isDark ? activeCls : 'bg-gray-900 text-white hover:bg-gray-700';

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
