'use client';

import { useEffect } from 'react';

/** DOM id of the results scroll container — AppShell pages scroll inside it, not the body. */
export const MAIN_SCROLL_ID = 'app-main-scroll';

// Several dialogs can be open at once (a modal over a modal): the page is locked
// by the first and released by the last.
let locks = 0;
let saved: { body: Partial<CSSStyleDeclaration>; main: string; scrollY: number } | null = null;

export function lockPage() {
  if (locks++ > 0) return;
  const { body } = document;
  const main = document.getElementById(MAIN_SCROLL_ID);
  saved = {
    body: { position: body.style.position, top: body.style.top, width: body.style.width, overflow: body.style.overflow },
    main: main?.style.overflow ?? '',
    scrollY: window.scrollY,
  };
  // position:fixed is what stops iOS Safari from scrolling the page behind the
  // dialog; the negative top keeps the visible scroll position
  body.style.position = 'fixed';
  body.style.top = `-${saved.scrollY}px`;
  body.style.width = '100%';
  body.style.overflow = 'hidden';
  if (main) main.style.overflow = 'hidden';
}

export function unlockPage() {
  if (--locks > 0 || !saved) return;
  const { body } = document;
  body.style.position = saved.body.position ?? '';
  body.style.top = saved.body.top ?? '';
  body.style.width = saved.body.width ?? '';
  body.style.overflow = saved.body.overflow ?? '';
  const main = document.getElementById(MAIN_SCROLL_ID);
  if (main) main.style.overflow = saved.main;
  window.scrollTo(0, saved.scrollY);
  saved = null;
}

/** Freeze the page behind a dialog while `active` (default: while mounted). */
export function useScrollLock(active = true) {
  useEffect(() => {
    if (!active) return;
    lockPage();
    return unlockPage;
  }, [active]);
}
