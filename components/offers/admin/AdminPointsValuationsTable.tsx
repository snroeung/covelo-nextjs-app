'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { trpc } from '@/lib/trpc-client';
import type { PointsValuation } from '@/lib/types/portalData';
import { adminTableTheme, PendingBadge, PendingRowActions, rowActionStatus, settleAfterSuccess, type LifecycleStatus } from './adminTableShared';

export function valuationStatus(v: { active: boolean }): LifecycleStatus {
  return v.active ? 'live' : 'paused';
}

interface Props {
  valuations: PointsValuation[];
  isDark:     boolean;
  onEdit:     (valuation: PointsValuation) => void;
}

export function AdminPointsValuationsTable({ valuations, isDark, onEdit }: Props) {
  const queryClient = useQueryClient();

  const toggleActive = useMutation({
    mutationFn: (args: { id: string; active: boolean }) =>
      trpc.portalData.admin.updatePointsValuation.mutate({ id: args.id, active: args.active }),
    onSuccess: () => settleAfterSuccess(
      () => queryClient.invalidateQueries({ queryKey: ['portalData.admin.listPointsValuations'] }),
      () => toggleActive.reset(),
    ),
  });

  const { card, ink, muted, rowHov, divider, headBg } = adminTableTheme(isDark);

  return (
    <div className={`rounded-xl border overflow-hidden ${card}`}>
      <div className={`grid grid-cols-[1fr_auto_auto_auto_auto] gap-4 px-5 py-3 border-b text-[10px] font-mono font-bold tracking-widest ${muted} ${headBg} ${divider}`}>
        <div>PROGRAM</div>
        <div>CPP</div>
        <div>SOURCE MONTH</div>
        <div>STATUS</div>
        <div>ACTIONS</div>
      </div>

      {valuations.length === 0 && (
        <p className={`px-5 py-8 text-sm text-center ${muted}`}>No points valuations yet.</p>
      )}

      {valuations.map((v, i) => (
        <div
          key={v.id}
          className={`grid grid-cols-[1fr_auto_auto_auto_auto] gap-4 items-center px-5 py-3 transition-colors ${rowHov} ${
            i < valuations.length - 1 ? `border-b ${divider}` : ''
          }`}
        >
          <div className="min-w-0">
            <div className={`text-sm font-semibold truncate ${ink}`}>{v.program}</div>
          </div>

          <div className={`text-[11px] font-mono ${muted}`}>{v.cpp}¢/pt</div>
          <div className={`text-[11px] font-mono ${muted}`}>{v.source_month}</div>

          <div>
            <PendingBadge pending={v.status === 'pending'} active={v.active} isDark={isDark} />
          </div>

          <div className="flex items-center gap-2">
            <PendingRowActions
              isDark={isDark}
              pending={v.status === 'pending'}
              disabled={toggleActive.isPending}
              itemLabel={v.program}
              hidePendingActions
              onEdit={() => onEdit(v)}
              active={v.active}
              onToggleActive={(next) => toggleActive.mutate({ id: v.id, active: next })}
              toggleStatus={rowActionStatus(toggleActive, v.id)}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
