'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { btn } from '@/components/ui/button';

interface Props {
  /** Button text and the list's name: "Saved posts", "Saved offers" */
  label: string;
  /** Shown after the label, e.g. a count */
  suffix?: ReactNode;
  icon: (open: boolean) => ReactNode;
  /** Pressed while closed: call `open()` to show the list, or do something else (sign-in prompt) instead */
  beforeOpen?: (open: () => void) => void;
  /** The list. Only rendered while open, so its queries start when it is opened. */
  children: (close: () => void) => ReactNode;
}

/**
 * The "Saved …" button and its list. A tap or click toggles it (no hover-only
 * behaviour); Escape, an outside click, or leaving the page closes it. On a
 * phone it is a bottom sheet over a dimmed page; from md up, a dropdown.
 */
export function SavedPopover({ label, suffix, icon, beforeOpen, children }: Props) {
  const pathname = usePathname();
  // Open for one pathname: a route change (following a saved item) closes it with no effect
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === pathname;
  const root = useRef<HTMLDivElement>(null);
  const panelId = useId();
  const close = () => setOpenOn(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (!root.current?.contains(e.target as Node)) setOpenOn(null); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpenOn(null); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);

  function toggle() {
    if (open) return close();
    const show = () => setOpenOn(pathname);
    if (beforeOpen) beforeOpen(show);
    else show();
  }

  return (
    <div ref={root} className="relative">
      <button type="button" aria-expanded={open} aria-controls={open ? panelId : undefined} onClick={toggle} className={btn('secondary')}>
        {icon(open)}
        {label}
        {suffix}
      </button>

      {open && (
        <>
          <div aria-hidden="true" className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm md:hidden" onClick={close} />
          <div
            id={panelId}
            role="region"
            aria-label={label}
            className="fixed inset-x-0 bottom-0 z-50 md:absolute md:inset-auto md:right-0 md:top-full md:w-[400px] md:pt-1.5"
          >
            <div className="max-h-[75vh] overflow-y-auto rounded-t-2xl border border-gph-line bg-gph-card p-2 shadow-xl md:max-h-[70vh] md:rounded-xl">
              <div className="flex items-center justify-between px-2.5 pb-1.5 pt-1">
                <h2 className="font-mono text-[10px] font-extrabold uppercase tracking-[0.12em] text-gph-muted">{label}</h2>
                <button type="button" onClick={close} className={btn('quiet', 'icon', 'text-xs! md:hidden')} aria-label={`Close ${label.toLowerCase()}`}>
                  <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="m6 6 12 12M18 6 6 18" /></svg>
                </button>
              </div>
              {children(close)}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
