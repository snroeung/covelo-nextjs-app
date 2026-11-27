'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  CHAPTERS, MOBILE_HOME, DESKTOP_WINDOW, MOBILE_WINDOW,
  CPP_BASE, CPP_BONUS, PTS_BASE, PTS_BONUS,
  type StepId, type Cam, type Region,
} from './steps';

// ── Pure camera helpers (unit-tested) ────────────────────────────────────────

export interface Win { w: number; h: number }

/** Zoom so the whole region of the 1100×600 content stays within the window. */
export function fitRegion([x, y, w, h]: Region, max: number, win: Win): Cam {
  return [Math.min(max || 1.45, win.w / w, win.h / h), x + w / 2, y + h / 2];
}

/** Translate for a camera, clamped/letterboxed within the window. */
export function clampTranslate(cam: Cam, win: Win): { tx: number; ty: number; z: number } {
  const z = cam[0];
  const CW = 1100, CH = 600;
  const tx = CW * z <= win.w
    ? (win.w - CW * z) / 2
    : Math.max(win.w - CW * z, Math.min(0, win.w / 2 - cam[1] * z));
  const ty = CH * z <= win.h
    ? (win.h - CH * z) / 2
    : Math.max(win.h - CH * z, Math.min(0, win.h / 2 - cam[2] * z));
  return { tx, ty, z };
}

/** Derived points for the bonus-math count-up (pts falls out of cpp). */
export function ptsForCpp(cpp: number): number {
  const t = Math.max(0, Math.min(1, (cpp - CPP_BASE) / (CPP_BONUS - CPP_BASE)));
  return Math.round(PTS_BASE + (PTS_BONUS - PTS_BASE) * t);
}

// ── Deck state ───────────────────────────────────────────────────────────────

export interface DeckState {
  ch: number;
  st: number;
  auto: boolean;
  seq: number;
  cam: Cam;
  press: string;
  // s1
  toTyped: string;
  toSel: boolean;
  searching: boolean;
  // s2
  sort: 'best' | 'cheap' | 'fast';
  // s3
  others: boolean;
  // s5 / s6
  bonusOn: boolean;
  cpp: number;
  reports: boolean;
  spot: boolean;
  // board
  topic: boolean;
  q: string;
  saved: Record<string, boolean>;
  toast: boolean;
  savedOpen: boolean;
  feedY: number;
  // composer
  partner: string;
  bonus: string;
  posted: boolean;
}

function stepInit(id: StepId): Partial<DeckState> {
  switch (id) {
    case 's1': return { toSel: false, searching: false, toTyped: '' };
    case 's2': return { sort: 'best' };
    case 's3': return { others: false };
    case 's5': return { bonusOn: false, cpp: CPP_BASE, reports: false };
    case 's6': return { bonusOn: true, cpp: CPP_BONUS, reports: false };
    case 'b1':
    case 'b2': return { topic: false, q: '', toast: false, posted: false };
    case 'b3': return { saved: {}, toast: false, topic: false, q: '', posted: false };
    case 'b4': return { partner: '', bonus: '', posted: false };
    default: return {};
  }
}

const INITIAL: DeckState = {
  ch: 0, st: 0, auto: false, seq: 0, cam: [1, 550, 300], press: '',
  toTyped: '', toSel: false, searching: false,
  sort: 'best', others: false,
  bonusOn: false, cpp: CPP_BASE, reports: false, spot: false,
  topic: false, q: '', saved: {}, toast: false, savedOpen: false, feedY: 0,
  partner: '', bonus: '', posted: false,
};

export function stepRef(ch: number, st: number): StepId {
  return CHAPTERS[ch].steps[st].id;
}

export function useDeckScript({ mobile }: { mobile: boolean }) {
  const [state, setState] = useState<DeckState>(INITIAL);
  const stateRef = useRef(state);
  useEffect(() => { stateRef.current = state; }, [state]);

  const win = mobile ? MOBILE_WINDOW : DESKTOP_WINDOW;
  const winRef = useRef(win);
  useEffect(() => { winRef.current = win; }, [win]);

  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const toastT = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pressT = useRef<ReturnType<typeof setTimeout> | null>(null);
  const raf = useRef<number | null>(null);
  const sraf = useRef<number | null>(null);
  const started = useRef(false);

  const merge = useCallback((patch: Partial<DeckState>) => {
    setState((s) => ({ ...s, ...patch }));
  }, []);

  const clear = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    if (toastT.current) clearTimeout(toastT.current);
    if (pressT.current) clearTimeout(pressT.current);
  }, []);

  const later = useCallback((ms: number, fn: () => void) => {
    timers.current.push(setTimeout(fn, ms));
  }, []);

  const home = useCallback((id: StepId): Cam => {
    if (mobile) return fitRegion(MOBILE_HOME[id], 1.45, winRef.current);
    return [1, 550, 300];
  }, [mobile]);

  const press = useCallback((key: string) => {
    if (pressT.current) clearTimeout(pressT.current);
    merge({ press: key });
    pressT.current = setTimeout(() => merge({ press: '' }), 380);
  }, [merge]);

  // ── actions driven by the beat script ──────────────────────────────────────
  const pickSFO = useCallback(() => merge({ toSel: true }), [merge]);

  const goRef = useRef<(delta: number, auto?: boolean) => void>(() => {});

  const runSearch = useCallback(() => {
    const s = stateRef.current;
    if (!s.toSel || s.searching) return;
    merge({ searching: true });
    later(650, () => goRef.current(1));
  }, [merge, later]);

  const animateBonus = useCallback((on: boolean) => {
    if (raf.current) cancelAnimationFrame(raf.current);
    const from = stateRef.current.cpp;
    const to = on ? CPP_BONUS : CPP_BASE;
    const t0 = performance.now();
    merge({ bonusOn: on });
    const tick = (now: number) => {
      const k = Math.min(1, (now - t0) / 650);
      const e = 1 - Math.pow(1 - k, 3);
      merge({ cpp: from + (to - from) * e });
      if (k < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
  }, [merge]);

  const scrollFeed = useCallback((to: number, ms: number) => {
    if (sraf.current) cancelAnimationFrame(sraf.current);
    const from = stateRef.current.feedY;
    const t0 = performance.now();
    const tick = (now: number) => {
      const k = Math.min(1, (now - t0) / ms);
      merge({ feedY: from + (to - from) * (1 - Math.pow(1 - k, 3)) });
      if (k < 1) sraf.current = requestAnimationFrame(tick);
    };
    sraf.current = requestAnimationFrame(tick);
  }, [merge]);

  const save = useCallback((id: string) => {
    const on = !stateRef.current.saved[id];
    merge({ saved: { ...stateRef.current.saved, [id]: on }, toast: on });
    if (toastT.current) clearTimeout(toastT.current);
    if (on) toastT.current = setTimeout(() => merge({ toast: false }), 1500);
  }, [merge]);

  const frame = useCallback((x: number, y: number, w: number, h: number, max?: number) => {
    merge({ cam: fitRegion([x, y, w, h], max ?? 1.45, winRef.current) });
  }, [merge]);

  // ── beat timelines (mirror the canvas script()) ─────────────────────────────
  const script = useCallback((id: StepId): Array<[number, () => void]> => {
    const out = (): void => merge({ cam: home(id) });
    const tap = (key: string, fn?: () => void) => () => { press(key); fn?.(); };
    const typeQ = (word: string, start: number): Array<[number, () => void]> =>
      word.split('').map((_, i) => [start + i * 110, () => merge({ q: word.slice(0, i + 1) })]);
    const go = (d: number) => goRef.current(d);

    switch (id) {
      case 's1':
        return ([...'San F'].map((_, i): [number, () => void] =>
          [250 + i * 120, () => merge({ toTyped: 'San F'.slice(0, i + 1) })]))
          .concat([
            [1250, tap('sfo', pickSFO)],
            [1650, () => frame(600, 165, 450, 140)],
            [2050, tap('search', runSearch)],
          ]);
      case 's2':
        return [
          [600, tap('cheap', () => merge({ sort: 'cheap' }))],
          [1300, tap('best', () => merge({ sort: 'best' }))],
          [2000, tap('compare')],
          [2400, () => go(1)],
        ];
      case 's3':
        return [[150, () => frame(150, 24, 800, 465)], [2600, () => go(1)]];
      case 's4':
        return [
          [300, () => frame(24, 95, 770, 120)],
          [1700, out],
          [2100, tap('hyatt')],
          [2450, () => go(1)],
        ];
      case 's5':
        return [
          [300, () => merge({ spot: true })],
          [750, () => animateBonus(true)],
          [3100, () => go(1)],
        ];
      case 's6':
        return [
          [300, () => frame(110, 150, 880, 150)],
          [750, tap('reports', () => merge({ reports: true }))],
          [1200, () => frame(110, 185, 880, 270)],
          [3000, out],
          [3350, () => go(1)],
        ];
      case 'b1':
        return [
          [350, () => scrollFeed(300, 600)],
          [1250, () => scrollFeed(560, 650)],
          [2150, () => scrollFeed(700, 450)],
          [2900, () => go(1)],
        ];
      case 'b2':
        return [
          [300, () => frame(24, 130, 782, 290)],
          [700, tap('topic', () => merge({ topic: true }))],
          ...typeQ('amex', 1100),
          [2200, out],
          [2900, () => go(1)],
        ];
      case 'b3':
        return [
          [300, () => frame(24, 225, 782, 190)],
          [750, tap('save', () => save('p1'))],
          [1150, out],
          [1550, tap('savedBtn', () => merge({ savedOpen: true, toast: false }))],
          [1750, () => frame(400, 55, 420, 300)],
          [3400, () => go(1)],
        ];
      case 'b4':
        return [
          [200, () => frame(290, 180, 520, 280)],
          [550, tap('partner', () => merge({ partner: 'World of Hyatt' }))],
          [1150, () => merge({ bonus: '3' })],
          [1300, () => merge({ bonus: '30' })],
          [2200, () => frame(290, 380, 520, 215)],
          [2650, tap('post')],
          [2950, () => { if (stateRef.current.partner && parseInt(stateRef.current.bonus, 10) > 0) go(1); }],
        ];
      case 't1':
        return [[3500, () => go(1)]];
      default:
        return [];
    }
  }, [merge, home, press, frame, pickSFO, runSearch, animateBonus, scrollFeed, save]);

  // ── navigation ──────────────────────────────────────────────────────────────
  const enter = useCallback((ch: number, st: number, auto: boolean) => {
    clear();
    if (raf.current) cancelAnimationFrame(raf.current);
    if (sraf.current) cancelAnimationFrame(sraf.current);
    const id = stepRef(ch, st);
    const extra = stepInit(id);
    setState((s) => ({
      ...s, ...extra, ch, st, auto,
      seq: s.seq + 1, cam: home(id), press: '', feedY: 0, savedOpen: false, spot: false,
    }));
    if (auto) script(id).forEach(([ms, fn]) => later(ms, fn));
  }, [clear, home, script, later]);

  const go = useCallback((delta: number, auto?: boolean) => {
    const s = stateRef.current;
    let ch = s.ch;
    let st = s.st + delta;
    if (st >= CHAPTERS[ch].steps.length) { ch = (ch + 1) % CHAPTERS.length; st = 0; }
    if (st < 0) { ch = (ch + CHAPTERS.length - 1) % CHAPTERS.length; st = CHAPTERS[ch].steps.length - 1; }
    enter(ch, st, auto === undefined ? s.auto : auto);
  }, [enter]);
  useEffect(() => { goRef.current = go; }, [go]);

  // ── public controls ──────────────────────────────────────────────────────────
  const prev = useCallback(() => go(-1), [go]);
  const next = useCallback(() => go(1), [go]);
  const jumpStep = useCallback((st: number) => enter(stateRef.current.ch, st, stateRef.current.auto), [enter]);
  const pickChapter = useCallback((ch: number) => enter(ch, 0, stateRef.current.auto), [enter]);
  const toggle = useCallback(() => {
    if (stateRef.current.auto) { clear(); merge({ auto: false }); }
    else enter(stateRef.current.ch, stateRef.current.st, true);
  }, [clear, merge, enter]);

  /** Begin autoplay once (deck is visible and the intro is gone). */
  const play = useCallback(() => {
    if (started.current) return;
    started.current = true;
    enter(stateRef.current.ch, stateRef.current.st, true);
  }, [enter]);

  useEffect(() => () => {
    clear();
    if (raf.current) cancelAnimationFrame(raf.current);
    if (sraf.current) cancelAnimationFrame(sraf.current);
  }, [clear]);

  return { state, win, enter, go, prev, next, jumpStep, pickChapter, toggle, play };
}
