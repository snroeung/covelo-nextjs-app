import type { ReportSubjectType } from '@/lib/reports/types';

/** Shared light/dark class pairs for the book & report flow. */
export function bookingStyles(isDark: boolean) {
  return {
    ink:      isDark ? 'text-gph-dark-ink'    : 'text-gray-900',
    muted:    isDark ? 'text-gph-dark-muted'  : 'text-gray-600',
    border:   isDark ? 'border-gph-dark-line' : 'border-gray-200',
    surface:  isDark ? 'bg-gph-dark-card'     : 'bg-white',
    sunken:   isDark ? 'bg-gph-dark-bg'       : 'bg-gray-50',
    input:    isDark
      ? 'bg-gph-dark-bg border-gph-dark-line text-gph-dark-ink focus:border-gph-dark-muted'
      : 'bg-white border-gray-300 text-gray-900 focus:border-gray-500',
    label:    `text-[10px] font-semibold uppercase tracking-widest ${isDark ? 'text-gph-dark-muted' : 'text-gray-600'}`,
    good:     isDark ? 'text-cv-green-400' : 'text-cv-green-800',
    warn:     isDark ? 'text-cv-amber-300' : 'text-cv-amber-700',
    goodChip: isDark ? 'bg-green-950/40 text-cv-green-400' : 'bg-cv-green-50 text-cv-green-800',
    warnChip: isDark ? 'bg-cv-amber-900 text-cv-amber-300' : 'bg-cv-amber-50 text-cv-amber-900',
    noneChip: isDark ? 'bg-gph-dark-linesoft text-gph-dark-muted' : 'bg-gray-100 text-gray-700',
    warnBox:  isDark ? 'bg-cv-amber-900/60 border-cv-amber-700 text-cv-amber-200' : 'bg-cv-amber-50 border-cv-amber-400 text-cv-amber-900',
    goodBox:  isDark ? 'bg-green-950/40 border-cv-green-800 text-cv-green-400' : 'bg-cv-green-50 border-cv-green-500 text-cv-green-800',
    primary:  isDark
      ? 'bg-gph-dark-action hover:bg-gph-dark-actionhi text-gph-dark-bg'
      : 'bg-cv-navy-950 hover:bg-cv-navy-900 text-white',
    secondary: isDark
      ? 'border-gph-dark-line text-gph-dark-ink hover:bg-gph-dark-linesoft'
      : 'border-gray-300 text-gray-900 hover:bg-gray-100',
    link:     isDark ? 'text-gph-dark-ink underline underline-offset-2' : 'text-gray-900 underline underline-offset-2',
  };
}

export function dateLabels(subjectType: ReportSubjectType): { start: string; end: string } {
  return subjectType === 'hotel'
    ? { start: 'Check-in', end: 'Check-out' }
    : { start: 'Departure', end: 'Return' };
}

export function fmtUsd(n: number): string {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: n % 1 === 0 ? 0 : 2 });
}

/** "Nov 3" — parsed as a calendar date, not shifted by the viewer's timezone. */
export function fmtDay(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

export function fmtRange(start: string, end: string | null): string {
  return end ? `${fmtDay(start)} – ${fmtDay(end)}` : fmtDay(start);
}

export function timeAgo(iso: string, now: number | null): string {
  if (now === null) return '';
  const mins = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60000));
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return `${Math.round(days / 30)}mo ago`;
}
