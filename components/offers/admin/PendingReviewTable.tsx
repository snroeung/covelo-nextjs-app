'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { trpc } from '@/lib/trpc-client';
import type { PendingReviewRow, PendingReviewTable as PendingTableName } from '@/lib/types/portalData';
import { PendingReviewDetailModal } from './PendingReviewDetailModal';
import {
  ActionButton, rowActionStatus, settleAfterSuccess,
  IssuerFilterSelect, type IssuerFilter,
} from './adminTableShared';

export const TABLE_LABELS: Record<PendingTableName, string> = {
  transfer_partners: 'Transfer partner',
  travel_collections: 'Travel collection',
  transfer_bonuses:  'Transfer bonus',
  spending_bonuses:  'Spending bonus',
  points_valuations: 'Points valuation',
};

type TableFilter = 'all' | PendingTableName;

const TABLE_FILTER_TABS: { key: TableFilter; label: string }[] = [
  { key: 'all',               label: 'All' },
  { key: 'transfer_partners', label: 'Transfer partner' },
  { key: 'travel_collections', label: 'Travel collection' },
  { key: 'transfer_bonuses',  label: 'Transfer bonus' },
  { key: 'spending_bonuses',  label: 'Spending bonus' },
  { key: 'points_valuations', label: 'Points valuation' },
];

export function rowTitle(item: PendingReviewRow): string {
  const r = item.row;
  switch (item.table) {
    case 'transfer_partners':
      return `${r.portal_id} → ${r.program}`;
    case 'travel_collections':
      return `${r.issuer} · ${r.collection_name}${r.property_name ? ` — ${r.property_name}` : ''}`;
    case 'transfer_bonuses':
      return `${r.issuer} → ${r.transfer_partner}`;
    case 'spending_bonuses':
      return `${r.issuer} · ${r.merchant_name}`;
    case 'points_valuations':
      return String(r.program);
  }
}

export function rowDetail(item: PendingReviewRow): string {
  const r = item.row;
  switch (item.table) {
    case 'transfer_partners':
      return `${r.type} · ratio ${r.ratio}`;
    case 'travel_collections':
      return String(r.perk_summary ?? '');
    case 'transfer_bonuses':
      return `+${r.bonus_pct}% bonus`;
    case 'spending_bonuses':
      return r.bonus_type === 'dollar_amount'
        ? `$${r.bonus_multiplier} credit`
        : r.bonus_type === 'cash_back_pct'
          ? `${r.bonus_multiplier}% cash back`
          : `${r.bonus_multiplier}× points`;
    case 'points_valuations':
      return `${r.cpp}¢/pt · ${r.source_month}`;
  }
}

// transfer_partners keys its issuer off portal_id; travel_collections/
// transfer_bonuses/spending_bonuses carry an explicit `issuer` column;
// points_valuations spans every issuer's programs on one page and has
// neither field.
function rowIssuer(item: PendingReviewRow): string {
  return String(item.table === 'transfer_partners' ? item.row.portal_id : item.row.issuer ?? '');
}

function rowKey(item: PendingReviewRow): string {
  return `${item.table}:${item.row.id}`;
}

// transfer_partners rows have no limited_time_offer column at all.
function rowIsLimitedTime(item: PendingReviewRow): boolean {
  return item.row.limited_time_offer === true;
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
  const [tableFilter, setTableFilter] = useState<TableFilter>('all');
  const [issuerFilter, setIssuerFilter] = useState<IssuerFilter>('all');
  const [detailItem, setDetailItem] = useState<PendingReviewRow | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Approving/rejecting can touch any of the 4 pending-review tables (a bulk
  // approve can span several at once), so invalidate every client cache that
  // reads from them — not just this table's own list. Without this, e.g. an
  // approved transfer partner keeps showing the pre-approval list in the New
  // Offer editor's partner dropdown, in usePointsCalc (so TransferBonusBanner
  // doesn't pick it up either), and in the Transfer Partners/Travel
  // Collections/Offers admin tabs, until a full page reload.
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['portalData.admin.listAll'] });
    queryClient.invalidateQueries({ queryKey: ['portalData.transferPartners'] });
    queryClient.invalidateQueries({ queryKey: ['portalData.listTransferPartners'] });
    queryClient.invalidateQueries({ queryKey: ['portalData.listTravelCollections'] });
    queryClient.invalidateQueries({ queryKey: ['offers.admin.listAll'] });
    queryClient.invalidateQueries({ queryKey: ['offers.transferBonuses'] });
    queryClient.invalidateQueries({ queryKey: ['offers.spendingBonuses'] });
  };

  const approveMutation = useMutation({
    mutationFn: (args: { table: PendingTableName; id: string; runId?: string; edits?: Record<string, string> }) =>
      trpc.portalData.admin.approve.mutate(args),
    onSuccess: () => {
      setEditingId(null);
      setEditField(null);
      settleAfterSuccess(invalidate, () => approveMutation.reset());
    },
  });

  const rejectMutation = useMutation({
    mutationFn: (args: { table: PendingTableName; id: string }) =>
      trpc.portalData.admin.reject.mutate(args),
    onSuccess: () => settleAfterSuccess(invalidate, () => rejectMutation.reset()),
  });

  const bulkApproveMutation = useMutation({
    mutationFn: (items: PendingReviewRow[]) =>
      Promise.all(items.map((item) =>
        trpc.portalData.admin.approve.mutate({ table: item.table, id: item.row.id as string }),
      )),
    onSuccess: () => {
      setSelected(new Set());
      settleAfterSuccess(invalidate, () => bulkApproveMutation.reset());
    },
  });

  const isPending = approveMutation.isPending || rejectMutation.isPending || bulkApproveMutation.isPending;

  const card    = isDark ? 'bg-gph-dark-card border-gph-dark-line' : 'bg-white border-gray-200';
  const ink     = isDark ? 'text-gph-dark-ink'   : 'text-gray-900';
  const muted   = isDark ? 'text-gph-dark-muted' : 'text-gray-600';
  const rowHov  = isDark ? 'hover:bg-white/5' : 'hover:bg-gray-50';
  const divider = isDark ? 'border-gph-dark-line' : 'border-gray-100';
  const headBg  = isDark ? 'bg-gph-dark-bg' : 'bg-gray-50';

  function filterTabCls(active: boolean) {
    const base = 'px-3 py-1.5 rounded-lg text-xs font-bold transition-colors';
    if (active) return `${base} ${isDark ? 'bg-gph-dark-linesoft text-gph-dark-ink' : 'bg-gray-100 text-gray-900'}`;
    return `${base} ${isDark ? 'text-gph-dark-muted hover:text-gph-dark-ink' : 'text-gray-600 hover:text-gray-700'}`;
  }

  // Approved/rejected rows never show here again — the sync-run stays
  // visible elsewhere, but pending review only ever lists status='pending'.
  const pendingRows = rows.filter((item) => item.row.status === 'pending');
  const issuerRows = pendingRows.filter((item) => issuerFilter === 'all' || rowIssuer(item) === issuerFilter);
  const filteredRows = issuerRows.filter((item) => tableFilter === 'all' || item.table === tableFilter);

  const inputCls = `px-2 py-1 rounded-md text-xs font-mono border outline-none ${
    isDark
      ? 'bg-gph-dark-bg border-gph-dark-line text-gph-dark-ink focus:border-blue-500'
      : 'bg-gray-50 border-gray-200 text-gray-900 focus:border-blue-500'
  }`;

  function startEdit(item: PendingReviewRow) {
    const field = item.table === 'transfer_partners' ? 'ratio'
      : item.table === 'travel_collections' ? 'perk_summary'
      : item.table === 'transfer_bonuses' ? 'bonus_pct'
      : item.table === 'spending_bonuses' ? 'bonus_multiplier'
      : 'cpp';
    setEditingId(item.row.id as string);
    setEditField(field);
    setEditValue(String(item.row[field] ?? ''));
  }

  function submitApprove(item: PendingReviewRow, withEdit: boolean) {
    approveMutation.mutate({
      table: item.table,
      id:    item.row.id as string,
      runId: undefined,
      edits: withEdit && editField ? { [editField]: editValue } : undefined,
    });
  }

  function toggleSelected(item: PendingReviewRow) {
    const key = rowKey(item);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  const allFilteredSelected = filteredRows.length > 0 && filteredRows.every((item) => selected.has(rowKey(item)));

  function toggleSelectAll() {
    setSelected((prev) => {
      if (allFilteredSelected) {
        const next = new Set(prev);
        for (const item of filteredRows) next.delete(rowKey(item));
        return next;
      }
      const next = new Set(prev);
      for (const item of filteredRows) next.add(rowKey(item));
      return next;
    });
  }

  const selectedItems = filteredRows.filter((item) => selected.has(rowKey(item)));

  return (
    <div>
      <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
        <div className="flex flex-wrap gap-1.5">
          {TABLE_FILTER_TABS.map((t) => {
            const count = t.key === 'all' ? issuerRows.length : issuerRows.filter((r) => r.table === t.key).length;
            return (
              <button key={t.key} onClick={() => setTableFilter(t.key)} className={filterTabCls(tableFilter === t.key)}>
                {t.label}
                <span className={`ml-1.5 text-[10px] font-mono ${tableFilter === t.key ? '' : muted}`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
        <IssuerFilterSelect value={issuerFilter} onChange={setIssuerFilter} isDark={isDark} />
      </div>

      {selectedItems.length > 0 && (
        <div className={`flex items-center justify-between gap-3 mb-3 px-4 py-2 rounded-lg border ${
          isDark ? 'bg-gph-dark-card border-gph-dark-line' : 'bg-gray-50 border-gray-200'
        }`}>
          <span className={`text-xs font-mono font-bold ${ink}`}>{selectedItems.length} selected</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSelected(new Set())}
              className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-colors ${
                isDark ? 'bg-gph-dark-linesoft text-gph-dark-ink hover:bg-white/10' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Clear
            </button>
            <ActionButton
              disabled={isPending}
              status={bulkApproveMutation.isPending ? 'loading' : bulkApproveMutation.isSuccess ? 'done' : 'idle'}
              onClick={() => bulkApproveMutation.mutate(selectedItems)}
              idleLabel={`Approve ${selectedItems.length}`}
              loadingLabel="Approving…"
              doneLabel="Approved"
              className="bg-green-100 text-green-700 hover:bg-green-200"
            />
          </div>
        </div>
      )}

      <div className={`rounded-xl border overflow-hidden ${card}`}>
        <div className={`grid grid-cols-[auto_1fr_auto_auto_auto] gap-4 px-5 py-3 border-b text-[10px] font-mono font-bold tracking-widest ${muted} ${headBg} ${divider}`}>
          <input
            type="checkbox"
            checked={allFilteredSelected}
            onChange={toggleSelectAll}
            className="w-4 h-4 cursor-pointer"
            aria-label="Select all"
          />
          <div>RECORD</div>
          <div>TABLE</div>
          <div>SOURCE</div>
          <div>ACTIONS</div>
        </div>

        {filteredRows.length === 0 && (
          <p className={`px-5 py-8 text-sm text-center ${muted}`}>No pending records — the sync queue is clear.</p>
        )}

        {filteredRows.map((item, i) => {
        const id = item.row.id as string;
        const isEditingThis = editingId === id;
        return (
          <div
            key={`${item.table}-${id}`}
            onClick={() => { if (!isEditingThis) setDetailItem(item); }}
            className={`grid grid-cols-[auto_1fr_auto_auto_auto] gap-4 items-start px-5 py-4 transition-colors cursor-pointer ${rowHov} ${
              i < filteredRows.length - 1 ? `border-b ${divider}` : ''
            }`}
          >
            <input
              type="checkbox"
              checked={selected.has(rowKey(item))}
              onChange={() => toggleSelected(item)}
              onClick={(e) => e.stopPropagation()}
              className="w-4 h-4 mt-0.5 cursor-pointer"
              aria-label={`Select ${rowTitle(item)}`}
            />

            <div className="min-w-0">
              <div className="flex items-center gap-1.5 min-w-0">
                <div className={`text-sm font-semibold truncate ${ink}`}>{rowTitle(item)}</div>
                {rowIsLimitedTime(item) && (
                  <span className={`shrink-0 px-1.5 py-0.5 rounded-full text-[9px] font-mono font-bold tracking-widest ${
                    isDark ? 'bg-amber-900/40 text-amber-400' : 'bg-amber-50 text-amber-700'
                  }`}>
                    LIMITED TIME
                  </span>
                )}
              </div>
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
                  onClick={(e) => e.stopPropagation()}
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
                  : isDark ? 'bg-gph-dark-linesoft text-gph-dark-muted' : 'bg-gray-100 text-gray-600'
              }`}>
                {String(item.row.source ?? '')}
              </span>
            </div>

            <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
              {isEditingThis ? (
                <>
                  <ActionButton
                    disabled={isPending}
                    status={rowActionStatus(approveMutation, id)}
                    onClick={(e) => { e.stopPropagation(); submitApprove(item, true); }}
                    idleLabel="Save & approve"
                    loadingLabel="Approving…"
                    doneLabel="Approved"
                    className="bg-green-100 text-green-700 hover:bg-green-200"
                  />
                  <button
                    onClick={(e) => { e.stopPropagation(); setEditingId(null); setEditField(null); }}
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
                    onClick={(e) => { e.stopPropagation(); startEdit(item); }}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-colors ${
                      isDark ? 'bg-gph-dark-linesoft text-gph-dark-ink hover:bg-white/10' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    Edit
                  </button>
                  <ActionButton
                    disabled={isPending}
                    status={rowActionStatus(approveMutation, id)}
                    onClick={(e) => { e.stopPropagation(); submitApprove(item, false); }}
                    idleLabel="Approve"
                    loadingLabel="Approving…"
                    doneLabel="Approved"
                    className="bg-green-100 text-green-700 hover:bg-green-200"
                  />
                  <ActionButton
                    disabled={isPending}
                    status={rowActionStatus(rejectMutation, id)}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (window.confirm(`Reject "${rowTitle(item)}"?`)) {
                        rejectMutation.mutate({ table: item.table, id });
                      }
                    }}
                    idleLabel="Reject"
                    loadingLabel="Rejecting…"
                    doneLabel="Rejected"
                    className="bg-red-100 text-red-700 hover:bg-red-200"
                  />
                </>
              )}
            </div>
          </div>
        );
      })}
      </div>

      {detailItem && (
        <PendingReviewDetailModal
          item={detailItem}
          isDark={isDark}
          isPending={isPending}
          onApprove={() => { submitApprove(detailItem, false); setDetailItem(null); }}
          onReject={() => { rejectMutation.mutate({ table: detailItem.table, id: detailItem.row.id as string }); setDetailItem(null); }}
          onClose={() => setDetailItem(null)}
        />
      )}
    </div>
  );
}
