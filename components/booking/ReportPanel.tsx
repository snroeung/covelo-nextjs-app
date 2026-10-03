'use client';

import type { QuoteValues, ReportSubjectType } from '@/lib/reports/types';
import { changedFields } from '@/lib/reports/classify';
import { ChangeNotice, QuoteFields, draftFromQuote, quoteFromDraft, type QuoteDraft } from '@/components/booking/QuoteFields';
import { bookingStyles, fmtRange, fmtUsd } from '@/components/booking/bookingStyles';

/**
 * Step 2 of View deal: once the partner site is open, ask whether the quote
 * held up. Unchanged → Matched, edited → Different, "No" → Not found.
 */
export function ReportPanel({
  optionName, url, quote, draft, onDraftChange, found, onFoundChange, subjectType, pointsUnit,
  canSubmit, submitting, error, onSkip, onSubmit, signInPrompt, isDark,
}: {
  optionName: string;
  url: string;
  quote: QuoteValues;
  draft: QuoteDraft;
  onDraftChange: (d: QuoteDraft) => void;
  found: boolean | null;
  onFoundChange: (f: boolean) => void;
  subjectType: ReportSubjectType;
  pointsUnit: string;
  canSubmit: boolean;
  submitting: boolean;
  error: string | null;
  onSkip: () => void;
  onSubmit: (entered: QuoteValues | null) => void;
  signInPrompt: React.ReactNode;
  isDark: boolean;
}) {
  const st = bookingStyles(isDark);
  const hasEnd = quote.end !== null;
  const entered = quoteFromDraft(draft, hasEnd);
  const changes = found && entered ? changedFields(quote, entered) : found ? ['values'] : [];
  const ready = found === false || (found === true && entered !== null);

  const choiceCls = (on: boolean) =>
    `min-h-11 flex-1 px-4 rounded-lg border text-sm font-bold transition-colors ${
      on
        ? isDark ? 'bg-gph-dark-action text-gph-dark-bg border-gph-dark-action' : 'bg-cv-navy-950 text-white border-cv-navy-950'
        : st.secondary
    }`;

  return (
    <section data-testid="report-panel" aria-labelledby="report-heading">
      <p className={`text-xs ${st.muted}`}>
        <span className={`font-bold ${st.ink}`}>{optionName}</span> opened in a new tab ·{' '}
        <a href={url} target="_blank" rel="noopener noreferrer" className={`font-bold ${st.link}`}>Reopen site ↗</a>
      </p>
      <h4 id="report-heading" className={`mt-2 text-lg font-extrabold ${st.ink}`}>Did you find this result?</h4>

      <p className={`mt-2 text-sm font-mono tabular-nums ${st.ink}`}>
        {fmtUsd(quote.cash)}
        {quote.points !== null && <> · {quote.points.toLocaleString()} {pointsUnit}</>}
        {' · '}{fmtRange(quote.start, quote.end)}
      </p>
      <p className={`text-xs mt-1 ${st.muted}`}>Your answer is shared with other travelers searching this trip.</p>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row" role="radiogroup" aria-label="Did you find this result?">
        <button type="button" role="radio" aria-checked={found === true} onClick={() => onFoundChange(true)} className={choiceCls(found === true)}>
          Yes, I found it
        </button>
        <button type="button" role="radio" aria-checked={found === false} onClick={() => onFoundChange(false)} className={choiceCls(found === false)}>
          No, I couldn&rsquo;t find it
        </button>
      </div>

      {found && (
        <div className={`mt-4 rounded-xl border p-4 ${st.border} ${st.sunken}`}>
          <QuoteFields
            draft={draft}
            onChange={onDraftChange}
            subjectType={subjectType}
            hasEnd={hasEnd}
            pointsUnit={pointsUnit}
            idPrefix="report"
            isDark={isDark}
          />
          <ChangeNotice fields={changes} onReset={() => onDraftChange(draftFromQuote(quote))} isDark={isDark} />
        </div>
      )}

      {error && <p role="alert" className={`mt-3 text-xs font-semibold ${st.warn}`}>{error}</p>}

      <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-between sm:items-center">
        <button type="button" onClick={onSkip} className={`min-h-11 px-4 rounded-lg border text-sm font-bold ${st.secondary}`}>
          Skip for now
        </button>
        {canSubmit ? (
          <button
            type="button"
            disabled={!ready || submitting}
            onClick={() => onSubmit(found ? entered : null)}
            className={`min-h-11 px-5 rounded-lg text-sm font-bold disabled:opacity-50 ${st.primary}`}
          >
            {submitting ? 'Submitting…' : changes.length > 0 ? 'Submit updated result' : 'Submit'}
          </button>
        ) : signInPrompt}
      </div>
    </section>
  );
}
