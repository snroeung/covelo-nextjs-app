'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTheme } from '@/contexts/ThemeContext';
import { useTrips } from '@/hooks/useTrips';
import { addBookmark, findBookmark, removeBookmark, type BookmarkType } from '@/lib/bookmarks';

interface Props {
  type: BookmarkType;
  itemId: string;  // unique API id — used as the dedup key
  title: string;   // human-readable label for the dropdown
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any;
}

export function AddToTripButton({ type, itemId, title, data }: Props) {
  const { isDark } = useTheme();
  const { trips } = useTrips();
  const [open, setOpen] = useState(false);
  const [justAddedId, setJustAddedId] = useState<string | null>(null);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
  // Set of trip_ids this item is currently saved to — drives all UI derived state
  const [savedTripIds, setSavedTripIds] = useState<Set<string>>(() => {
    const s = new Set<string>();
    if (typeof window !== 'undefined') {
      trips.forEach((t) => { if (findBookmark(t.id, itemId, title)) s.add(t.id); });
    }
    return s;
  });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Re-sync when trips list changes or a covelo:bookmarks event fires (e.g. from trip detail page)
  useEffect(() => {
    function sync() {
      setSavedTripIds((prev) => {
        const next = new Set<string>();
        trips.forEach((t) => { if (findBookmark(t.id, itemId, title)) next.add(t.id); });
        if (next.size === prev.size && [...next].every((id) => prev.has(id))) return prev;
        return next;
      });
    }
    sync();
    window.addEventListener('covelo:bookmarks', sync);
    return () => window.removeEventListener('covelo:bookmarks', sync);
  }, [trips, type, title]);

  // Position the fixed dropdown below the button
  useLayoutEffect(() => {
    if (!open || !buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    setDropdownStyle({
      position: 'fixed',
      top: rect.bottom + 4,
      right: window.innerWidth - rect.right,
    });
  }, [open]);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        buttonRef.current && !buttonRef.current.contains(e.target as Node) &&
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node)
      ) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Clear "just added" checkmark after 1.5 s
  useEffect(() => {
    if (!justAddedId) return;
    const t = setTimeout(() => setJustAddedId(null), 1500);
    return () => clearTimeout(t);
  }, [justAddedId]);

  function handleToggleTrip(trip_id: string) {
    if (savedTripIds.has(trip_id)) {
      const existing = findBookmark(trip_id, itemId, title);
      if (existing) removeBookmark(existing);
      setSavedTripIds((prev) => { const next = new Set(prev); next.delete(trip_id); return next; });
    } else {
      addBookmark({ trip_id, type, item_id: itemId, title, data });
      setSavedTripIds((prev) => new Set([...prev, trip_id]));
      setJustAddedId(trip_id);
      setOpen(false);
    }
  }

  const isSavedToAny = savedTripIds.size > 0;
  const dropdownBg   = isDark ? 'bg-cv-blue-900 border-cv-blue-800' : 'bg-white border-cv-blue-100';
  const itemHover    = isDark ? 'hover:bg-cv-blue-800 text-cv-blue-100' : 'hover:bg-cv-blue-50 text-cv-blue-950';
  const emptyColor   = isDark ? 'text-cv-blue-500' : 'text-cv-blue-400';
  const labelColor   = isDark ? 'text-cv-blue-400' : 'text-cv-blue-400';

  return (
    <div className="relative shrink-0" onClick={(e) => e.stopPropagation()}>
      <button
        ref={buttonRef}
        onClick={() => {
          if (isSavedToAny) {
            // Immediately remove from all saved trips — no dropdown needed
            savedTripIds.forEach((trip_id) => {
              const existing = findBookmark(trip_id, itemId, title);
              if (existing) removeBookmark(existing);
            });
            setSavedTripIds(new Set());
          } else {
            setOpen((o) => !o);
          }
        }}
        aria-label="Add to trip"
        className="p-1.5 rounded-lg transition-colors"
      >
        {isSavedToAny ? (
          <svg className="w-4 h-4 text-pink-500" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
          </svg>
        ) : (
          <svg className={`w-4 h-4 ${isDark ? 'text-cv-blue-600' : 'text-cv-blue-300'}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
          </svg>
        )}
      </button>

      {open && typeof document !== 'undefined' && createPortal(
        <div ref={dropdownRef} style={dropdownStyle} className={`z-50 w-52 rounded-xl border shadow-lg overflow-hidden ${dropdownBg}`}>
          {trips.length === 0 ? (
            <p className={`px-4 py-3 text-xs ${emptyColor}`}>No trips yet — create one first.</p>
          ) : (
            <>
              {!isSavedToAny && (
                <p className={`px-4 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-widest ${labelColor}`}>
                  Add to
                </p>
              )}
              <ul className={!isSavedToAny ? 'pb-1' : ''}>
                {trips.map((trip) => {
                  const alreadySaved = savedTripIds.has(trip.id);
                  const justSaved    = justAddedId === trip.id;
                  return (
                    <li key={trip.id}>
                      <button
                        onClick={() => handleToggleTrip(trip.id)}
                        className={`w-full flex items-center justify-between gap-2 px-4 py-2.5 text-sm text-left transition-colors ${itemHover}`}
                      >
                        <span className="truncate">{trip.title}</span>
                        {justSaved ? (
                          <svg className="w-4 h-4 shrink-0 text-cv-green-400" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        ) : alreadySaved ? (
                          <svg className="w-4 h-4 shrink-0 text-pink-500" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                          </svg>
                        ) : null}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </div>,
        document.body,
      )}
    </div>
  );
}
