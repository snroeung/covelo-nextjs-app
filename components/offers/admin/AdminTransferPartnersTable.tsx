'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { trpc } from '@/lib/trpc-client';
import type { TransferPartnerRow } from '@/lib/types/portalData';
import { adminTableTheme, usePendingApproval, PendingBadge, PendingRowActions } from './adminTableShared';

const PORTAL_LABELS: Record<string, string> = {
  chase: 'Chase', amex: 'Amex', c1: 'Capital One', bilt: 'Bilt', citi: 'Citi',
};

interface Props {
  partners: TransferPartnerRow[];
  isDark:   boolean;
  onEdit:   (partner: TransferPartnerRow) => void;
}

export function AdminTransferPartnersTable({ partners, isDark, onEdit }: Props) {
  const queryClient = useQueryClient();

  const { mutate: toggleActive, isPending: isToggling } = useMutation({
    mutationFn: (args: { id: string; active: boolean }) =>
      trpc.portalData.admin.updateTransferPartner.mutate({ id: args.id, active: args.active }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['portalData.listTransferPartners'] }),
  });

  const { approve, reject, approving, rejecting } = usePendingApproval([['portalData.listTransferPartners']]);
  const isPending = isToggling || approving || rejecting;

  const { card, ink, muted, rowHov, divider, headBg } = adminTableTheme(isDark);

  return (
    <div className={`rounded-xl border overflow-hidden ${card}`}>
      <div className={`grid grid-cols-[1fr_auto_auto_auto_auto] gap-4 px-5 py-3 border-b text-[10px] font-mono font-bold tracking-widest ${muted} ${headBg} ${divider}`}>
        <div>PROGRAM</div>
        <div>TYPE</div>
        <div>RATIO</div>
        <div>STATUS</div>
        <div>ACTIONS</div>
      </div>

      {partners.length === 0 && (
        <p className={`px-5 py-8 text-sm text-center ${muted}`}>No transfer partners yet.</p>
      )}

      {partners.map((p, i) => (
        <div
          key={p.id}
          className={`grid grid-cols-[1fr_auto_auto_auto_auto] gap-4 items-center px-5 py-3 transition-colors ${rowHov} ${
            i < partners.length - 1 ? `border-b ${divider}` : ''
          }`}
        >
          <div className="min-w-0">
            <div className={`text-sm font-semibold truncate ${ink}`}>{p.program}</div>
            <div className={`text-[11px] font-mono ${muted}`}>{PORTAL_LABELS[p.portal_id]}</div>
          </div>

          <div className={`text-[11px] font-mono capitalize ${muted}`}>{p.type}</div>
          <div className={`text-[11px] font-mono ${muted}`}>{p.ratio}</div>

          <div>
            <PendingBadge pending={p.status === 'pending'} active={p.active} isDark={isDark} />
          </div>

          <div className="flex items-center gap-2">
            <PendingRowActions
              isDark={isDark}
              pending={p.status === 'pending'}
              disabled={isPending}
              itemLabel={p.program}
              onApprove={() => approve({ id: p.id, table: 'transfer_partners' })}
              onReject={() => reject({ id: p.id, table: 'transfer_partners' })}
              onEdit={() => onEdit(p)}
              active={p.active}
              onToggleActive={(next) => toggleActive({ id: p.id, active: next })}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
