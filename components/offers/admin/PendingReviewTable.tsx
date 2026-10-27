'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { trpc } from '@/lib/trpc-client';
import { isBoardPendingTable, type BoardQueueReason, type PendingReviewRow, type PendingReviewTable as PendingTableName } from '@/lib/types/portalData';
import { BOARD_REJECT_REASONS, BOARD_REMOVE_REASONS } from '@/lib/board/constants';
import { Dialog, DialogBody, DialogFooter, DialogHeader } from '@/components/board/shared/Dialog';
import { BTN_DANGER, BTN_GHOST } from '@/components/ui/button';
import { PendingReviewDetailModal } from './PendingReviewDetailModal';
import {
  ActionButton, rowActionStatus, settleAfterSuccess,
  IssuerFilterSelect, type IssuerFilter,
} from './adminTableShared';

// transfer_bonuses/spending_bonuses are edited on the Offers tab, through the
// same AdminOfferEditor a published offer uses — not the single-field inline
// edit the other three pending-review tables fall back to below. Editing
// them is a navigation (onEditOffer, handled by OffersAdminShell), not
// something this table renders itself.
function isOfferTable(table: PendingTableName): table is 'transfer_bonuses' | 'spending_bonuses' {
  return table === 'transfer_bonuses' || table === 'spending_bonuses';
}

export const TABLE_LABELS: Record<PendingTableName, string> = {
  transfer_partners: 'Transfer partner',
  travel_collections: 'Travel collection',
  transfer_bonuses:  'Transfer bonus',
  spending_bonuses:  'Spending bonus',
  points_valuations: 'Points valuation',
  board_posts:       'Board post',
  board_comments:    'Board comment',
};

type TableFilter = 'all' | 'board' | PendingTableName;
type ReasonFilter = 'all' | BoardQueueReason;

const TABLE_FILTER_TABS: { key: TableFilter; label: string }[] = [
  { key: 'all',               label: 'All' },
  { key: 'transfer_partners', label: 'Transfer partner' },
  { key: 'travel_collections', label: 'Travel collection' },
  { key: 'transfer_bonuses',  label: 'Transfer bonus' },
  { key: 'spending_bonuses',  label: 'Spending bonus' },
  { key: 'points_valuations', label: 'Points valuation' },
  { key: 'board',             label: 'From the board' },
];

export const QUEUE_REASON_LABELS: Record<BoardQueueReason, string> = {
  offer_review: 'Offer to verify',
  held:         'Held',
  reported:     'Reported',
};

export function isBoardRow(item: PendingReviewRow): boolean {
  return isBoardPendingTable(item.table);
}

export function queueReason(item: PendingReviewRow): BoardQueueReason | null {
  return isBoardRow(item) ? (item.row.queue_reason as BoardQueueReason) ?? null : null;
}

/** A member-created offer isn't in the catalog yet: it's verified by publishing it, not by approving the post. */
export function needsPublish(item: PendingReviewRow): boolean {
  return item.table === 'board_posts' && queueReason(item) === 'offer_review' && !!item.row.member_offer_id;
}

/** Which list the reject reason comes from, and what it's called. */
export function rejectReasonsFor(item: PendingReviewRow): { reasons: readonly string[]; label: string } {
  return queueReason(item) === 'offer_review'
    ? { reasons: BOARD_REJECT_REASONS, label: 'WHY IS THE OFFER NOT VERIFIED?' }
    : { reasons: BOARD_REMOVE_REASONS, label: 'WHY IS IT COMING DOWN?' };
}

export function rowTitle(item: PendingReviewRow): string {
  const r = item.row;
  switch (item.table) {
    case 'transfer_partners':
      return `${r.portal_id} → ${r.program}`;
    case 'travel_collections': {
      const suffix = r.property_name
        ? ` — ${r.property_name}`
        : r.airline_name
          ? ` — ${r.airline_name}${r.origin_iata_code && r.destination_iata_code ? ` ${r.origin_iata_code}–${r.destination_iata_code}` : ''}`
          : '';
      return `${r.issuer} · ${r.collection_name}${suffix}`;
    }
    case 'transfer_bonuses':
      return `${r.issuer} → ${r.transfer_partner}`;
    case 'spending_bonuses':
      return `${r.issuer} · ${r.merchant_name}`;
    case 'points_valuations':
      return String(r.program);
    case 'board_posts':
      return String(r.title ?? '');
    case 'board_comments':
      return String(r.body ?? '').slice(0, 120);
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
    case 'board_posts':
    case 'board_comments': {
      const reports = Number(r.report_count ?? 0);
      return [
        String(r.author_name ?? 'Member'),
        QUEUE_REASON_LABELS[r.queue_reason as BoardQueueReason]?.toLowerCase() ?? 'board',
        needsPublish(item) ? 'member-created offer' : null,
        reports > 0 ? `${reports} report${reports === 1 ? '' : 's'}` : null,
      ].filter(Boolean).join(' · ');
    }
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
  // Pending transfer_bonuses/spending_bonuses rows edit on the Offers tab —
  // the parent shell owns tab switching and the editingOffer state that
  // opens AdminOfferEditor there, so this table just asks for it.
  onEditOffer: (item: PendingReviewRow) => void;
  // A member-created offer is published through the offer editor, prefilled
  // from the member's submission — the shell opens it on the Offers tab.
  onReviewPublish: (item: PendingReviewRow) => void;
}

export function PendingReviewTable({ rows, isDark, onEditOffer, onReviewPublish }: Props) {
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [editField, setEditField] = useState<string | null>(null);
  const [tableFilter, setTableFilter] = useState<TableFilter>('all');
  const [reasonFilter, setReasonFilter] = useState<ReasonFilter>('all');
  const [rejecting, setRejecting] = useState<PendingReviewRow | null>(null);
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
    mutationFn: (args: { table: PendingTableName; id: string; reason?: string }) =>
      trpc.portalData.admin.reject.mutate(args),
    onSuccess: () => settleAfterSuccess(invalidate, () => rejectMutation.reset()),
  });

  const bulkApproveMutation = useMutation({
    // Member-created offers need the editor, so a bulk approve leaves them out
    mutationFn: (items: PendingReviewRow[]) =>
      Promise.all(items.filter((item) => !needsPublish(item)).map((item) =>
        trpc.portalData.admin.approve.mutate({ table: item.table, id: item.row.id as string }),
      )),
    onSuccess: () => {
      setSelected(new Set());
      settleAfterSuccess(invalidate, () => bulkApproveMutation.reset());
    },
  });

  function approveLabel(item: PendingReviewRow): string {
    if (needsPublish(item)) return 'Review & publish';
    switch (queueReason(item)) {
      case 'offer_review': return 'Verify';
      case 'held':         return 'Release';
      case 'reported':     return 'Dismiss reports';
      default:             return 'Approve';
    }
  }

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
  // Board rows have no status column: being in the list is being pending.
  const pendingRows = rows.filter((item) => isBoardRow(item) || item.row.status === 'pending');
  const issuerRows = pendingRows.filter((item) => issuerFilter === 'all' || rowIssuer(item) === issuerFilter);
  const matchesTable = (item: PendingReviewRow, key: TableFilter) => key === 'all' || (key === 'board' ? isBoardRow(item) : item.table === key);
  const filteredRows = issuerRows
    .filter((item) => matchesTable(item, tableFilter))
    .filter((item) => reasonFilter === 'all' || queueReason(item) === reasonFilter);

  const inputCls = `px-2 py-1 rounded-md text-xs font-mono border outline-none ${
    isDark
      ? 'bg-gph-dark-bg border-gph-dark-line text-gph-dark-ink focus:border-blue-500'
      : 'bg-gray-50 border-gray-200 text-gray-900 focus:border-blue-500'
  }`;

  function startEdit(item: PendingReviewRow) {
    if (isOfferTable(item.table)) {
      onEditOffer(item);
      return;
    }
    const field = item.table === 'transfer_partners' ? 'ratio'
      : item.table === 'travel_collections' ? 'perk_summary'
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
  const approvableItems = selectedItems.filter((item) => !needsPublish(item));
  const skippedCount = selectedItems.length - approvableItems.length;

  return (
    <div>
      <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
        <div className="flex flex-wrap gap-1.5">
          {TABLE_FILTER_TABS.map((t) => {
            const count = issuerRows.filter((r) => matchesTable(r, t.key)).length;
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
        <div className="flex items-center gap-2">
          {tableFilter === 'board' && (
            <select
              aria-label="Filter board items by reason"
              value={reasonFilter}
              onChange={(e) => setReasonFilter(e.target.value as ReasonFilter)}
              className={`px-2 py-1.5 rounded-lg text-xs font-bold border outline-none min-h-11 ${isDark ? 'bg-gph-dark-bg border-gph-dark-line text-gph-dark-ink' : 'bg-white border-gray-200 text-gray-700'}`}
            >
              <option value="all">All reasons</option>
              {(Object.keys(QUEUE_REASON_LABELS) as BoardQueueReason[]).map((r) => <option key={r} value={r}>{QUEUE_REASON_LABELS[r]}</option>)}
            </select>
          )}
          <IssuerFilterSelect value={issuerFilter} onChange={setIssuerFilter} isDark={isDark} />
        </div>
      </div>

      {selectedItems.length > 0 && (
        <div className={`flex items-center justify-between gap-3 mb-3 px-4 py-2 rounded-lg border ${
          isDark ? 'bg-gph-dark-card border-gph-dark-line' : 'bg-gray-50 border-gray-200'
        }`}>
          <span className={`text-xs font-mono font-bold ${ink}`}>
            {selectedItems.length} selected{skippedCount > 0 && ` · ${skippedCount} need Review & publish, skipped`}
          </span>
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
              disabled={isPending || approvableItems.length === 0}
              status={bulkApproveMutation.isPending ? 'loading' : bulkApproveMutation.isSuccess ? 'done' : 'idle'}
              onClick={() => bulkApproveMutation.mutate(approvableItems)}
              idleLabel={`Approve ${approvableItems.length}`}
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
                isBoardRow(item) || item.row.source === 'cron'
                  ? isDark ? 'bg-amber-900/40 text-amber-400' : 'bg-amber-50 text-amber-700'
                  : isDark ? 'bg-gph-dark-linesoft text-gph-dark-muted' : 'bg-gray-100 text-gray-600'
              }`}>
                {isBoardRow(item) ? (QUEUE_REASON_LABELS[queueReason(item)!] ?? 'board').toUpperCase() : String(item.row.source ?? '')}
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
                  {!isBoardRow(item) && (
                    <button
                      onClick={(e) => { e.stopPropagation(); startEdit(item); }}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-colors ${
                        isDark ? 'bg-gph-dark-linesoft text-gph-dark-ink hover:bg-white/10' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      Edit
                    </button>
                  )}
                  <ActionButton
                    disabled={isPending}
                    status={rowActionStatus(approveMutation, id)}
                    onClick={(e) => { e.stopPropagation(); if (needsPublish(item)) onReviewPublish(item); else submitApprove(item, false); }}
                    idleLabel={approveLabel(item)}
                    loadingLabel="Approving…"
                    doneLabel="Approved"
                    className="bg-green-100 text-green-700 hover:bg-green-200"
                  />
                  <ActionButton
                    disabled={isPending}
                    status={rowActionStatus(rejectMutation, id)}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (isBoardRow(item)) setRejecting(item);
                      else if (window.confirm(`Reject "${rowTitle(item)}"?`)) rejectMutation.mutate({ table: item.table, id });
                    }}
                    idleLabel={isBoardRow(item) ? 'Reject…' : 'Reject'}
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
          onApprove={() => { if (needsPublish(detailItem)) onReviewPublish(detailItem); else submitApprove(detailItem, false); setDetailItem(null); }}
          onReject={() => {
            if (isBoardRow(detailItem)) setRejecting(detailItem);
            else rejectMutation.mutate({ table: detailItem.table, id: detailItem.row.id as string });
            setDetailItem(null);
          }}
          onClose={() => setDetailItem(null)}
        />
      )}

      {rejecting && (
        <RejectReasonDialog
          item={rejecting}
          pending={rejectMutation.isPending}
          error={rejectMutation.error instanceof Error ? rejectMutation.error.message : null}
          onCancel={() => { rejectMutation.reset(); setRejecting(null); }}
          onConfirm={(reason) => rejectMutation.mutate(
            { table: rejecting.table, id: rejecting.row.id as string, reason },
            { onSuccess: () => setRejecting(null) },
          )}
        />
      )}
    </div>
  );
}

/** Board rejections need a reason the member sees (offers) or the audit log keeps (removals). */
function RejectReasonDialog({ item, pending, error, onCancel, onConfirm }: {
  item: PendingReviewRow; pending: boolean; error: string | null; onCancel: () => void; onConfirm: (reason: string) => void;
}) {
  const { reasons, label } = rejectReasonsFor(item);
  const [reason, setReason] = useState<string | null>(null);
  const title = queueReason(item) === 'offer_review' ? 'Reject offer' : 'Take down';
  return (
    <Dialog label={title} onClose={onCancel} width="sm">
      <DialogHeader title={title} kicker={rowTitle(item).slice(0, 60)} onClose={onCancel} />
      <DialogBody>
        <fieldset>
          <legend className="mb-1.5 block font-mono text-[10px] font-extrabold tracking-[0.12em] text-gph-muted">{label}</legend>
          <div className="flex flex-col gap-1.5">
            {reasons.map((r) => (
              <label key={r} className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border px-3 text-[13.5px] font-semibold ${reason === r ? 'border-gph-ink bg-gph-linesoft' : 'border-gph-line hover:bg-gph-linesoft'}`}>
                <input type="radio" name="reject-reason" value={r} checked={reason === r} onChange={() => setReason(r)} className="size-4 accent-[var(--gph-action)]" />
                {r}
              </label>
            ))}
          </div>
        </fieldset>
        {error && <p role="alert" className="mt-3 text-[13px] font-semibold text-gph-danger">{error}</p>}
      </DialogBody>
      <DialogFooter>
        <button type="button" onClick={onCancel} className={BTN_GHOST}>Cancel</button>
        <button type="button" disabled={!reason || pending} onClick={() => reason && onConfirm(reason)} className={BTN_DANGER}>
          {pending ? 'Working…' : title}
        </button>
      </DialogFooter>
    </Dialog>
  );
}
