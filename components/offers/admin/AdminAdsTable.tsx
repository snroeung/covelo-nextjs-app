'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { trpc } from '@/lib/trpc-client';
import type { SponsoredAd } from '@/lib/types/offers';

interface Props {
  ads: SponsoredAd[];
  onEdit: (ad: SponsoredAd) => void;
  isDark: boolean;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' });
}

export function adStatus(ad: SponsoredAd): 'live' | 'scheduled' | 'expired' | 'paused' {
  if (!ad.active) return 'paused';
  const today = new Date().toISOString().split('T')[0];
  if (ad.start_date && ad.start_date > today) return 'scheduled';
  if (ad.end_date && ad.end_date < today) return 'expired';
  return 'live';
}

export function AdminAdsTable({ ads, onEdit, isDark }: Props) {
  const queryClient = useQueryClient();

  const { mutate: deleteAd, isPending: deactivating } = useMutation({
    mutationFn: (id: string) => trpc.offers.admin.deleteAd.mutate({ id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['offers.admin.listAds'] });
      queryClient.removeQueries({ queryKey: ['offers.featuredAd'] });
    },
  });

  const { mutate: reactivateAd, isPending: reactivating } = useMutation({
    mutationFn: (id: string) => trpc.offers.admin.updateAd.mutate({ id, active: true }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['offers.admin.listAds'] });
      queryClient.removeQueries({ queryKey: ['offers.featuredAd'] });
    },
  });

  const isPending = deactivating || reactivating;

  const card    = isDark ? 'bg-gph-dark-card border-gph-dark-line' : 'bg-white border-gray-200';
  const ink     = isDark ? 'text-gph-dark-ink'   : 'text-gray-900';
  const muted   = isDark ? 'text-gph-dark-muted' : 'text-gray-500';
  const rowHov  = isDark ? 'hover:bg-white/5' : 'hover:bg-gray-50';
  const divider = isDark ? 'border-gph-dark-line' : 'border-gray-100';
  const headBg  = isDark ? 'bg-gph-dark-bg' : 'bg-gray-50';

  return (
    <div className={`rounded-xl border overflow-hidden ${card}`}>
      <div className={`grid grid-cols-[1fr_auto_auto_auto_auto] gap-4 px-5 py-3 border-b text-[10px] font-mono font-bold tracking-widest ${muted} ${headBg} ${divider}`}>
        <div>AD</div>
        <div>IMPR.</div>
        <div>CLICKS</div>
        <div>STATUS</div>
        <div>ACTIONS</div>
      </div>

      {ads.length === 0 && (
        <p className={`px-5 py-8 text-sm text-center ${muted}`}>No ads yet. Create one below.</p>
      )}

      {ads.map((ad, i) => {
        const ctr    = ad.impressions > 0 ? ((ad.clicks / ad.impressions) * 100).toFixed(1) : '—';
        const status = adStatus(ad);
        return (
          <div
            key={ad.id}
            className={`grid grid-cols-[1fr_auto_auto_auto_auto] gap-4 items-center px-5 py-4 transition-colors ${rowHov} ${
              i < ads.length - 1 ? `border-b ${divider}` : ''
            }`}
          >
            <div>
              <div className={`text-sm font-semibold ${ink}`}>{ad.headline}</div>
              <div className={`text-[11px] font-mono mt-0.5 ${muted}`}>
                {ad.partner} · {ad.product} · {ad.country ?? 'US'}
              </div>
              {(ad.start_date || ad.end_date) && (
                <div className={`text-[10px] font-mono mt-0.5 ${muted}`}>
                  {ad.start_date ? formatDate(ad.start_date) : '∞'} → {ad.end_date ? formatDate(ad.end_date) : '∞'}
                </div>
              )}
            </div>

            <div className={`text-sm font-mono tabular-nums shrink-0 ${ink}`}>
              {ad.impressions.toLocaleString()}
            </div>

            <div className={`text-sm font-mono tabular-nums shrink-0 ${ink}`}>
              {ad.clicks.toLocaleString()}
              <span className={`ml-1 text-[10px] ${muted}`}>{ctr}%</span>
            </div>

            <div className="shrink-0">
              <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                status === 'live'      ? 'bg-green-100 text-green-700' :
                status === 'scheduled' ? 'bg-blue-100 text-blue-700' :
                status === 'expired'   ? 'bg-red-100 text-red-600' :
                isDark ? 'bg-gph-dark-linesoft text-gph-dark-muted' : 'bg-gray-100 text-gray-500'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${
                  status === 'live'      ? 'bg-green-500' :
                  status === 'scheduled' ? 'bg-blue-500' :
                  status === 'expired'   ? 'bg-red-400' :
                  'bg-gray-400'
                }`} />
                {status === 'live' ? 'Live' : status === 'scheduled' ? 'Scheduled' : status === 'expired' ? 'Expired' : 'Paused'}
              </span>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => onEdit(ad)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-colors ${
                  isDark
                    ? 'bg-gph-dark-linesoft text-gph-dark-ink hover:bg-white/10'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Edit
              </button>
              {ad.active ? (
                <button
                  disabled={isPending}
                  onClick={() => {
                    if (window.confirm(`Deactivate "${ad.headline}"?`)) deleteAd(ad.id);
                  }}
                  className="px-2.5 py-1 rounded-md text-[11px] font-bold bg-red-100 text-red-700 hover:bg-red-200 transition-colors disabled:opacity-50"
                >
                  {status === 'expired' ? 'Archive' : 'Deactivate'}
                </button>
              ) : (
                <button
                  disabled={isPending}
                  onClick={() => reactivateAd(ad.id)}
                  className="px-2.5 py-1 rounded-md text-[11px] font-bold bg-green-100 text-green-700 hover:bg-green-200 transition-colors disabled:opacity-50"
                >
                  Reactivate
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
