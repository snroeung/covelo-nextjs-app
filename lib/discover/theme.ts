export interface GphTheme {
  bg: string;
  cardBg: string;
  line: string;
  rule: string;
  ink: string;
  muted: string;
  accent: string;
}

/** Shared light/dark class tokens for the Discover/Offers editorial surface. */
export function gphTheme(isDark: boolean): GphTheme {
  return {
    bg:     isDark ? 'bg-gph-dark-bg' : 'bg-gph-bg',
    cardBg: isDark ? 'bg-gph-dark-card' : 'bg-gph-card',
    line:   isDark ? 'border-gph-dark-line' : 'border-gph-line',
    rule:   isDark ? 'border-gph-dark-ink' : 'border-gph-ink',
    ink:    isDark ? 'text-gph-dark-ink' : 'text-gph-ink',
    muted:  isDark ? 'text-gph-dark-muted' : 'text-gph-muted',
    accent: isDark ? 'text-gph-dark-action' : 'text-gph-action',
  };
}
