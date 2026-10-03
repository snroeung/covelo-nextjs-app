'use client';

import type { QuoteValues, ReportSubjectType } from '@/lib/reports/types';
import { changedFields } from '@/lib/reports/classify';
import { ChangeNotice, QuoteFields, quoteFromDraft, type QuoteDraft } from '@/components/booking/QuoteFields';
import { bookingStyles } from '@/components/booking/bookingStyles';

export function siteHost(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; }
}

/**
 * Step 1 of View deal: say where the user is going, let them correct the quote
 * if the site already shows something else, then hand off to the new tab.
 */
export function LeavingPanel({
  optionName, url, quote, draft, onDraftChange, subjectType, pointsUnit, canSubmit, submitting, error,
  onBack, onContinue, onAdvance, onSubmitDifferent, signInPrompt, isDark,
}: {
  optionName: string;
  url: string;
  quote: QuoteValues;
  draft: QuoteDraft;
  onDraftChange: (d: QuoteDraft) => void;
  subjectType: ReportSubjectType;
  pointsUnit: string;
  canSubmit: boolean;
  submitting: boolean;
  error: string | null;
  onBack: () => void;
  /** Opens the site in a new tab and moves to step 2 */
  onContinue: () => void;
  /** Moves to step 2 only — the recovery link opens the tab itself */
  onAdvance: () => void;
  onSubmitDifferent: (entered: QuoteValues) => void;
  signInPrompt: React.ReactNode;
  isDark: boolean;
}) {
  const st = bookingStyles(isDark);
  const host = siteHost(url);
  const hasEnd = quote.end !== null;
  const entered = quoteFromDraft(draft, hasEnd);
  const changes = entered ? changedFields(quote, entered) : ['values'];

  return (
    <section data-testid="leaving-panel" aria-labelledby="leaving-heading">
      <h4 id="leaving-heading" className={`text-lg font-extrabold leading-snug ${st.ink}`}>
        You&rsquo;re leaving Covelo to go to <span className="font-mono">{host}</span> in a new tab.
      </h4>
      <p className={`text-xs mt-1 ${st.muted}`}>
        Prices and availability can change between sites — what you see there is what you&rsquo;ll pay.
      </p>

      <div className={`mt-5 rounded-xl border p-4 ${st.border} ${st.sunken}`}>
        <p className={`text-base font-bold ${st.ink}`}>{optionName}</p>
        <p className={`text-xs mt-0.5 mb-3 ${st.muted}`}>Seeing something different? Edit it below.</p>
        <QuoteFields
          draft={draft}
          onChange={onDraftChange}
          subjectType={subjectType}
          hasEnd={hasEnd}
          pointsUnit={pointsUnit}
          idPrefix="leaving"
          isDark={isDark}
        />
        <ChangeNotice
          fields={changes}
          onReset={() => onDraftChange({ cash: String(quote.cash), points: quote.points === null ? '' : String(quote.points), start: quote.start, end: quote.end ?? '' })}
          onSubmit={canSubmit && entered ? () => onSubmitDifferent(entered) : undefined}
          submitDisabled={submitting}
          isDark={isDark}
        />
        {changes.length > 0 && !canSubmit && <div className="mt-2">{signInPrompt}</div>}
        {error && <p role="alert" className={`mt-2 text-xs font-semibold ${st.warn}`}>{error}</p>}
      </div>

      <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
        <button type="button" onClick={onBack} className={`min-h-11 px-4 rounded-lg border text-sm font-bold ${st.secondary}`}>
          ← Back to comparison
        </button>
        <button type="button" onClick={onContinue} className={`min-h-11 px-5 rounded-lg text-sm font-bold ${st.primary}`}>
          Submit result
        </button>
      </div>
      <p className={`mt-3 text-xs text-center sm:text-right ${st.muted}`}>
        New tab missing?{' '}
        <a href={url} target="_blank" rel="noopener noreferrer" onClick={onAdvance} className={`font-bold ${st.link}`}>
          Open link in new tab ↗
        </a>
      </p>
    </section>
  );
}
