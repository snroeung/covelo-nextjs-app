import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { lockPage, unlockPage, MAIN_SCROLL_ID } from '@/hooks/useScrollLock';

const style = () => ({ position: '', top: '', width: '', overflow: '' });

describe('page scroll lock', () => {
  let body: { style: ReturnType<typeof style> };
  let main: { style: { overflow: string } };
  const scrollTo = vi.fn();

  beforeEach(() => {
    body = { style: style() };
    main = { style: { overflow: '' } };
    scrollTo.mockClear();
    vi.stubGlobal('document', { body, getElementById: (id: string) => (id === MAIN_SCROLL_ID ? main : null) });
    vi.stubGlobal('window', { scrollY: 240, scrollTo });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('fixes the body at the current scroll offset and freezes the results scroller', () => {
    lockPage();
    expect(body.style).toMatchObject({ position: 'fixed', top: '-240px', width: '100%', overflow: 'hidden' });
    expect(main.style.overflow).toBe('hidden');
    unlockPage();
  });

  it('restores styles and scroll position on release', () => {
    body.style.overflow = 'auto';
    main.style.overflow = 'scroll';
    lockPage();
    unlockPage();
    expect(body.style).toEqual({ position: '', top: '', width: '', overflow: 'auto' });
    expect(main.style.overflow).toBe('scroll');
    expect(scrollTo).toHaveBeenCalledWith(0, 240);
  });

  it('stays locked until the last of several dialogs closes', () => {
    lockPage();
    lockPage();
    unlockPage();
    expect(body.style.position).toBe('fixed');
    unlockPage();
    expect(body.style.position).toBe('');
  });

  it('works on pages without the results scroller', () => {
    vi.stubGlobal('document', { body, getElementById: () => null });
    lockPage();
    expect(body.style.position).toBe('fixed');
    unlockPage();
    expect(body.style.position).toBe('');
  });
});
