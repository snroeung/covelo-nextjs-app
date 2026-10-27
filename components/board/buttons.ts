// Shared class strings for the board's buttons. Tap targets are 44px tall
// (CLAUDE.md); colors are the theme-reactive gph tokens, so nothing here
// branches on the theme.

export const BTN_PRIMARY =
  'inline-flex min-h-11 items-center justify-center gap-1.5 rounded-md bg-gph-action px-4 text-[13px] font-bold text-gph-bg hover:bg-gph-actionhi disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gph-ink';

export const BTN_GHOST =
  'inline-flex min-h-11 items-center justify-center gap-1.5 rounded-md border border-gph-line bg-gph-card px-4 text-xs font-bold text-gph-ink hover:bg-gph-linesoft disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gph-ink';

export const BTN_DANGER =
  'inline-flex min-h-11 items-center justify-center gap-1.5 rounded-md bg-gph-danger-soft px-4 text-xs font-bold text-gph-danger hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gph-danger';

/** Icon + label action under a post or comment (Comments, Share, Save, Reply…) */
export const BTN_ACTION =
  'inline-flex min-h-11 items-center gap-1.5 rounded-md px-2.5 text-[11.5px] font-bold text-gph-muted hover:bg-gph-linesoft hover:text-gph-ink focus-visible:outline-2 focus-visible:outline-gph-ink';

export const FIELD =
  'w-full rounded-lg border border-gph-line bg-gph-card px-3 py-2.5 text-[13.5px] text-gph-ink placeholder:text-gph-muted focus:border-gph-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-gph-ink/20';

export const LABEL = 'mb-1.5 block font-mono text-[10px] font-extrabold tracking-[0.12em] text-gph-muted';
