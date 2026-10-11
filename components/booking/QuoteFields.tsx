'use client';

import type { QuoteValues, ReportSubjectType } from '@/lib/reports/types';
import { bookingStyles, dateLabels } from '@/components/booking/bookingStyles';
import { useToday } from '@/hooks/useToday';
import { laterDate } from '@/lib/dates';

/** Form state — strings so a half-typed number doesn't snap back. */
export interface QuoteDraft {
  cash: string;
  points: string;
  start: string;
  end: string;
}

export function draftFromQuote(q: QuoteValues): QuoteDraft {
  return {
    cash: String(Math.round(q.cash * 100) / 100),
    points: q.points === null ? '' : String(q.points),
    start: q.start,
    end: q.end ?? '',
  };
}

/** Null while any field is unparseable or a date is before `today` — callers disable Submit. */
export function quoteFromDraft(d: QuoteDraft, hasEnd: boolean, today?: string): QuoteValues | null {
  const cash = Number(d.cash.replace(/[$,\s]/g, ''));
  if (d.cash.trim() === '' || !Number.isFinite(cash) || cash < 0) return null;
  const rawPts = d.points.replace(/[,\s]/g, '');
  const points = rawPts === '' ? null : Number(rawPts);
  if (points !== null && (!Number.isInteger(points) || points < 0)) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d.start)) return null;
  if (hasEnd && (!/^\d{4}-\d{2}-\d{2}$/.test(d.end) || d.end < d.start)) return null;
  if (today && d.start < today) return null;
  return { cash, points, start: d.start, end: hasEnd ? d.end : null };
}

export function QuoteFields({
  draft, onChange, subjectType, hasEnd, pointsUnit, idPrefix, isDark,
}: {
  draft: QuoteDraft;
  onChange: (next: QuoteDraft) => void;
  subjectType: ReportSubjectType;
  hasEnd: boolean;
  pointsUnit: string;
  idPrefix: string;
  isDark: boolean;
}) {
  const st = bookingStyles(isDark);
  const labels = dateLabels(subjectType);
  const inputCls = `w-full min-h-11 px-3 rounded-lg border text-sm font-mono tabular-nums outline-none ${st.input}`;
  const today = useToday();
  const set = (k: keyof QuoteDraft) => (e: React.ChangeEvent<HTMLInputElement>) => onChange({ ...draft, [k]: e.target.value });

  return (
    <div className={`grid grid-cols-2 gap-3 ${hasEnd ? 'md:grid-cols-4' : 'md:grid-cols-3'}`}>
      <div>
        <label htmlFor={`${idPrefix}-cash`} className={st.label}>Cash price</label>
        <input id={`${idPrefix}-cash`} inputMode="decimal" value={draft.cash} onChange={set('cash')} className={`mt-1 ${inputCls}`} />
      </div>
      <div>
        <label htmlFor={`${idPrefix}-points`} className={st.label}>Points ({pointsUnit})</label>
        <input id={`${idPrefix}-points`} inputMode="numeric" value={draft.points} onChange={set('points')} className={`mt-1 ${inputCls}`} />
      </div>
      <div>
        <label htmlFor={`${idPrefix}-start`} className={st.label}>{labels.start}</label>
        <input id={`${idPrefix}-start`} type="date" value={draft.start} min={today} onChange={set('start')} className={`mt-1 ${inputCls}`} />
      </div>
      {hasEnd && (
        <div>
          <label htmlFor={`${idPrefix}-end`} className={st.label}>{labels.end}</label>
          <input id={`${idPrefix}-end`} type="date" value={draft.end} min={laterDate(draft.start, today)} onChange={set('end')} className={`mt-1 ${inputCls}`} />
        </div>
      )}
    </div>
  );
}

/** Under the quote fields: the "couldn't find it" checkbox. Submitting is the parent form's job. */
export function NotFoundCheck({
  checked, onChange, isDark,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  isDark: boolean;
}) {
  const st = bookingStyles(isDark);
  return (
    <label data-testid="not-found-check" className={`mt-3 flex min-h-11 items-center gap-2 text-xs font-semibold cursor-pointer ${st.ink}`}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4"
      />
      I couldn&rsquo;t find this result
    </label>
  );
}
