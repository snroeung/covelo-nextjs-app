'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { trpc } from '@/lib/trpc-client';
import type { HotelCollection } from '@/lib/types/portalData';
import { adminTableTheme, usePendingApproval, PendingBadge, PendingRowActions } from './adminTableShared';

const ISSUER_LABELS: Record<string, string> = {
  chase: 'Chase', amex: 'Amex', c1: 'Capital One', bilt: 'Bilt', citi: 'Citi',
};

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

interface Props {
  collections: HotelCollection[];
  isDark:      boolean;
  onEdit:      (collection: HotelCollection) => void;
}

export function AdminHotelCollectionsTable({ collections, isDark, onEdit }: Props) {
  const queryClient = useQueryClient();

  const { mutate: toggleActive, isPending: isToggling } = useMutation({
    mutationFn: (args: { id: string; active: boolean }) =>
      trpc.portalData.admin.updateHotelCollection.mutate({ id: args.id, active: args.active }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['portalData.listHotelCollections'] }),
  });

  const { approve, reject, approving, rejecting } = usePendingApproval([['portalData.listHotelCollections']]);
  const isPending = isToggling || approving || rejecting;

  const { card, ink, muted, rowHov, divider, headBg } = adminTableTheme(isDark);

  return (
    <div className={`rounded-xl border overflow-hidden ${card}`}>
      <div className={`grid grid-cols-[1fr_auto_auto_auto] gap-4 px-5 py-3 border-b text-[10px] font-mono font-bold tracking-widest ${muted} ${headBg} ${divider}`}>
        <div>COLLECTION</div>
        <div>ENDS</div>
        <div>STATUS</div>
        <div>ACTIONS</div>
      </div>

      {collections.length === 0 && (
        <p className={`px-5 py-8 text-sm text-center ${muted}`}>No hotel collections yet.</p>
      )}

      {collections.map((c, i) => (
        <div
          key={c.id}
          className={`grid grid-cols-[1fr_auto_auto_auto] gap-4 items-center px-5 py-3 transition-colors ${rowHov} ${
            i < collections.length - 1 ? `border-b ${divider}` : ''
          }`}
        >
          <div className="min-w-0">
            <div className={`text-sm font-semibold truncate ${ink}`}>
              {c.collection_name}{c.property_name ? ` — ${c.property_name}` : ''}
            </div>
            <div className={`text-[11px] font-mono truncate ${muted}`}>
              {ISSUER_LABELS[c.issuer]} · {c.perk_summary}
            </div>
          </div>

          <div className={`text-[11px] font-mono whitespace-nowrap ${muted}`}>{formatDate(c.end_date)}</div>

          <div>
            <PendingBadge pending={c.status === 'pending'} active={c.active} isDark={isDark} />
          </div>

          <div className="flex items-center gap-2">
            <PendingRowActions
              isDark={isDark}
              pending={c.status === 'pending'}
              disabled={isPending}
              itemLabel={c.collection_name}
              onApprove={() => approve({ id: c.id, table: 'hotel_collections' })}
              onReject={() => reject({ id: c.id, table: 'hotel_collections' })}
              onEdit={() => onEdit(c)}
              active={c.active}
              onToggleActive={(next) => toggleActive({ id: c.id, active: next })}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
