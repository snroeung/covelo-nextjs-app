'use client';

import type { QuoteValues, ReportSubjectType } from '@/lib/reports/types';
import { bookingStyles, dateLabels } from '@/components/booking/bookingStyles';

/** Form state — strings so a half-typed number doesn't snap back. */
export interface QuoteDraft {
  cash: string;
  points: string;
  start: string;
  end: string;
}

export function draftFromQuote(q: QuoteValues): QuoteDraft {
  return {
    cash: String(q.cash),
    points: q.points === null ? '' : String(q.points),
    start: q.start,
    end: q.end ?? '',
  };
}

/** Null while any field is unparseable — callers disable Submit. */
export function quoteFromDraft(d: QuoteDraft, hasEnd: boolean): QuoteValues | null {
  const cash = Number(d.cash.replace(/[$,\s]/g, ''));
  if (d.cash.trim() === '' || !Number.isFinite(cash) || cash < 0) return null;
  const rawPts = d.points.replace(/[,\s]/g, '');
  const points = rawPts === '' ? null : Number(rawPts);
  if (points !== null && (!Number.isInteger(points) || points < 0)) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d.start)) return null;
  if (hasEnd && !/^\d{4}-\d{2}-\d{2}$/.test(d.end)) return null;
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
        <input id={`${idPrefix}-start`} type="date" value={draft.start} onChange={set('start')} className={`mt-1 ${inputCls}`} />
      </div>
      {hasEnd && (
        <div>
          <label htmlFor={`${idPrefix}-end`} className={st.label}>{labels.end}</label>
          <input id={`${idPrefix}-end`} type="date" value={draft.end} onChange={set('end')} className={`mt-1 ${inputCls}`} />
        </div>
      )}
    </div>
  );
}

/** Orange "You changed …" strip with Reset, plus an optional inline Submit. */
export function ChangeNotice({
  fields, onReset, onSubmit, submitDisabled, isDark,
}: {
  fields: string[];
  onReset: () => void;
  onSubmit?: () => void;
  submitDisabled?: boolean;
  isDark: boolean;
}) {
  const st = bookingStyles(isDark);
  if (fields.length === 0) return null;
  const list = fields.length === 1
    ? fields[0]
    : `${fields.slice(0, -1).join(', ')} and ${fields[fields.length - 1]}`;
  return (
    <div role="status" data-testid="change-notice" className={`mt-3 flex flex-wrap items-center gap-3 rounded-lg border px-3 py-2 text-xs ${st.warnBox}`}>
      <p className="flex-1 min-w-48 font-semibold">You changed the {list}. We&rsquo;ll share it as a different result.</p>
      <button type="button" onClick={onReset} className="min-h-11 px-3 rounded-lg text-xs font-bold underline underline-offset-2">
        Reset
      </button>
      {onSubmit && (
        <button
          type="button"
          onClick={onSubmit}
          disabled={submitDisabled}
          className={`min-h-11 px-4 rounded-lg text-xs font-bold disabled:opacity-50 ${st.primary}`}
        >
          Submit
        </button>
      )}
    </div>
  );
}
