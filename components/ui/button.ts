// Single source of truth for button styling. Colors are the theme-reactive
// gph tokens, so nothing here (or at a call site) branches on isDark. Plain
// class strings: usable on <button>, <a> and <Link>.

export type ButtonVariant = 'primary' | 'accent' | 'value' | 'secondary' | 'danger' | 'quiet' | 'link';
export type ButtonSize = 'md' | 'lg' | 'icon';

const BASE =
  'inline-flex items-center justify-center gap-1.5 rounded-md font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-40 aria-disabled:cursor-not-allowed aria-disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2';

const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-gph-action text-gph-bg hover:bg-gph-actionhi focus-visible:outline-gph-ink',
  accent: 'bg-gph-accent text-gph-accent-fg hover:bg-gph-accent-hi focus-visible:outline-gph-accent',
  value: 'bg-gph-value text-gph-value-fg hover:bg-gph-value-hi focus-visible:outline-gph-ink',
  secondary: 'border border-gph-line bg-gph-card text-gph-ink hover:bg-gph-linesoft focus-visible:outline-gph-ink',
  danger: 'bg-gph-danger-soft text-gph-danger hover:brightness-95 focus-visible:outline-gph-danger',
  quiet: 'text-gph-muted hover:bg-gph-linesoft hover:text-gph-ink focus-visible:outline-gph-ink',
  link: 'text-gph-ink underline-offset-2 hover:underline focus-visible:outline-gph-ink',
};

const SIZES: Record<ButtonSize, string> = {
  md: 'min-h-11 px-4 text-[13px]',
  lg: 'min-h-12 w-full px-5 text-sm sm:w-auto',
  icon: 'min-h-11 min-w-11 p-0 text-[13px]',
};

/** Layout-only classes (w-full, ml-auto, shrink-0…) go in `extra`. */
export function btn(variant: ButtonVariant = 'primary', size: ButtonSize = 'md', extra = ''): string {
  return [BASE, VARIANTS[variant], SIZES[size], extra].filter(Boolean).join(' ');
}

// Aliases kept so existing board imports keep working.
export const BTN_PRIMARY = btn('primary');
export const BTN_GHOST = btn('secondary');
export const BTN_DANGER = btn('danger');
/** Icon + label action under a post or comment (Comments, Share, Save, Reply…) */
export const BTN_ACTION = btn('quiet', 'md', 'px-2.5! text-[11.5px]!');
