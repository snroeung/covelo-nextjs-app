'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { trpc } from '@/lib/trpc-client';
import type { PendingReviewTable as PendingTableName } from '@/lib/types/portalData';

// Shared dark/light Tailwind tokens for the admin pending-review table trio
// (AdminHotelCollectionsTable, AdminTransferPartnersTable, AdminOffersTable).
export function adminTableTheme(isDark: boolean) {
  return {
    card:    isDark ? 'bg-gph-dark-card border-gph-dark-line' : 'bg-white border-gray-200',
    ink:     isDark ? 'text-gph-dark-ink'   : 'text-gray-900',
    muted:   isDark ? 'text-gph-dark-muted' : 'text-gray-500',
    rowHov:  isDark ? 'hover:bg-white/5' : 'hover:bg-gray-50',
    divider: isDark ? 'border-gph-dark-line' : 'border-gray-100',
    headBg:  isDark ? 'bg-gph-dark-bg' : 'bg-gray-50',
  };
}

// Active/schedule lifecycle shared by offers, ads, transfer partners, and
// travel collections — every admin list tab filters on this same set.
export type LifecycleStatus = 'live' | 'scheduled' | 'expired' | 'paused';
export type StatusFilter = 'all' | LifecycleStatus;

export const STATUS_TABS: { key: StatusFilter; label: string }[] = [
  { key: 'all',       label: 'All' },
  { key: 'live',      label: 'Live' },
  { key: 'scheduled', label: 'Scheduled' },
  { key: 'expired',   label: 'Expired' },
  { key: 'paused',    label: 'Paused' },
];

export function StatusFilterTabs({
  value, onChange, counts, filterTabCls, mutedCls,
}: {
  value: StatusFilter;
  onChange: (key: StatusFilter) => void;
  counts: Record<StatusFilter, number>;
  filterTabCls: (active: boolean) => string;
  mutedCls: string;
}) {
  return (
    <div className="flex items-center gap-1 flex-wrap">
      {STATUS_TABS.map((t) => {
        const dotColor =
          t.key === 'live'      ? 'bg-green-500' :
          t.key === 'scheduled' ? 'bg-blue-500' :
          t.key === 'expired'   ? 'bg-red-400' :
          t.key === 'paused'    ? 'bg-gray-400' : undefined;
        return (
          <button key={t.key} onClick={() => onChange(t.key)} className={filterTabCls(value === t.key)}>
            <span className="inline-flex items-center gap-1.5">
              {dotColor && <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotColor}`} />}
              {t.label}
            </span>
            <span className={`ml-1.5 text-[10px] font-mono ${value === t.key ? '' : mutedCls}`}>
              {counts[t.key]}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// Loading/completed feedback for row actions (approve, reject, deactivate,
// reactivate). "done" holds briefly before the row refreshes into its new
// state — see settleAfterSuccess.
export type ActionStatus = 'idle' | 'loading' | 'done';

const ACTION_SETTLE_MS = 700;

export function rowActionStatus(
  mutation: { isPending: boolean; isSuccess: boolean; variables?: { id?: string } },
  id: string,
): ActionStatus {
  if (mutation.variables?.id !== id) return 'idle';
  if (mutation.isPending) return 'loading';
  if (mutation.isSuccess) return 'done';
  return 'idle';
}

// Delay invalidation (and reset the mutation) so the "done" state is visible
// on the row for a beat before it refreshes into its new status. reset() only
// fires once the refetch settles — otherwise it flips isSuccess back to false
// (idle buttons) before the row's data has actually updated.
export function settleAfterSuccess(invalidate: () => unknown, reset: () => void) {
  setTimeout(() => { Promise.resolve(invalidate()).finally(reset); }, ACTION_SETTLE_MS);
}

// Card issuer filter shared across Offers, Ads, Transfer partners, and
// Travel collections tabs — a single dropdown instead of a button row.
export type IssuerFilter = 'all' | 'chase' | 'amex' | 'c1' | 'bilt' | 'citi';

export const ISSUER_FILTER_OPTIONS: { key: IssuerFilter; label: string }[] = [
  { key: 'all',   label: 'All issuers' },
  { key: 'chase', label: 'Chase' },
  { key: 'amex',  label: 'Amex' },
  { key: 'c1',    label: 'Capital One' },
  { key: 'bilt',  label: 'Bilt' },
  { key: 'citi',  label: 'Citi' },
];

export function IssuerFilterSelect({
  value, onChange, isDark,
}: {
  value: IssuerFilter;
  onChange: (key: IssuerFilter) => void;
  isDark: boolean;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as IssuerFilter)}
      className={`min-h-11 md:min-h-9 px-3 rounded-lg text-xs font-bold border outline-none cursor-pointer ${
        isDark
          ? 'bg-gph-dark-card border-gph-dark-line text-gph-dark-ink'
          : 'bg-white border-gray-200 text-gray-900'
      }`}
    >
      {ISSUER_FILTER_OPTIONS.map((o) => (
        <option key={o.key} value={o.key}>{o.label}</option>
      ))}
    </select>
  );
}

function Spinner() {
  return (
    <svg className="w-3 h-3 animate-spin" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="2" strokeOpacity="0.25" />
      <path d="M14 8a6 6 0 0 0-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg className="w-3 h-3" viewBox="0 0 16 16" fill="none">
      <path d="M3 8.5l3 3 7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ActionButton({
  onClick, disabled, status, idleLabel, loadingLabel, doneLabel, className,
}: {
  onClick: (e: React.MouseEvent<HTMLButtonElement>) => void;
  disabled?: boolean;
  status: ActionStatus;
  idleLabel: string;
  loadingLabel: string;
  doneLabel: string;
  className: string;
}) {
  return (
    <button
      disabled={disabled || status === 'loading'}
      onClick={onClick}
      className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-colors disabled:opacity-50 inline-flex items-center gap-1.5 ${className}`}
    >
      {status === 'loading' && <Spinner />}
      {status === 'done' && <CheckIcon />}
      {status === 'loading' ? loadingLabel : status === 'done' ? doneLabel : idleLabel}
    </button>
  );
}

// Generic approve/reject mutations against the shared portalData.admin
// procedures. `extraInvalidateKeys` lets each table also invalidate its own
// list query on top of the shared pending-review list.
export function usePendingApproval(extraInvalidateKeys: unknown[][] = []) {
  const queryClient = useQueryClient();
  const invalidate = () => {
    for (const key of extraInvalidateKeys) queryClient.invalidateQueries({ queryKey: key });
    queryClient.invalidateQueries({ queryKey: ['portalData.admin.listAll'] });
  };

  const approveMutation = useMutation({
    mutationFn: (args: { id: string; table: PendingTableName }) => trpc.portalData.admin.approve.mutate(args),
    onSuccess: () => settleAfterSuccess(invalidate, () => approveMutation.reset()),
  });

  const rejectMutation = useMutation({
    mutationFn: (args: { id: string; table: PendingTableName }) => trpc.portalData.admin.reject.mutate(args),
    onSuccess: () => settleAfterSuccess(invalidate, () => rejectMutation.reset()),
  });

  return {
    approve: approveMutation.mutate,
    reject: rejectMutation.mutate,
    approving: approveMutation.isPending,
    rejecting: rejectMutation.isPending,
    approveMutation,
    rejectMutation,
  };
}

export function PendingBadge({ pending, active, isDark }: { pending: boolean; active: boolean; isDark: boolean }) {
  if (pending) {
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
        isDark ? 'bg-amber-900/40 text-amber-400' : 'bg-amber-50 text-amber-700'
      }`}>
        Pending
      </span>
    );
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
      active
        ? isDark ? 'bg-green-900/40 text-green-400' : 'bg-green-50 text-green-700'
        : isDark ? 'bg-gph-dark-linesoft text-gph-dark-muted' : 'bg-gray-100 text-gray-500'
    }`}>
      {active ? 'Active' : 'Inactive'}
    </span>
  );
}

interface PendingRowActionsProps {
  isDark: boolean;
  pending: boolean;
  disabled: boolean;
  itemLabel: string;
  onApprove?: () => void;
  onReject?: () => void;
  onEdit: () => void;
  active: boolean;
  onToggleActive: (next: boolean) => void;
  // When true, pending rows render no actions here — Pending Review tab is
  // the single source of truth for approve/reject on this table.
  hidePendingActions?: boolean;
  approveStatus?: ActionStatus;
  rejectStatus?: ActionStatus;
  toggleStatus?: ActionStatus;
}

// Approve/Reject when the row is pending, else Edit/Deactivate-Reactivate.
export function PendingRowActions({
  isDark, pending, disabled, itemLabel, onApprove, onReject, onEdit, active, onToggleActive, hidePendingActions,
  approveStatus = 'idle', rejectStatus = 'idle', toggleStatus = 'idle',
}: PendingRowActionsProps) {
  if (pending) {
    if (hidePendingActions) return null;
    return (
      <>
        <ActionButton
          disabled={disabled}
          status={approveStatus}
          onClick={() => onApprove?.()}
          idleLabel="Approve" loadingLabel="Approving…" doneLabel="Approved"
          className="bg-green-100 text-green-700 hover:bg-green-200"
        />
        <ActionButton
          disabled={disabled}
          status={rejectStatus}
          onClick={() => { if (window.confirm(`Reject "${itemLabel}"?`)) onReject?.(); }}
          idleLabel="Reject" loadingLabel="Rejecting…" doneLabel="Rejected"
          className="bg-red-100 text-red-700 hover:bg-red-200"
        />
      </>
    );
  }
  return (
    <>
      <button
        onClick={onEdit}
        className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-colors ${
          isDark ? 'bg-gph-dark-linesoft text-gph-dark-ink hover:bg-white/10' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
        }`}
      >
        Edit
      </button>
      <ActionButton
        disabled={disabled}
        status={toggleStatus}
        onClick={() => {
          const next = !active;
          if (!next && !window.confirm(`Deactivate "${itemLabel}"?`)) return;
          onToggleActive(next);
        }}
        idleLabel={active ? 'Deactivate' : 'Reactivate'}
        loadingLabel={active ? 'Deactivating…' : 'Reactivating…'}
        doneLabel={active ? 'Deactivated' : 'Reactivated'}
        className={active ? 'bg-red-100 text-red-700 hover:bg-red-200' : 'bg-green-100 text-green-700 hover:bg-green-200'}
      />
    </>
  );
}
