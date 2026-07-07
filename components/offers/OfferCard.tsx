'use client';

import { useState } from 'react';
import type { TransferBonus, SpendingBonus } from '@/lib/types/offers';
import { OfferDetailModal } from '@/components/offers/OfferDetailModal';

const ISSUER_LABELS: Record<string, string> = {
  chase: 'Chase',
  amex:  'Amex',
  c1:    'Capital One',
  bilt:  'Bilt',
  citi:  'Citi',
};

const ISSUER_HERO_COLOR: Record<string, string> = {
  chase: '#1d4ed8',
  amex:  '#065f46',
  c1:    '#991b1b',
  bilt:  '#1e293b',
  citi:  '#5b21b6',
};

const CROSSHATCH = `repeating-linear-gradient(
  45deg,
  rgba(255,255,255,0.06) 0px,
  rgba(255,255,255,0.06) 1px,
  transparent 1px,
  transparent 13px
), repeating-linear-gradient(
  -45deg,
  rgba(255,255,255,0.06) 0px,
  rgba(255,255,255,0.06) 1px,
  transparent 1px,
  transparent 13px
)`;

function formatEndDate(iso: string): string {
  // Parse as local calendar date, not UTC — `new Date(iso)` on a bare
  // YYYY-MM-DD string parses as UTC midnight, which renders as the previous
  // day in timezones behind UTC.
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  }).toUpperCase();
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
  const [open, setOpen] = useState(false);
  const days      = daysUntil(offer.end_date);
  const urgent    = days <= 7 && days > 0;
  const heroColor = ISSUER_HERO_COLOR[offer.issuer] ?? '#1e293b';
  const tags      = offer.tags ?? [];

  const card  = isDark ? 'bg-gph-dark-card border-gph-dark-line' : 'bg-white border-gray-200';
  const ink   = isDark ? 'text-gph-dark-ink'   : 'text-gray-900';
  const muted = isDark ? 'text-gph-dark-muted' : 'text-gray-500';
  const line  = isDark ? 'border-gph-dark-line' : 'border-gray-100';

  const heroText = `+${offer.bonus_pct}% transfer to ${offer.transfer_partner}`;

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        onClick={() => setOpen(true)}
        onKeyDown={(e) => e.key === 'Enter' && setOpen(true)}
        className={`rounded-xl border flex flex-col overflow-hidden cursor-pointer transition-shadow hover:shadow-md ${card}`}
      >
        {/* Hero */}
        <div
          className="relative h-36 flex flex-col justify-between p-3"
          style={{ backgroundColor: heroColor, backgroundImage: CROSSHATCH }}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex flex-wrap gap-1.5">
              {tags.length > 0
                ? tags.map((tag) => (
                    <span key={tag} className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-black/50 text-white">
                      {tag.toUpperCase()}
                    </span>
                  ))
                : (
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-black/50 text-white">
                    TRANSFER BONUS
                  </span>
                )}
            </div>
            {urgent && (
              <span className="shrink-0 text-[10px] font-mono font-bold text-red-300 bg-black/40 px-2 py-0.5 rounded">
                {days}d left
              </span>
            )}
          </div>
          <p className="text-white/80 text-[11px] font-mono leading-snug line-clamp-2">
            {heroText.toLowerCase()}
          </p>
        </div>

        {/* Body */}
        <div className="p-4 flex flex-col gap-2 flex-1">
          <p className={`text-xs font-mono ${muted}`}>
            {ISSUER_LABELS[offer.issuer] ?? offer.issuer} → {offer.transfer_partner}
          </p>
          <div className="flex items-baseline gap-2 mt-auto pt-1">
            <span className={`text-4xl font-bold font-mono tabular-nums ${ink}`}>
              +{offer.bonus_pct}%
            </span>
            <span className={`text-xs font-mono ${muted}`}>
              {offer.effective_ratio.toFixed(2)}:1 ratio
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className={`px-4 py-3 border-t flex items-center justify-between gap-3 ${line}`}>
          <span className={`text-[11px] font-mono ${muted}`}>
            Ends {formatEndDate(offer.end_date)}
          </span>
          {offer.source_url && (
            <a
              href={offer.source_url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className={`text-[11px] font-mono hover:underline ${muted}`}
            >
              source ↗
            </a>
          )}
        </div>
      </div>

      {open && (
        <OfferDetailModal
          type="transfer"
          offer={offer}
          isDark={isDark}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

export function SpendingOfferCard({ offer, isDark }: SpendingCardProps) {
  const [open, setOpen] = useState(false);
  const days      = daysUntil(offer.end_date);
  const urgent    = days <= 7 && days > 0;
  const heroColor = ISSUER_HERO_COLOR[offer.issuer] ?? '#1e293b';
  const tags      = offer.tags ?? [];

  const card  = isDark ? 'bg-gph-dark-card border-gph-dark-line' : 'bg-white border-gray-200';
  const ink   = isDark ? 'text-gph-dark-ink'   : 'text-gray-900';
  const muted = isDark ? 'text-gph-dark-muted' : 'text-gray-500';
  const line  = isDark ? 'border-gph-dark-line' : 'border-gray-100';

  const valueLabel = offer.bonus_type === 'cash_back_pct'
    ? `${offer.bonus_multiplier}%`
    : offer.bonus_type === 'dollar_amount'
      ? `$${offer.bonus_multiplier}`
      : `${offer.bonus_multiplier}×`;

  const valueUnit = offer.bonus_type === 'cash_back_pct'
    ? 'cash back'
    : offer.bonus_type === 'dollar_amount'
      ? 'credit'
      : 'points';

  const minimumLabel = offer.minimum_nights
    ? `${offer.minimum_nights} night${offer.minimum_nights > 1 ? 's' : ''} minimum nights`
    : offer.spending_minimum
      ? `$${offer.spending_minimum} minimum spend`
      : null;

  const heroText = `${valueLabel} ${valueUnit} at ${offer.merchant_name}`;

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        onClick={() => setOpen(true)}
        onKeyDown={(e) => e.key === 'Enter' && setOpen(true)}
        className={`rounded-xl border flex flex-col overflow-hidden cursor-pointer transition-shadow hover:shadow-md ${card}`}
      >
        {/* Hero */}
        <div
          className="relative h-36 flex flex-col justify-between p-3"
          style={{ backgroundColor: heroColor, backgroundImage: CROSSHATCH }}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex flex-wrap gap-1.5">
              {tags.length > 0
                ? tags.map((tag) => (
                    <span key={tag} className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-black/50 text-white">
                      {tag.toUpperCase()}
                    </span>
                  ))
                : (
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-black/50 text-white">
                    {offer.bonus_type === 'cash_back_pct'
                      ? 'CASH BACK'
                      : offer.bonus_type === 'dollar_amount'
                        ? 'STATEMENT CREDIT'
                        : 'POINTS MULTIPLIER'}
                  </span>
                )}
            </div>
            {urgent && (
              <span className="shrink-0 text-[10px] font-mono font-bold text-red-300 bg-black/40 px-2 py-0.5 rounded">
                {days}d left
              </span>
            )}
          </div>
          <p className="text-white/80 text-[11px] font-mono leading-snug line-clamp-2">
            {heroText.toLowerCase()}
          </p>
        </div>

        {/* Body */}
        <div className="p-4 flex flex-col gap-2 flex-1">
          <p className={`text-xs font-mono ${muted}`}>
            {ISSUER_LABELS[offer.issuer] ?? offer.issuer} → {offer.merchant_name}
          </p>
          <div className="mt-auto pt-1">
            <div className="flex items-baseline gap-2">
              <span className={`text-4xl font-bold font-mono tabular-nums ${ink}`}>
                {valueLabel}
              </span>
              <span className={`text-xs font-mono ${muted}`}>{valueUnit}</span>
            </div>
            {minimumLabel && (
              <p className={`text-[11px] font-mono mt-0.5 ${muted}`}>{minimumLabel}</p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className={`px-4 py-3 border-t flex items-center justify-between gap-3 ${line}`}>
          <span className={`text-[11px] font-mono ${muted}`}>
            Ends {formatEndDate(offer.end_date)}
          </span>
          {offer.source_url && (
            <a
              href={offer.source_url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className={`text-[11px] font-mono hover:underline ${muted}`}
            >
              source ↗
            </a>
          )}
        </div>
      </div>

      {open && (
        <OfferDetailModal
          type="spending"
          offer={offer}
          isDark={isDark}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
