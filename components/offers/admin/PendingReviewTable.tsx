'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { trpc } from '@/lib/trpc-client';
import type { PendingReviewRow, PendingReviewTable as PendingTableName } from '@/lib/types/portalData';

const TABLE_LABELS: Record<PendingTableName, string> = {
  transfer_partners: 'Transfer partner',
  hotel_collections: 'Hotel collection',
  transfer_bonuses:  'Transfer bonus',
  spending_bonuses:  'Spending bonus',
};

function rowTitle(item: PendingReviewRow): string {
  const r = item.row;
  switch (item.table) {
    case 'transfer_partners':
      return `${r.portal_id} → ${r.program}`;
    case 'hotel_collections':
      return `${r.issuer} · ${r.collection_name}${r.property_name ? ` — ${r.property_name}` : ''}`;
    case 'transfer_bonuses':
      return `${r.issuer} → ${r.transfer_partner}`;
    case 'spending_bonuses':
      return `${r.issuer} · ${r.merchant_name}`;
  }
}

function rowDetail(item: PendingReviewRow): string {
  const r = item.row;
  switch (item.table) {
    case 'transfer_partners':
      return `${r.type} · ratio ${r.ratio}`;
    case 'hotel_collections':
      return String(r.perk_summary ?? '');
    case 'transfer_bonuses':
      return `+${r.bonus_pct}% bonus`;
    case 'spending_bonuses':
      return `${r.bonus_multiplier}× (${r.bonus_type})`;
  }
}

interface Props {
  rows:   PendingReviewRow[];
  isDark: boolean;
}

export function PendingReviewTable({ rows, isDark }: Props) {
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [editField, setEditField] = useState<string | null>(null);

  const { mutate: approve, isPending: approving } = useMutation({
    mutationFn: (args: { table: PendingTableName; id: string; runId?: string; edits?: Record<string, string> }) =>
      trpc.portalData.admin.approve.mutate(args),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portalData.admin.listAll'] });
      setEditingId(null);
      setEditField(null);
    },
  });

  const { mutate: reject, isPending: rejecting } = useMutation({
    mutationFn: (args: { table: PendingTableName; id: string }) =>
      trpc.portalData.admin.reject.mutate(args),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['portalData.admin.listAll'] }),
  });

  const isPending = approving || rejecting;

  const card    = isDark ? 'bg-gph-dark-card border-gph-dark-line' : 'bg-white border-gray-200';
  const ink     = isDark ? 'text-gph-dark-ink'   : 'text-gray-900';
  const muted   = isDark ? 'text-gph-dark-muted' : 'text-gray-500';
  const rowHov  = isDark ? 'hover:bg-white/5' : 'hover:bg-gray-50';
  const divider = isDark ? 'border-gph-dark-line' : 'border-gray-100';
  const headBg  = isDark ? 'bg-gph-dark-bg' : 'bg-gray-50';
  const inputCls = `px-2 py-1 rounded-md text-xs font-mono border outline-none ${
    isDark
      ? 'bg-gph-dark-bg border-gph-dark-line text-gph-dark-ink focus:border-blue-500'
      : 'bg-gray-50 border-gray-200 text-gray-900 focus:border-blue-500'
  }`;

  function startEdit(item: PendingReviewRow) {
    const field = item.table === 'transfer_partners' ? 'ratio'
      : item.table === 'hotel_collections' ? 'perk_summary'
      : item.table === 'transfer_bonuses' ? 'bonus_pct'
      : 'bonus_multiplier';
    setEditingId(item.row.id as string);
    setEditField(field);
    setEditValue(String(item.row[field] ?? ''));
  }

  function submitApprove(item: PendingReviewRow, withEdit: boolean) {
    approve({
      table: item.table,
      id:    item.row.id as string,
      runId: undefined,
      edits: withEdit && editField ? { [editField]: editValue } : undefined,
    });
  }

  return (
    <div className={`rounded-xl border overflow-hidden ${card}`}>
      <div className={`grid grid-cols-[1fr_auto_auto_auto] gap-4 px-5 py-3 border-b text-[10px] font-mono font-bold tracking-widest ${muted} ${headBg} ${divider}`}>
        <div>RECORD</div>
        <div>TABLE</div>
        <div>SOURCE</div>
        <div>ACTIONS</div>
      </div>

      {rows.length === 0 && (
        <p className={`px-5 py-8 text-sm text-center ${muted}`}>No pending records — the sync queue is clear.</p>
      )}

      {rows.map((item, i) => {
        const id = item.row.id as string;
        const isEditingThis = editingId === id;
        return (
          <div
            key={`${item.table}-${id}`}
            className={`grid grid-cols-[1fr_auto_auto_auto] gap-4 items-start px-5 py-4 transition-colors ${rowHov} ${
              i < rows.length - 1 ? `border-b ${divider}` : ''
            }`}
          >
            <div className="min-w-0">
              <div className={`text-sm font-semibold truncate ${ink}`}>{rowTitle(item)}</div>
              {isEditingThis ? (
                <div className="flex items-center gap-2 mt-1.5">
                  <label className={`text-[10px] font-mono font-bold ${muted}`}>{editField}</label>
                  <input
                    className={inputCls}
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                  />
                </div>
              ) : (
                <div className={`text-[11px] font-mono mt-0.5 truncate ${muted}`}>{rowDetail(item)}</div>
              )}
              {typeof item.row.source_url === 'string' && item.row.source_url && (
                <a
                  href={item.row.source_url}
                  target="_blank"
                  rel="noreferrer"
                  className={`text-[10px] font-mono underline block mt-1 truncate ${isDark ? 'text-blue-400' : 'text-blue-600'}`}
                >
                  {item.row.source_url}
                </a>
              )}
            </div>

            <div className={`text-[10px] font-mono font-bold shrink-0 pt-0.5 ${muted}`}>
              {TABLE_LABELS[item.table]}
            </div>

            <div className="shrink-0 pt-0.5">
              <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                item.row.source === 'cron'
                  ? isDark ? 'bg-amber-900/40 text-amber-400' : 'bg-amber-50 text-amber-700'
                  : isDark ? 'bg-gph-dark-linesoft text-gph-dark-muted' : 'bg-gray-100 text-gray-500'
              }`}>
                {String(item.row.source ?? '')}
              </span>
            </div>

            <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
              {isEditingThis ? (
                <>
                  <button
                    disabled={isPending}
                    onClick={() => submitApprove(item, true)}
                    className="px-2.5 py-1 rounded-md text-[11px] font-bold bg-green-100 text-green-700 hover:bg-green-200 transition-colors disabled:opacity-50"
                  >
                    Save & approve
                  </button>
                  <button
                    onClick={() => { setEditingId(null); setEditField(null); }}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-colors ${
                      isDark ? 'bg-gph-dark-linesoft text-gph-dark-ink hover:bg-white/10' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => startEdit(item)}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-colors ${
                      isDark ? 'bg-gph-dark-linesoft text-gph-dark-ink hover:bg-white/10' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    Edit
                  </button>
                  <button
                    disabled={isPending}
                    onClick={() => submitApprove(item, false)}
                    className="px-2.5 py-1 rounded-md text-[11px] font-bold bg-green-100 text-green-700 hover:bg-green-200 transition-colors disabled:opacity-50"
                  >
                    Approve
                  </button>
                  <button
                    disabled={isPending}
                    onClick={() => {
                      if (window.confirm(`Reject "${rowTitle(item)}"?`)) {
                        reject({ table: item.table, id });
                      }
                    }}
                    className="px-2.5 py-1 rounded-md text-[11px] font-bold bg-red-100 text-red-700 hover:bg-red-200 transition-colors disabled:opacity-50"
                  >
                    Reject
                  </button>
                </>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
