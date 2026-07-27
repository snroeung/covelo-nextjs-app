'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { trpc } from '@/lib/trpc-client';
import type { TravelCollection } from '@/lib/types/portalData';
import { adminTableTheme, PendingBadge, PendingRowActions, rowActionStatus, settleAfterSuccess, type LifecycleStatus } from './adminTableShared';

const ISSUER_LABELS: Record<string, string> = {
  chase: 'Chase', amex: 'Amex', c1: 'Capital One', bilt: 'Bilt', citi: 'Citi',
};

export function collectionStatus(c: { active: boolean; end_date: string | null }): LifecycleStatus {
  if (!c.active) return 'paused';
  const today = new Date().toISOString().split('T')[0];
  if (c.end_date && c.end_date < today) return 'expired';
  return 'live';
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function rowLabel(c: TravelCollection): string {
  if (c.type === 'flight') {
    const parts = [c.airline_name, c.airline_iata_code ? `(${c.airline_iata_code})` : null, c.cabin_class].filter(Boolean);
    return parts.join(' ');
  }
  return c.property_name ?? '';
}

interface Props {
  collections: TravelCollection[];
  isDark:      boolean;
  onEdit:      (collection: TravelCollection) => void;
}

export function AdminTravelCollectionsTable({ collections, isDark, onEdit }: Props) {
  const queryClient = useQueryClient();

  const toggleActive = useMutation({
    mutationFn: (args: { id: string; active: boolean }) =>
      trpc.portalData.admin.updateTravelCollection.mutate({ id: args.id, active: args.active }),
    onSuccess: () => settleAfterSuccess(
      () => queryClient.invalidateQueries({ queryKey: ['portalData.listTravelCollections'] }),
      () => toggleActive.reset(),
    ),
  });

  const { card, ink, muted, rowHov, divider, headBg } = adminTableTheme(isDark);

  return (
    <div className={`rounded-xl border overflow-hidden ${card}`}>
      <div className={`grid grid-cols-[auto_1fr_auto_auto_auto] gap-4 px-5 py-3 border-b text-[10px] font-mono font-bold tracking-widest ${muted} ${headBg} ${divider}`}>
        <div>TYPE</div>
        <div>COLLECTION</div>
        <div>ENDS</div>
        <div>STATUS</div>
        <div>ACTIONS</div>
      </div>

      {collections.length === 0 && (
        <p className={`px-5 py-8 text-sm text-center ${muted}`}>No travel collections yet.</p>
      )}

      {collections.map((c, i) => (
        <div
          key={c.id}
          className={`grid grid-cols-[auto_1fr_auto_auto_auto] gap-4 items-center px-5 py-3 transition-colors ${rowHov} ${
            i < collections.length - 1 ? `border-b ${divider}` : ''
          }`}
        >
          <div className={`text-[10px] font-mono font-bold uppercase ${muted}`}>{c.type}</div>

          <div className="min-w-0">
            <div className={`text-sm font-semibold truncate ${ink}`}>
              {c.collection_name}{rowLabel(c) ? ` — ${rowLabel(c)}` : ''}
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
              disabled={toggleActive.isPending}
              itemLabel={c.collection_name}
              hidePendingActions
              onEdit={() => onEdit(c)}
              active={c.active}
              onToggleActive={(next) => toggleActive.mutate({ id: c.id, active: next })}
              toggleStatus={rowActionStatus(toggleActive, c.id)}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
