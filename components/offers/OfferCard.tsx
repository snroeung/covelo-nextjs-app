'use client';

import type { TransferBonus, SpendingBonus } from '@/lib/types/offers';

const ISSUER_COLORS: Record<string, string> = {
  chase:  'bg-blue-100 text-blue-800',
  amex:   'bg-green-100 text-green-800',
  c1:     'bg-red-100 text-red-800',
  bilt:   'bg-amber-100 text-amber-800',
  citi:   'bg-purple-100 text-purple-800',
};

const ISSUER_COLORS_DARK: Record<string, string> = {
  chase:  'bg-blue-900/40 text-blue-300',
  amex:   'bg-green-900/40 text-green-300',
  c1:     'bg-red-900/40 text-red-300',
  bilt:   'bg-amber-900/40 text-amber-300',
  citi:   'bg-purple-900/40 text-purple-300',
};

const ISSUER_LABELS: Record<string, string> = {
  chase: 'Chase',
  amex:  'Amex',
  c1:    'Capital One',
  bilt:  'Bilt',
  citi:  'Citi',
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function daysUntil(iso: string): number {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

interface TransferCardProps {
  offer: TransferBonus;
  isDark: boolean;
}

interface SpendingCardProps {
  offer: SpendingBonus;
  isDark: boolean;
}

export function TransferOfferCard({ offer, isDark }: TransferCardProps) {
  const days = daysUntil(offer.end_date);
  const urgent = days <= 7 && days > 0;

  const card   = isDark ? 'bg-gph-dark-card border-gph-dark-line' : 'bg-white border-gray-200';
  const muted  = isDark ? 'text-gph-dark-muted' : 'text-gray-500';
  const line   = isDark ? 'border-gph-dark-line' : 'border-gray-100';
  const issuerCls = isDark ? (ISSUER_COLORS_DARK[offer.issuer] ?? '') : (ISSUER_COLORS[offer.issuer] ?? '');

  return (
    <div className={`rounded-xl border flex flex-col overflow-hidden ${card}`}>
      <div className="p-4 flex flex-col gap-3 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-md ${issuerCls}`}>
              {ISSUER_LABELS[offer.issuer] ?? offer.issuer.toUpperCase()}
            </span>
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
          {urgent && (
            <span className="shrink-0 text-[10px] font-mono font-bold text-red-500">
              {days}d left
            </span>
          )}
        </div>

        <div>
          <p className={`text-xs font-semibold uppercase tracking-widest mb-1 ${muted}`}>
            {ISSUER_LABELS[offer.issuer]} → {offer.transfer_partner}
          </p>
          <div className="flex items-baseline gap-2">
            <span className={`text-4xl font-bold font-mono tabular-nums ${
              isDark ? 'text-white' : 'text-gray-900'
            }`}>
              +{offer.bonus_pct}%
            </span>
            <span className={`text-xs font-mono ${muted}`}>
              {offer.effective_ratio.toFixed(2)}:1 ratio
            </span>
          </div>
        </div>
      </div>

      <div className={`px-4 py-3 border-t flex items-center justify-between ${line}`}>
        <div className="flex items-center gap-3">
          <span className={`text-[11px] font-mono ${muted}`}>
            Ends {formatDate(offer.end_date)}
          </span>
          {offer.source_url && (
            <a
              href={offer.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className={`text-[11px] font-mono hover:underline ${muted}`}
            >
              source ↗
            </a>
          )}
        </div>
        <span className={`text-[11px] font-mono ${muted}`}>
          {offer.upvotes} votes
        </span>
      </div>
    </div>
  );
}

export function SpendingOfferCard({ offer, isDark }: SpendingCardProps) {
  const days = daysUntil(offer.end_date);
  const urgent = days <= 7 && days > 0;

  const card   = isDark ? 'bg-gph-dark-card border-gph-dark-line' : 'bg-white border-gray-200';
  const muted  = isDark ? 'text-gph-dark-muted' : 'text-gray-500';
  const line   = isDark ? 'border-gph-dark-line' : 'border-gray-100';
  const issuerCls = isDark ? (ISSUER_COLORS_DARK[offer.issuer] ?? '') : (ISSUER_COLORS[offer.issuer] ?? '');

  const valueLabel = offer.bonus_type === 'cash_back_pct'
    ? `${offer.bonus_multiplier}%`
    : `${offer.bonus_multiplier}×`;

  return (
    <div className={`rounded-xl border flex flex-col overflow-hidden ${card}`}>
      <div className="p-4 flex flex-col gap-3 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-md ${issuerCls}`}>
              {ISSUER_LABELS[offer.issuer] ?? offer.issuer.toUpperCase()}
            </span>
            <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-md ${
              isDark ? 'bg-gph-dark-linesoft text-gph-dark-muted' : 'bg-gray-100 text-gray-500'
            }`}>
              {offer.bonus_type === 'cash_back_pct' ? 'CASH BACK' : 'POINTS MULTIPLIER'}
            </span>
            {offer.is_targeted && (
              <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-md ${
                isDark ? 'bg-amber-900/40 text-amber-300' : 'bg-amber-100 text-amber-700'
              }`}>
                TARGETED
              </span>
            )}
          </div>
          {urgent && (
            <span className="shrink-0 text-[10px] font-mono font-bold text-red-500">
              {days}d left
            </span>
          )}
        </div>

        <div>
          <p className={`text-xs font-semibold uppercase tracking-widest mb-1 ${muted}`}>
            {offer.merchant_name}
          </p>
          <div className="flex items-baseline gap-2">
            <span className={`text-4xl font-bold font-mono tabular-nums ${
              isDark ? 'text-white' : 'text-gray-900'
            }`}>
              {valueLabel}
            </span>
            <span className={`text-xs font-mono ${muted}`}>
              {offer.bonus_type === 'cash_back_pct' ? 'cash back' : 'points'}
            </span>
          </div>
        </div>
      </div>

      <div className={`px-4 py-3 border-t flex items-center justify-between ${line}`}>
        <div className="flex items-center gap-3">
          <span className={`text-[11px] font-mono ${muted}`}>
            Ends {formatDate(offer.end_date)}
          </span>
          {offer.source_url && (
            <a
              href={offer.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className={`text-[11px] font-mono hover:underline ${muted}`}
            >
              source ↗
            </a>
          )}
        </div>
        <span className={`text-[11px] font-mono ${muted}`}>
          {offer.upvotes} votes
        </span>
      </div>
    </div>
  );
}
