import { describe, it, expect } from 'vitest';
import { fitRegion, clampTranslate, ptsForCpp, stepRef } from '@/components/home/Deck/useDeckScript';
import {
  CHAPTERS, MOBILE_HOME, DESKTOP_WINDOW, MOBILE_WINDOW,
  CPP_BASE, CPP_BONUS, PTS_BASE, PTS_BONUS, type StepId,
} from '@/components/home/Deck/steps';

describe('fitRegion', () => {
  it('full-screen region on the desktop window is zoom 1, centered', () => {
    expect(fitRegion([0, 0, 1100, 600], 1.45, DESKTOP_WINDOW)).toEqual([1, 550, 300]);
  });

  it('caps zoom at max for a small region', () => {
    const [z, cx, cy] = fitRegion([600, 165, 450, 140], 1.45, DESKTOP_WINDOW);
    expect(z).toBe(1.45); // min(1.45, 1100/450, 600/140) = 1.45
    expect(cx).toBe(825);
    expect(cy).toBe(235);
  });

  it('chooses the limiting axis when a region is wide and short', () => {
    // 1100/550 = 2, 600/100 = 6 → limited to 2, under the 1.45 cap? no: min(1.45,2,6)=1.45
    const [z] = fitRegion([0, 250, 550, 100], 1.45, DESKTOP_WINDOW);
    expect(z).toBe(1.45);
    // raise the cap so the width axis actually binds
    const [z2] = fitRegion([0, 250, 550, 100], 3, DESKTOP_WINDOW);
    expect(z2).toBe(2);
  });

  it('uses the mobile window dimensions', () => {
    const [z, cx, cy] = fitRegion(MOBILE_HOME.s1, 1.45, MOBILE_WINDOW);
    // s1 = [30,20,620,560]; min(1.45, 620/620=1, 700/560≈1.25) = 1
    expect(z).toBe(1);
    expect(cx).toBe(340);
    expect(cy).toBe(300);
  });
});

describe('clampTranslate', () => {
  it('letterbox-centers content smaller than the window (zoom 1)', () => {
    const { tx, ty, z } = clampTranslate([1, 550, 300], DESKTOP_WINDOW);
    expect(z).toBe(1);
    expect(tx).toBe(0);
    expect(ty).toBe(0);
  });

  it('keeps a zoomed region within the window bounds (never reveals edges)', () => {
    const win = DESKTOP_WINDOW;
    const cam = fitRegion([600, 165, 450, 140], 1.45, win);
    const { tx, ty, z } = clampTranslate(cam, win);
    // translate must stay within [win - content*z, 0]
    expect(tx).toBeLessThanOrEqual(0);
    expect(tx).toBeGreaterThanOrEqual(win.w - 1100 * z);
    expect(ty).toBeLessThanOrEqual(0);
    expect(ty).toBeGreaterThanOrEqual(win.h - 600 * z);
  });
});

describe('ptsForCpp (bonus-math count-up endpoints)', () => {
  it('maps the base cpp to the base points', () => {
    expect(ptsForCpp(CPP_BASE)).toBe(PTS_BASE);
  });
  it('maps the bonus cpp to the bonus points', () => {
    expect(ptsForCpp(CPP_BONUS)).toBe(PTS_BONUS);
  });
  it('clamps below the base and above the bonus', () => {
    expect(ptsForCpp(0)).toBe(PTS_BASE);
    expect(ptsForCpp(5)).toBe(PTS_BONUS);
  });
  it('is monotonic decreasing between the endpoints', () => {
    expect(ptsForCpp(1.95)).toBeLessThan(PTS_BASE);
    expect(ptsForCpp(1.95)).toBeGreaterThan(PTS_BONUS);
  });
});

describe('chapters / steps data', () => {
  it('has the expected shape: 3 chapters, 6 / 4 / 1 steps', () => {
    expect(CHAPTERS.map((c) => c.steps.length)).toEqual([6, 4, 1]);
  });

  it('every step id has a mobile home region', () => {
    const ids = CHAPTERS.flatMap((c) => c.steps.map((s) => s.id));
    for (const id of ids) expect(MOBILE_HOME[id as StepId]).toBeDefined();
  });

  it('stepRef resolves chapter/step indices to the right id', () => {
    expect(stepRef(0, 0)).toBe('s1');
    expect(stepRef(1, 0)).toBe('b1');
    expect(stepRef(2, 0)).toBe('t1');
  });

  it('durations are positive', () => {
    for (const c of CHAPTERS) for (const s of c.steps) expect(s.dur).toBeGreaterThan(0);
  });
});
