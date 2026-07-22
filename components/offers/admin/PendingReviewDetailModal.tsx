'use client';

import { useEffect } from 'react';
import type { PendingReviewRow } from '@/lib/types/portalData';
import { TABLE_LABELS, rowTitle } from './PendingReviewTable';

function humanizeKey(key: string): string {
  return key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (Array.isArray(value)) return value.length > 0 ? value.join(', ') : '—';
  return String(value);
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

  const fields = Object.entries(item.row).filter(([key]) => key !== 'id');
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
              {TABLE_LABELS[item.table]} · {String(item.row.source ?? '')}
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
          <button
            disabled={isPending}
            onClick={onApprove}
            className="flex-1 min-h-11 rounded-md text-sm font-bold bg-green-100 text-green-700 hover:bg-green-200 transition-colors disabled:opacity-50"
          >
            Approve
          </button>
          <button
            disabled={isPending}
            onClick={onReject}
            className="flex-1 min-h-11 rounded-md text-sm font-bold bg-red-100 text-red-700 hover:bg-red-200 transition-colors disabled:opacity-50"
          >
            Reject
          </button>
        </div>
      </div>
    </div>
  );
}
