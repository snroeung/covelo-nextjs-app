'use client';

import type { BookingReport, QuoteValues, ReportResult, ReportSubjectType } from '@/lib/reports/types';
import { cashDelta, datesDiffer, reportPerDay, summarizeReports } from '@/lib/reports/classify';
import { bookingStyles, fmtRange, fmtUsd, timeAgo } from '@/components/booking/bookingStyles';

const RESULT_LABEL: Record<ReportResult, string> = {
  matched: 'Matched',
  different: 'Different',
  not_found: 'Not found',
};

function ResultBadge({ result, isDark }: { result: ReportResult; isDark: boolean }) {
  const st = bookingStyles(isDark);
  const tone = result === 'matched' ? st.goodChip : result === 'different' ? st.warnChip : st.noneChip;
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold font-mono uppercase tracking-wide ${tone}`}>
      {RESULT_LABEL[result]}
    </span>
  );
}

const round2 = (n: number) => Math.round(n * 100) / 100;

function Delta({ delta, isDark }: { delta: number | null; isDark: boolean }) {
  const st = bookingStyles(isDark);
  // ±1¢ is per-day rounding, not a price change.
  if (delta === null || Math.abs(delta) <= 0.01) return null;
  return (
    <span className={`ml-1 text-[10px] font-bold ${delta < 0 ? st.good : st.warn}`}>
      {delta < 0 ? '↓' : '↑'}{fmtUsd(Math.abs(delta))}
    </span>
  );
}

/**
 * What other travellers saw when they clicked through to this option. Summary
 * line, then one row per report — a table on desktop, stacked cards on phones
 * where five columns don't fit.
 */
export function ReportsList({
  reports, quote, subjectType, pointsUnit, now, isDark,
}: {
  reports: BookingReport[];
  quote: QuoteValues;
  subjectType: ReportSubjectType;
  pointsUnit: string;
  now: number | null;
  isDark: boolean;
}) {
  const st = bookingStyles(isDark);

  if (reports.length === 0) {
    return (
      <p data-testid="reports-list" className={`rounded-lg border px-4 py-3 text-xs ${st.border} ${st.sunken} ${st.muted}`}>
        No user reports yet. Book through this option and tell us what you found.
      </p>
    );
  }

  const s = summarizeReports(reports, quote);
  // Prices compare per day — per night for stays — so different trip lengths line up.
  const per = subjectType === 'hotel' ? '/night' : '/day';
  const youRow = isDark ? 'bg-gph-dark-linesoft' : 'bg-cv-navy-50';

  const cells = (r: BookingReport) => {
    const delta = cashDelta(r, quote);
    const daily = reportPerDay(r, quote);
    const datesOff = datesDiffer(r, quote);
    return {
      cash: r.reportedCash === null
        ? <span className={st.muted}>—</span>
        : <>
            {fmtUsd(Math.round(daily! * 100) / 100)}<span className={st.muted}>{per}</span>
            <Delta delta={delta} isDark={isDark} />
            <span className={`block text-[10px] ${st.muted}`}>{fmtUsd(r.reportedCash)} total</span>
          </>,
      points: r.reportedPoints === null
        ? <span className={st.muted}>—</span>
        : <>{r.reportedPoints.toLocaleString()} {pointsUnit}</>,
      dates: r.reportedStart === null
        ? <span className={st.muted}>—</span>
        : <span className={datesOff ? `font-bold ${st.warn}` : ''}>{fmtRange(r.reportedStart, r.reportedEnd)}</span>,
      who: (
        <>
          <span className={`font-semibold ${st.ink}`}>{r.reporterName}</span>
          {r.isMine && (
            <span className={`ml-1.5 px-1.5 py-0.5 rounded text-[9px] font-bold font-mono ${isDark ? 'bg-gph-dark-action text-gph-dark-bg' : 'bg-cv-navy-950 text-white'}`}>
              YOU
            </span>
          )}
          <span className={`block text-[10px] ${st.muted}`}>{timeAgo(r.createdAt, now)}</span>
        </>
      ),
    };
  };

  return (
    <div data-testid="reports-list" className={`rounded-lg border ${st.border} ${st.surface}`} onClick={(e) => e.stopPropagation()}>
      <p className={`px-4 py-2.5 border-b text-xs ${st.border} ${st.muted}`}>
        <span className={`font-bold ${st.ink}`}>{s.total} report{s.total !== 1 ? 's' : ''}</span>
        {' · '}
        <span className={s.matched > 0 ? `font-semibold ${st.good}` : ''}>{s.matched} of {s.total} matched our quote</span>
        {s.lo !== null && s.hi !== null && (
          <> · seen {s.lo === s.hi ? fmtUsd(round2(s.lo)) : `${fmtUsd(round2(s.lo))}–${fmtUsd(round2(s.hi))}`}{per}</>
        )}
      </p>

      {/* Desktop table */}
      <table className="hidden md:table w-full text-xs">
        <thead>
          <tr className={`text-left border-b ${st.border}`}>
            {['Result', 'Cash', 'Points', 'Date(s)', 'Reported'].map(h => (
              <th key={h} scope="col" className={`px-4 py-2 font-semibold ${st.label}`}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {reports.map(r => {
            const c = cells(r);
            return (
              <tr key={r.id} data-testid="report-row" className={`border-b last:border-b-0 ${st.border} ${r.isMine ? youRow : ''}`}>
                <td className="px-4 py-2.5"><ResultBadge result={r.result} isDark={isDark} /></td>
                <td className={`px-4 py-2.5 font-mono tabular-nums ${st.ink}`}>{c.cash}</td>
                <td className={`px-4 py-2.5 font-mono tabular-nums ${st.ink}`}>{c.points}</td>
                <td className={`px-4 py-2.5 font-mono ${st.ink}`}>{c.dates}</td>
                <td className="px-4 py-2.5">{c.who}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Mobile stacked */}
      <ul className="md:hidden">
        {reports.map(r => {
          const c = cells(r);
          return (
            <li key={r.id} className={`px-4 py-3 border-b last:border-b-0 text-xs ${st.border} ${r.isMine ? youRow : ''}`}>
              <div className="flex items-start justify-between gap-3">
                <ResultBadge result={r.result} isDark={isDark} />
                <div className="text-right">{c.who}</div>
              </div>
              <p className={`mt-1.5 font-mono tabular-nums ${st.ink}`}>
                {c.cash} · {c.points} · {c.dates}
              </p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
