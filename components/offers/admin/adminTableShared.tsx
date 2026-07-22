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

// Generic approve/reject mutations against the shared portalData.admin
// procedures. `extraInvalidateKeys` lets each table also invalidate its own
// list query on top of the shared pending-review list.
export function usePendingApproval(extraInvalidateKeys: unknown[][] = []) {
  const queryClient = useQueryClient();
  const invalidate = () => {
    for (const key of extraInvalidateKeys) queryClient.invalidateQueries({ queryKey: key });
    queryClient.invalidateQueries({ queryKey: ['portalData.admin.listAll'] });
  };

  const { mutate: approve, isPending: approving } = useMutation({
    mutationFn: (args: { id: string; table: PendingTableName }) => trpc.portalData.admin.approve.mutate(args),
    onSuccess: invalidate,
  });

  const { mutate: reject, isPending: rejecting } = useMutation({
    mutationFn: (args: { id: string; table: PendingTableName }) => trpc.portalData.admin.reject.mutate(args),
    onSuccess: invalidate,
  });

  return { approve, reject, approving, rejecting };
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
}

// Approve/Reject when the row is pending, else Edit/Deactivate-Reactivate.
export function PendingRowActions({
  isDark, pending, disabled, itemLabel, onApprove, onReject, onEdit, active, onToggleActive, hidePendingActions,
}: PendingRowActionsProps) {
  if (pending) {
    if (hidePendingActions) return null;
    return (
      <>
        <button
          disabled={disabled}
          onClick={onApprove}
          className="px-2.5 py-1 rounded-md text-[11px] font-bold bg-green-100 text-green-700 hover:bg-green-200 transition-colors disabled:opacity-50"
        >
          Approve
        </button>
        <button
          disabled={disabled}
          onClick={() => { if (window.confirm(`Reject "${itemLabel}"?`)) onReject?.(); }}
          className="px-2.5 py-1 rounded-md text-[11px] font-bold bg-red-100 text-red-700 hover:bg-red-200 transition-colors disabled:opacity-50"
        >
          Reject
        </button>
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
      <button
        disabled={disabled}
        onClick={() => {
          const next = !active;
          if (!next && !window.confirm(`Deactivate "${itemLabel}"?`)) return;
          onToggleActive(next);
        }}
        className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-colors disabled:opacity-50 ${
          active ? 'bg-red-100 text-red-700 hover:bg-red-200' : 'bg-green-100 text-green-700 hover:bg-green-200'
        }`}
      >
        {active ? 'Deactivate' : 'Reactivate'}
      </button>
    </>
  );
}
