'use client';

import { createContext, useContext, useEffect, useState } from 'react';

interface ThemeContextValue {
  isDark: boolean;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [isDark, setIsDark] = useState(false); // default: light

  useEffect(() => {
    // Deliberately not a lazy useState initializer: SSR always renders the
    // light default, so the first client render must match it exactly to
    // avoid a hydration mismatch. Syncing the real value one tick later
    // here is the tradeoff, not an oversight.
    const stored = localStorage.getItem('covelo_theme');
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (stored) setIsDark(stored === 'dark');
  }, []);

  function toggleTheme() {
    setIsDark((prev) => {
      const next = !prev;
      localStorage.setItem('covelo_theme', next ? 'dark' : 'light');
      return next;
    });
  }

  return (
    <ThemeContext.Provider value={{ isDark, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
