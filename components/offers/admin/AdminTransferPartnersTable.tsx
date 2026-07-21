'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { trpc } from '@/lib/trpc-client';
import type { TransferPartnerRow } from '@/lib/types/portalData';

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

  const { mutate: toggleActive, isPending } = useMutation({
    mutationFn: (args: { id: string; active: boolean }) =>
      trpc.portalData.admin.updateTransferPartner.mutate({ id: args.id, active: args.active }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['portalData.listTransferPartners'] }),
  });

  const card    = isDark ? 'bg-gph-dark-card border-gph-dark-line' : 'bg-white border-gray-200';
  const ink     = isDark ? 'text-gph-dark-ink'   : 'text-gray-900';
  const muted   = isDark ? 'text-gph-dark-muted' : 'text-gray-500';
  const rowHov  = isDark ? 'hover:bg-white/5' : 'hover:bg-gray-50';
  const divider = isDark ? 'border-gph-dark-line' : 'border-gray-100';
  const headBg  = isDark ? 'bg-gph-dark-bg' : 'bg-gray-50';

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
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
              p.active
                ? isDark ? 'bg-green-900/40 text-green-400' : 'bg-green-50 text-green-700'
                : isDark ? 'bg-gph-dark-linesoft text-gph-dark-muted' : 'bg-gray-100 text-gray-500'
            }`}>
              {p.active ? 'Active' : 'Inactive'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => onEdit(p)}
              className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-colors ${
                isDark ? 'bg-gph-dark-linesoft text-gph-dark-ink hover:bg-white/10' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Edit
            </button>
            <button
              disabled={isPending}
              onClick={() => {
                const next = !p.active;
                if (!next && !window.confirm(`Deactivate "${p.program}"?`)) return;
                toggleActive({ id: p.id, active: next });
              }}
              className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-colors disabled:opacity-50 ${
                p.active
                  ? 'bg-red-100 text-red-700 hover:bg-red-200'
                  : 'bg-green-100 text-green-700 hover:bg-green-200'
              }`}
            >
              {p.active ? 'Deactivate' : 'Reactivate'}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
