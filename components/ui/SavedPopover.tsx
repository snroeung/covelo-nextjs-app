'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { btn } from '@/components/ui/button';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { useMediaQuery } from '@/hooks/useMediaQuery';

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
 * phone it is a `BottomSheet`; from md up, a dropdown.
 */
export function SavedPopover({ label, suffix, icon, beforeOpen, children }: Props) {
  const pathname = usePathname();
  // Open for one pathname: a route change (following a saved item) closes it with no effect
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === pathname;
  const root = useRef<HTMLDivElement>(null);
  const panelId = useId();
  const isPhone = useMediaQuery('(max-width: 767px)');
  const close = () => setOpenOn(null);

  useEffect(() => {
    if (!open) return;
    // The phone sheet is portalled out of `root` and has its own backdrop and Escape handling
    const onDown = (e: MouseEvent) => { if (!isPhone && !root.current?.contains(e.target as Node)) setOpenOn(null); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpenOn(null); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open, isPhone]);

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

      {open && isPhone && (
        <BottomSheet open onClose={close} label={label}>
          <div id={panelId}>{children(close)}</div>
        </BottomSheet>
      )}

      {open && !isPhone && (
        <div id={panelId} role="region" aria-label={label} className="absolute right-0 top-full z-50 w-[400px] pt-1.5">
          <div className="max-h-[70vh] overflow-y-auto rounded-xl border border-gph-line bg-gph-card p-2 shadow-xl">
            <div className="flex items-center justify-between px-2.5 pb-1.5 pt-1">
              <h2 className="font-mono text-[10px] font-extrabold uppercase tracking-[0.12em] text-gph-muted">{label}</h2>
            </div>
            {children(close)}
          </div>
        </div>
      )}
    </div>
  );
}
