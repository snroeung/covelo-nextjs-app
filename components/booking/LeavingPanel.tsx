'use client';

import { btn } from '@/components/ui/button';
import { useState } from 'react';
import type { QuoteValues, ReportSubjectType } from '@/lib/reports/types';
import { NotFoundCheck, QuoteFields, quoteFromDraft, type QuoteDraft } from '@/components/booking/QuoteFields';
import { bookingStyles } from '@/components/booking/bookingStyles';
import { useToday } from '@/hooks/useToday';

export function siteHost(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; }
}

/**
 * View deal: say where the user is going and let them report what the site
 * showed — the quote as-is (Matched), an edited quote (Different), or "couldn't
 * find it" (Not found). Submit result is members-only; signed-out users get a
 * hover/focus tooltip saying why.
 */
export function LeavingPanel({
  optionName, url, quote, draft, onDraftChange, subjectType, pointsUnit, canSubmit, submitting, error,
  onBack, onSubmit, isDark,
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
  /** Submits the whole form — `null` = couldn't find it, otherwise the (possibly edited) quote */
  onSubmit: (entered: QuoteValues | null) => void;
  isDark: boolean;
}) {
  const st = bookingStyles(isDark);
  const [notFound, setNotFound] = useState(false);
  const host = siteHost(url);
  const hasEnd = quote.end !== null;
  const today = useToday();
  const entered = quoteFromDraft(draft, hasEnd, today);
  const ready = notFound || entered !== null;
  const locked = !canSubmit;
  const tip = isDark ? 'bg-gph-dark-ink text-gph-dark-bg' : 'bg-gray-900 text-white';

  function submitForm() {
    if (locked || !ready || submitting) return;
    onSubmit(notFound ? null : entered);
  }

  return (
    <section data-testid="leaving-panel" aria-labelledby="leaving-heading">
      <h3 id="leaving-heading" className={`text-lg font-extrabold leading-snug ${st.ink}`}>
        You&rsquo;re leaving Covelo to go to <span className="font-mono">{host}</span> in a new tab.
      </h3>
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
        <NotFoundCheck checked={notFound} onChange={setNotFound} isDark={isDark} />
        {error && <p role="alert" className={`mt-2 text-xs font-semibold ${st.warn}`}>{error}</p>}
      </div>

      <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
        <button type="button" onClick={onBack} className={btn('secondary', 'md', 'text-sm!')}>
          ← Back to comparison
        </button>
        <div className="relative group flex flex-col">
          <button
            type="button"
            onClick={submitForm}
            aria-disabled={locked || !ready || submitting}
            aria-busy={submitting}
            aria-describedby={locked ? 'leaving-submit-why' : undefined}
            className={btn('primary', 'md', `px-5! text-sm! gap-2 ${submitting ? 'cursor-wait! aria-disabled:opacity-100!' : ''}`)}
          >
            {submitting && (
              <span
                data-testid="submit-spinner"
                aria-hidden="true"
                className="h-4 w-4 rounded-full border-2 border-current border-t-transparent animate-spin"
              />
            )}
            {locked ? '\u{1F512} Submit result' : submitting ? 'Submitting…' : 'Submit result'}
          </button>
          {locked && (
            <span
              id="leaving-submit-why"
              role="tooltip"
              className={`pointer-events-none absolute bottom-full right-0 mb-2 w-64 rounded-lg px-3 py-2 text-xs font-semibold shadow-lg opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 ${tip}`}
            >
              Members only — sign in to share your result with other travelers.
            </span>
          )}
        </div>
      </div>
      <p className={`mt-3 text-xs text-center sm:text-right ${st.muted}`}>
        New tab missing?{' '}
        <a href={url} target="_blank" rel="noopener noreferrer" className={`font-bold ${st.link}`}>
          Open link in new tab ↗
        </a>
      </p>
    </section>
  );
}
