'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { TRPCClientError } from '@trpc/client';
import type { PointsResult } from '@/lib/points/types';
import type { OptionRowView } from '@/lib/points/rowView';
import type { QuoteValues, ReportSubjectType } from '@/lib/reports/types';
import { RedemptionTable, type RedemptionBooking } from '@/components/booking/RedemptionTable';
import { ReportsList } from '@/components/booking/ReportsList';
import { LeavingPanel } from '@/components/booking/LeavingPanel';
import { ReportPanel } from '@/components/booking/ReportPanel';
import { draftFromQuote, type QuoteDraft } from '@/components/booking/QuoteFields';
import { bookingStyles } from '@/components/booking/bookingStyles';
import { useBookingReports } from '@/hooks/useBookingReports';
import { reportOptionKey, reportsForOption } from '@/lib/reports/subject';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';

type Flow =
  | { step: 'compare' }
  | { step: 'leaving' | 'report'; view: OptionRowView; url: string };

export interface CompareModalProps {
  result: PointsResult;
  subjectType: ReportSubjectType;
  subjectKey: string;
  /** Searched cash total and dates — each option's quote inherits these */
  baseQuote: Omit<QuoteValues, 'points'>;
  /** Title block shown beside the close button — stays put across steps. Omit for a bare close bar. */
  header?: ReactNode;
  /** Accessible name for the dialog */
  label: string;
  scopeLabel: string;
  scopeAdj: string;
  unitNoun?: string;
  scopeNote?: string;
  showBonusNotice?: boolean;
  onClose: () => void;
}

/** A transfer row is award-only, so its cash quote is the searched price it's valued against. */
function optionQuote(view: OptionRowView, base: Omit<QuoteValues, 'points'>): QuoteValues {
  return { ...base, cash: view.cashUsd ?? base.cash, points: view.points };
}

function errorMessage(err: unknown): string {
  if (err instanceof TRPCClientError) return err.message;
  return 'Something went wrong — try again.';
}

/**
 * Portal comparison popup with the book & report flow built in.
 *
 * compare → (View deal) → leaving → (Submit result: opens the site) → report
 * Any submit returns to compare with that option's reports open and a thank-you
 * line. The table stays mounted (hidden) during the flow so its grouped-
 * alternatives overlay is still open when the user comes back to it.
 *
 * Bottom sheet on phones, centered dialog from md up; the header row with the
 * close button never scrolls away.
 */
export function CompareModal({
  result, subjectType, subjectKey, baseQuote, header, label,
  scopeLabel, scopeAdj, unitNoun = 'options', scopeNote, showBonusNotice, onClose,
}: CompareModalProps) {
  const { isDark } = useTheme();
  const { user } = useAuth();
  const st = bookingStyles(isDark);
  const closeRef = useRef<HTMLButtonElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  const [flow, setFlow] = useState<Flow>({ step: 'compare' });
  const [draft, setDraft] = useState<QuoteDraft | null>(null);
  const [found, setFound] = useState<boolean | null>(null);
  const [openReportsKey, setOpenReportsKey] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<string | null>(null);

  const { reports, now, submit } = useBookingReports(subjectType, subjectKey);

  // Callers pass inline closures; reading through a ref keeps the mount effect
  // below from re-running (and re-stealing focus) on every parent render.
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      // A visible inner layer (the grouped-alternatives overlay) closes first.
      // Mid-flow the table is hidden with its overlay still mounted — that one
      // doesn't count, so Escape closes the popup from the leaving/report steps.
      const inner = bodyRef.current?.querySelector<HTMLElement>('[role="dialog"]');
      if (inner && inner.offsetParent !== null) return;
      e.stopImmediatePropagation();
      onCloseRef.current();
    };
    window.addEventListener('keydown', onKey, true);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    return () => {
      window.removeEventListener('keydown', onKey, true);
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  useEffect(() => { bodyRef.current?.scrollTo({ top: 0 }); }, [flow.step]);

  function backToCompare() {
    setFlow({ step: 'compare' });
    setDraft(null);
    setFound(null);
    submit.reset();
  }

  function startDeal(view: OptionRowView, url: string) {
    setConfirmation(null);
    setDraft(draftFromQuote(optionQuote(view, baseQuote)));
    setFound(null);
    submit.reset();
    setFlow({ step: 'leaving', view, url });
  }

  function openSite(url: string) {
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  function send(view: OptionRowView, entered: QuoteValues | null) {
    submit.mutate(
      { optionKey: reportOptionKey(view), optionName: view.sourceName, quote: optionQuote(view, baseQuote), entered },
      {
        onSuccess: () => {
          backToCompare();
          setOpenReportsKey(view.key);
          setConfirmation(`Thanks — your result was added to ${view.displayName}'s reports.`);
        },
      },
    );
  }

  const booking: RedemptionBooking = {
    onViewDeal: startDeal,
    reportCount: (v) => reportsForOption(reports, v).length,
    openReportsKey,
    onToggleReports: (key) => setOpenReportsKey(k => (k === key ? null : key)),
    renderReports: (v) => (
      <ReportsList
        reports={reportsForOption(reports, v)}
        quote={optionQuote(v, baseQuote)}
        pointsUnit={v.pointsUnit}
        now={now}
        isDark={isDark}
      />
    ),
  };

  const signInPrompt = (
    <Link href="/auth" className={`inline-flex items-center min-h-11 text-sm font-bold ${st.link}`}>
      Sign in to share your result →
    </Link>
  );
  const submitError = submit.isError ? errorMessage(submit.error) : null;

  return createPortal(
    <div
      className="fixed inset-0 z-200 flex items-end md:items-center justify-center bg-black/30 backdrop-blur-sm md:p-4"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={label}
        data-testid="compare-modal"
        className={`w-full md:max-w-3xl max-h-[92vh] md:max-h-[85vh] rounded-t-2xl md:rounded-xl shadow-xl border flex flex-col ${st.surface} ${st.border}`}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Sticky close bar */}
        <div className={`px-5 md:px-6 pt-4 pb-3 border-b shrink-0 flex justify-between items-start gap-4 ${st.border}`}>
          <div className="min-w-0">{header}</div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close comparison"
            className={`min-w-11 min-h-11 rounded-full flex items-center justify-center shrink-0 border transition-colors ${st.border} ${
              isDark ? 'bg-gph-dark-linesoft hover:bg-gph-dark-line' : 'bg-gray-100 hover:bg-gray-200'
            }`}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2} fill="none" className={st.ink} aria-hidden="true">
              <path strokeLinecap="round" d="M6 6l12 12M6 18L18 6" />
            </svg>
          </button>
        </div>

        <div ref={bodyRef} className="px-4 md:px-6 py-4 overflow-y-auto flex-1">
          {confirmation && flow.step === 'compare' && (
            <div role="status" data-testid="report-confirmation" className={`mb-3 flex items-center gap-3 rounded-lg border px-4 py-2 text-sm font-semibold ${st.goodBox}`}>
              <span className="flex-1">{confirmation}</span>
              <button type="button" onClick={() => setConfirmation(null)} aria-label="Dismiss" className="min-h-11 min-w-11 flex items-center justify-center">
                <svg width="12" height="12" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.4} fill="none" aria-hidden="true">
                  <path strokeLinecap="round" d="M6 6l12 12M6 18L18 6" />
                </svg>
              </button>
            </div>
          )}

          <div className={flow.step === 'compare' ? '' : 'hidden'}>
            <RedemptionTable
              result={result}
              scopeLabel={scopeLabel}
              scopeAdj={scopeAdj}
              unitNoun={unitNoun}
              scopeNote={scopeNote}
              showBonusNotice={showBonusNotice}
              booking={booking}
            />
          </div>

          {flow.step === 'leaving' && draft && (
            <LeavingPanel
              optionName={flow.view.displayName}
              url={flow.url}
              quote={optionQuote(flow.view, baseQuote)}
              draft={draft}
              onDraftChange={setDraft}
              subjectType={subjectType}
              pointsUnit={flow.view.pointsUnit}
              canSubmit={!!user}
              submitting={submit.isPending}
              error={submitError}
              onBack={backToCompare}
              onContinue={() => { openSite(flow.url); submit.reset(); setFlow({ ...flow, step: 'report' }); }}
              onAdvance={() => { submit.reset(); setFlow({ ...flow, step: 'report' }); }}
              onSubmitDifferent={(entered) => send(flow.view, entered)}
              signInPrompt={signInPrompt}
              isDark={isDark}
            />
          )}

          {flow.step === 'report' && draft && (
            <ReportPanel
              optionName={flow.view.displayName}
              url={flow.url}
              quote={optionQuote(flow.view, baseQuote)}
              draft={draft}
              onDraftChange={setDraft}
              found={found}
              onFoundChange={setFound}
              subjectType={subjectType}
              pointsUnit={flow.view.pointsUnit}
              canSubmit={!!user}
              submitting={submit.isPending}
              error={submitError}
              onSkip={backToCompare}
              onSubmit={(entered) => send(flow.view, entered)}
              signInPrompt={signInPrompt}
              isDark={isDark}
            />
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
