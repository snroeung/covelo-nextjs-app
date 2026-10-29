'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

// One short message at the bottom of the board ("Link copied", "Held for
// review", "Couldn't save your vote"). Announced politely to screen readers.

interface ToastValue {
  show: (message: string, opts?: { tone?: 'default' | 'error'; href?: { label: string; url: string }; action?: { label: string; onClick: () => void } }) => void;
}

const ToastContext = createContext<ToastValue | null>(null);

interface Toast {
  id: number;
  message: string;
  tone: 'default' | 'error';
  href?: { label: string; url: string };
  action?: { label: string; onClick: () => void };
}

export function BoardToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<Toast | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seq = useRef(0);

  const show = useCallback<ToastValue['show']>((message, opts) => {
    if (timer.current) clearTimeout(timer.current);
    setToast({ id: ++seq.current, message, tone: opts?.tone ?? 'default', href: opts?.href, action: opts?.action });
    timer.current = setTimeout(() => setToast(null), opts?.href || opts?.action ? 6000 : 3500);
  }, []);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const value = useMemo(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div aria-live="polite" role="status" className="pointer-events-none fixed inset-x-0 bottom-6 z-[80] flex justify-center px-4">
        {toast && (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-center gap-3 rounded-lg px-4 py-2.5 text-[13px] font-bold shadow-lg ${
              toast.tone === 'error' ? 'bg-gph-danger-soft text-gph-danger border border-gph-danger' : 'bg-gph-action text-gph-bg'
            }`}
          >
            <span>{toast.message}</span>
            {toast.action && (
              <button
                type="button"
                onClick={() => { toast.action?.onClick(); setToast(null); }}
                className="underline underline-offset-2 min-h-11 inline-flex items-center font-bold"
              >
                {toast.action.label}
              </button>
            )}
            {toast.href && (
              <a href={toast.href.url} className="underline underline-offset-2 min-h-11 inline-flex items-center">
                {toast.href.label}
              </a>
            )}
          </div>
        )}
      </div>
    </ToastContext.Provider>
  );
}

export function useBoardToast(): ToastValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useBoardToast must be used within BoardToastProvider');
  return ctx;
}
