'use client';

import { createContext, useContext, useEffect, useState } from 'react';

interface ThemeContextValue {
  isDark: boolean;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [isDark, setIsDark] = useState(true); // default: dark

  useEffect(() => {
    const stored = localStorage.getItem('covelo_theme');
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
