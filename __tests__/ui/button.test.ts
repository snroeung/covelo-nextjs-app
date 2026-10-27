import { describe, expect, it } from 'vitest';
import { btn, BTN_ACTION, BTN_DANGER, BTN_GHOST, BTN_PRIMARY, type ButtonSize, type ButtonVariant } from '@/components/ui/button';

const VARIANTS: ButtonVariant[] = ['primary', 'accent', 'value', 'secondary', 'danger', 'quiet', 'link'];
const SIZES: ButtonSize[] = ['md', 'lg', 'icon'];

describe('btn', () => {
  it.each(VARIANTS.flatMap((v) => SIZES.map((s) => [v, s] as const)))(
    '%s/%s keeps a 44px+ hit area and a focus ring',
    (v, s) => {
      const cls = btn(v, s);
      expect(cls).toMatch(/min-h-1[12]/);
      expect(cls).toContain('focus-visible:outline-2');
      expect(cls).toContain('aria-disabled:opacity-40');
    },
  );

  it('defaults to primary/md', () => {
    expect(btn()).toBe(btn('primary', 'md'));
  });

  it('appends extra classes last', () => {
    expect(btn('accent', 'md', 'ml-auto').endsWith('ml-auto')).toBe(true);
  });

  it('never branches on theme', () => {
    for (const v of VARIANTS) expect(btn(v)).not.toContain('dark:');
  });

  it('aliases match btn()', () => {
    expect(BTN_PRIMARY).toBe(btn('primary'));
    expect(BTN_GHOST).toBe(btn('secondary'));
    expect(BTN_DANGER).toBe(btn('danger'));
    expect(BTN_ACTION).toContain('text-gph-muted');
  });
});
