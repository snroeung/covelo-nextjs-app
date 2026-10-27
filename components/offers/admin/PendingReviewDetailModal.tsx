'use client';

import { useEffect, useState } from 'react';
import type { PendingReviewRow } from '@/lib/types/portalData';
import { QUEUE_REASON_LABELS, TABLE_LABELS, isBoardRow, needsPublish, queueReason, rowTitle } from './PendingReviewTable';

function humanizeKey(key: string): string {
  return key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (Array.isArray(value)) return value.length > 0 ? value.join(', ') : '—';
  return String(value);
}

// Raw columns the board block below shows in a readable form instead
const BOARD_HIDDEN_KEYS = new Set([
  'id', 'member_offer', 'mod_scores', 'mod_flags', 'mod_reasons', 'mod_model', 'report_reasons', 'topic_ids',
  'author_id', 'is_system', 'offer_table', 'offer_id', 'member_offer_id', 'verified_by', 'verified_at', 'queue_reason',
]);

const VERIFY_CHECKLIST = [
  'The terms match the source link',
  'The expiry date is correct',
  'It is not a referral or affiliate link',
] as const;

function BoardDetails({ item, isDark }: { item: PendingReviewRow; isDark: boolean }) {
  const r = item.row;
  const ink = isDark ? 'text-gph-dark-ink' : 'text-gray-900';
  const muted = isDark ? 'text-gph-dark-muted' : 'text-gray-500';
  const label = `text-[10px] font-mono font-bold uppercase tracking-widest ${muted}`;
  const scores = (r.mod_scores ?? null) as Record<string, unknown> | null;
  const offer = (r.member_offer ?? null) as Record<string, unknown> | null;
  const reasons = Array.isArray(r.mod_reasons) ? (r.mod_reasons as string[]) : [];
  const flags = Array.isArray(r.mod_flags) ? (r.mod_flags as string[]) : [];
  const reportReasons = Array.isArray(r.report_reasons) ? (r.report_reasons as string[]) : [];
  const reports = Number(r.report_count ?? 0);
  const score = (k: string) => (typeof scores?.[k] === 'number' ? (scores[k] as number).toFixed(2) : null);

  return (
    <div className="space-y-3">
      <div>
        <div className={label}>Why it is here</div>
        <div className={`text-sm font-semibold ${ink}`}>{QUEUE_REASON_LABELS[queueReason(item)!] ?? 'Board item'}</div>
      </div>
      {reasons.length > 0 && (
        <div><div className={label}>Held because</div><div className={`text-sm ${ink}`}>{reasons.map((x) => x.replace(/_/g, ' ')).join(', ')}</div></div>
      )}
      {flags.length > 0 && (
        <div><div className={label}>Flags</div><div className={`text-sm ${ink}`}>{flags.map((x) => x.replace(/_/g, ' ')).join(', ')}</div></div>
      )}
      {scores && (
        <div>
          <div className={label}>Moderation scores</div>
          <div className={`text-sm ${ink}`}>
            {[['toxicity', 'toxicity'], ['spam', 'spam'], ['on_topic', 'on topic']].map(([k, name]) => (score(k) ? `${name} ${score(k)}` : null)).filter(Boolean).join(' · ') || '—'}
          </div>
          {typeof scores.reason === 'string' && <div className={`text-xs mt-0.5 ${muted}`}>{scores.reason}</div>}
        </div>
      )}
      {reports > 0 && (
        <div>
          <div className={label}>Open reports</div>
          <div className={`text-sm ${ink}`}>{reports} · {reportReasons.join(', ') || 'no reason given'}</div>
        </div>
      )}
      {offer && (
        <div>
          <div className={label}>Member-created offer</div>
          <div className={`text-sm ${ink}`}>{String(offer.name ?? '')}</div>
          <div className={`text-xs ${muted}`}>
            {[offer.type, offer.value, offer.from_program && offer.to_program ? `${offer.from_program} → ${offer.to_program}` : offer.from_program, offer.ends_label ? `ends ${offer.ends_label}` : null]
              .filter(Boolean).join(' · ')}
          </div>
          {typeof offer.source_url === 'string' && offer.source_url && (
            <a href={offer.source_url} target="_blank" rel="noreferrer" className={`text-xs font-mono underline break-all ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>{offer.source_url}</a>
          )}
        </div>
      )}
    </div>
  );
}

interface Props {
  item: PendingReviewRow;
  isDark: boolean;
  isPending: boolean;
  onApprove: () => void;
  onReject: () => void;
  onClose: () => void;
}

export function PendingReviewDetailModal({ item, isDark, isPending, onApprove, onReject, onClose }: Props) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  const ink     = isDark ? 'text-gph-dark-ink'   : 'text-gray-900';
  const muted   = isDark ? 'text-gph-dark-muted' : 'text-gray-500';
  const body    = isDark ? 'bg-gph-dark-card'    : 'bg-white';
  const line    = isDark ? 'border-gph-dark-line' : 'border-gray-100';
  const closeBt = isDark ? 'bg-white/10 text-gph-dark-ink hover:bg-white/20' : 'bg-gray-100 text-gray-700 hover:bg-gray-200';

  const board = isBoardRow(item);
  const publish = needsPublish(item);
  const verifying = board && queueReason(item) === 'offer_review' && !publish;
  const [ticked, setTicked] = useState<boolean[]>(() => VERIFY_CHECKLIST.map(() => false));
  const checklistDone = !verifying || ticked.every(Boolean);
  const fields = Object.entries(item.row).filter(([key]) => (board ? !BOARD_HIDDEN_KEYS.has(key) : key !== 'id'));
  const approveLabel = publish ? 'Review & publish'
    : queueReason(item) === 'held' ? 'Release'
    : queueReason(item) === 'reported' ? 'Dismiss reports'
    : verifying ? 'Verify offer' : 'Approve';
  const sourceUrl = typeof item.row.source_url === 'string' ? item.row.source_url : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />

      <div
        role="dialog"
        aria-modal="true"
        className={`relative w-full md:max-w-lg max-h-[85vh] overflow-y-auto rounded-t-2xl md:rounded-2xl shadow-2xl border ${line} ${body}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={`sticky top-0 flex items-start justify-between gap-3 px-5 py-4 border-b ${line} ${body}`}>
          <div className="min-w-0">
            <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-mono font-bold mb-2 ${
              item.row.source === 'cron'
                ? isDark ? 'bg-amber-900/40 text-amber-400' : 'bg-amber-50 text-amber-700'
                : isDark ? 'bg-gph-dark-linesoft text-gph-dark-muted' : 'bg-gray-100 text-gray-500'
            }`}>
              {TABLE_LABELS[item.table]} · {board ? QUEUE_REASON_LABELS[queueReason(item)!] ?? 'board' : String(item.row.source ?? '')}
            </span>
            <h2 className={`text-sm font-semibold truncate ${ink}`}>{rowTitle(item)}</h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className={`shrink-0 min-h-11 min-w-11 rounded-full flex items-center justify-center transition-colors ${closeBt}`}
          >
            ✕
          </button>
        </div>

        <div className="px-5 py-4 space-y-3">
          {board && <BoardDetails item={item} isDark={isDark} />}
          {verifying && (
            <fieldset className={`rounded-lg border p-3 ${line}`}>
              <legend className={`px-1 text-[10px] font-mono font-bold uppercase tracking-widest ${muted}`}>Before you verify</legend>
              {VERIFY_CHECKLIST.map((text, i) => (
                <label key={text} className={`flex min-h-11 items-center gap-3 cursor-pointer text-sm ${ink}`}>
                  <input
                    type="checkbox"
                    checked={ticked[i]}
                    onChange={() => setTicked((prev) => prev.map((v, j) => (j === i ? !v : v)))}
                    className="size-4"
                  />
                  {text}
                </label>
              ))}
            </fieldset>
          )}
          {fields.map(([key, value]) => {
            if (key === 'source_url') {
              return sourceUrl ? (
                <div key={key}>
                  <div className={`text-[10px] font-mono font-bold uppercase tracking-widest ${muted}`}>
                    {humanizeKey(key)}
                  </div>
                  <a
                    href={sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className={`text-xs font-mono underline break-all ${isDark ? 'text-blue-400' : 'text-blue-600'}`}
                  >
                    {sourceUrl}
                  </a>
                </div>
              ) : null;
            }
            return (
              <div key={key}>
                <div className={`text-[10px] font-mono font-bold uppercase tracking-widest ${muted}`}>
                  {humanizeKey(key)}
                </div>
                <div className={`text-sm ${ink}`}>{formatValue(value)}</div>
              </div>
            );
          })}
        </div>

        <div className={`sticky bottom-0 flex items-center gap-2 px-5 py-4 border-t ${line} ${body}`}>
          {!board && item.row.status !== 'pending' ? (
            <span className={`flex-1 text-center py-2 rounded-md text-sm font-bold ${
              item.row.status === 'approved'
                ? isDark ? 'bg-green-900/40 text-green-400' : 'bg-green-100 text-green-700'
                : isDark ? 'bg-red-900/40 text-red-400' : 'bg-red-100 text-red-700'
            }`}>
              {item.row.status === 'approved' ? 'Approved' : 'Rejected'}
            </span>
          ) : (
            <>
              <button
                disabled={isPending || !checklistDone}
                onClick={onApprove}
                className="flex-1 min-h-11 rounded-md text-sm font-bold bg-green-100 text-green-700 hover:bg-green-200 transition-colors disabled:opacity-50"
              >
                {approveLabel}
              </button>
              <button
                disabled={isPending}
                onClick={onReject}
                className="flex-1 min-h-11 rounded-md text-sm font-bold bg-red-100 text-red-700 hover:bg-red-200 transition-colors disabled:opacity-50"
              >
                {board ? 'Reject…' : 'Reject'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
