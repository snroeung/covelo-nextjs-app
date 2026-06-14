'use client';

import type { TransferBonus } from '@/lib/types/offers';

const ISSUER_LABELS: Record<string, string> = {
  chase: 'Chase', amex: 'Amex', c1: 'Capital One', bilt: 'Bilt', citi: 'Citi',
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function daysUntil(iso: string) {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

interface Props {
  offer: TransferBonus;
  isDark: boolean;
}

export function FeaturedOfferHero({ offer, isDark }: Props) {
  const days = daysUntil(offer.end_date);
  const urgent = days <= 7 && days > 0;

  const card    = isDark ? 'bg-gph-dark-card border-gph-dark-line' : 'bg-white border-gray-200';
  const ink     = isDark ? 'text-gph-dark-ink'   : 'text-gray-900';
  const muted   = isDark ? 'text-gph-dark-muted' : 'text-gray-500';
  const line    = isDark ? 'border-gph-dark-line' : 'border-gray-200';
  const subBg   = isDark ? 'bg-gph-dark-bg' : 'bg-gray-50';

  return (
    <div className={`rounded-2xl border overflow-hidden ${card}`}>
      <div className="flex flex-col md:flex-row">
        {/* Left: decorative accent panel */}
        <div className={`md:w-56 shrink-0 flex flex-col items-center justify-center py-10 px-6 gap-2 ${subBg}`}>
          <div className={`text-[10px] font-mono font-bold uppercase tracking-widest mb-1 ${muted}`}>
            ★ Featured
          </div>
          <div className={`text-6xl font-bold font-mono tabular-nums ${isDark ? 'text-white' : 'text-gray-900'}`}>
            +{offer.bonus_pct}%
          </div>
          <div className={`text-xs font-mono text-center ${muted}`}>
            {offer.effective_ratio.toFixed(2)}:1 effective ratio
          </div>
          {urgent && (
            <div className="mt-2 text-[10px] font-mono font-bold text-red-500 uppercase tracking-widest">
              {days} days left
            </div>
          )}
        </div>

        {/* Right: details */}
        <div className={`flex-1 p-6 md:p-8 border-t md:border-t-0 md:border-l ${line}`}>
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-md ${
              isDark ? 'bg-gph-dark-linesoft text-gph-dark-muted' : 'bg-gray-100 text-gray-500'
            }`}>
              TRANSFER BONUS
            </span>
            {offer.is_targeted && (
              <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-md ${
                isDark ? 'bg-amber-900/40 text-amber-300' : 'bg-amber-100 text-amber-700'
              }`}>
                TARGETED
              </span>
            )}
          </div>

          <h2 className={`text-2xl md:text-3xl font-bold tracking-tight mb-1 ${ink}`}>
            {ISSUER_LABELS[offer.issuer] ?? offer.issuer} → {offer.transfer_partner}
          </h2>
          <p className={`text-sm mb-6 ${muted}`}>
            Transfer {ISSUER_LABELS[offer.issuer]} points to {offer.transfer_partner} at a{' '}
            <strong className={ink}>{offer.bonus_pct}% bonus</strong> — every 1,000 points becomes{' '}
            {Math.round(1000 * offer.effective_ratio).toLocaleString()}.
          </p>

          <div className={`flex items-center justify-between pt-4 border-t ${line}`}>
            <span className={`text-xs font-mono ${muted}`}>
              Ends {formatDate(offer.end_date)}
            </span>
            {offer.source_url && (
              <a
                href={offer.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className={`text-xs font-semibold hover:underline ${isDark ? 'text-gph-dark-muted hover:text-gph-dark-ink' : 'text-gray-500 hover:text-gray-900'}`}
              >
                View source ↗
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
