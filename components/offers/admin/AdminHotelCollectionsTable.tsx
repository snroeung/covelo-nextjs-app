'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { trpc } from '@/lib/trpc-client';
import type { HotelCollection } from '@/lib/types/portalData';

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

  const { mutate: toggleActive, isPending } = useMutation({
    mutationFn: (args: { id: string; active: boolean }) =>
      trpc.portalData.admin.updateHotelCollection.mutate({ id: args.id, active: args.active }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['portalData.listHotelCollections'] }),
  });

  const card    = isDark ? 'bg-gph-dark-card border-gph-dark-line' : 'bg-white border-gray-200';
  const ink     = isDark ? 'text-gph-dark-ink'   : 'text-gray-900';
  const muted   = isDark ? 'text-gph-dark-muted' : 'text-gray-500';
  const rowHov  = isDark ? 'hover:bg-white/5' : 'hover:bg-gray-50';
  const divider = isDark ? 'border-gph-dark-line' : 'border-gray-100';
  const headBg  = isDark ? 'bg-gph-dark-bg' : 'bg-gray-50';

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
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
              c.active
                ? isDark ? 'bg-green-900/40 text-green-400' : 'bg-green-50 text-green-700'
                : isDark ? 'bg-gph-dark-linesoft text-gph-dark-muted' : 'bg-gray-100 text-gray-500'
            }`}>
              {c.active ? 'Active' : 'Inactive'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => onEdit(c)}
              className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-colors ${
                isDark ? 'bg-gph-dark-linesoft text-gph-dark-ink hover:bg-white/10' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Edit
            </button>
            <button
              disabled={isPending}
              onClick={() => {
                const next = !c.active;
                if (!next && !window.confirm(`Deactivate "${c.collection_name}"?`)) return;
                toggleActive({ id: c.id, active: next });
              }}
              className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-colors disabled:opacity-50 ${
                c.active
                  ? 'bg-red-100 text-red-700 hover:bg-red-200'
                  : 'bg-green-100 text-green-700 hover:bg-green-200'
              }`}
            >
              {c.active ? 'Deactivate' : 'Reactivate'}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
