'use client';

import { useEffect } from 'react';
import type { TransferBonus, SpendingBonus } from '@/lib/types/offers';

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

function formatDate(iso: string) {
  // Parse as local calendar date, not UTC — see OfferCard.tsx formatEndDate.
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
  });
}

type Props =
  | { type: 'transfer'; offer: TransferBonus; isDark: boolean; onClose: () => void }
  | { type: 'spending'; offer: SpendingBonus; isDark: boolean; onClose: () => void };

export function OfferDetailModal(props: Props) {
  const { type, isDark, onClose } = props;

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Lock scroll while open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  const offer = props.offer;
  const heroColor = ISSUER_HERO_COLOR[offer.issuer] ?? '#1e293b';
  const tags = (offer.tags ?? []);

  const ink   = isDark ? 'text-gph-dark-ink'   : 'text-gray-900';
  const muted = isDark ? 'text-gph-dark-muted' : 'text-gray-500';
  const body  = isDark ? 'bg-gph-dark-card'    : 'bg-white';
  const line  = isDark ? 'border-gph-dark-line' : 'border-gray-100';

  // Derive display values
  let valueLabel: string;
  let valueUnit: string;
  let partnerLabel: string;
  let minimumLabel: string | null = null;

  if (type === 'transfer') {
    const t = props.offer as TransferBonus;
    valueLabel   = `+${t.bonus_pct}%`;
    valueUnit    = `${t.effective_ratio.toFixed(2)}:1 ratio`;
    partnerLabel = t.transfer_partner;
  } else {
    const s = props.offer as SpendingBonus;
    valueLabel = s.bonus_type === 'cash_back_pct'
      ? `${s.bonus_multiplier}%`
      : s.bonus_type === 'dollar_amount'
        ? `$${s.bonus_multiplier}`
        : `${s.bonus_multiplier}×`;
    valueUnit = s.bonus_type === 'cash_back_pct'
      ? 'cash back'
      : s.bonus_type === 'dollar_amount'
        ? 'credit'
        : 'points';
    partnerLabel = s.merchant_name;
    minimumLabel = s.minimum_nights
      ? `${s.minimum_nights} night${s.minimum_nights > 1 ? 's' : ''} minimum nights`
      : s.spending_minimum
        ? `$${s.spending_minimum} minimum spend`
        : null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Panel */}
      <div
        role="dialog"
        aria-modal="true"
        className={`relative w-full max-w-md rounded-2xl overflow-hidden shadow-2xl ${body}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Hero */}
        <div
          className="relative h-40 flex flex-col justify-between p-4"
          style={{ backgroundColor: heroColor, backgroundImage: CROSSHATCH }}
        >
          {/* Close button */}
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
                    {type === 'transfer' ? 'TRANSFER BONUS' : 'SPENDING BONUS'}
                  </span>
                )}
            </div>
            <button
              onClick={onClose}
              className="shrink-0 w-7 h-7 rounded-full bg-black/40 flex items-center justify-center text-white/80 hover:text-white hover:bg-black/60 transition-colors"
              aria-label="Close"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 12 12" fill="none">
                <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </button>
          </div>

          {/* Issuer → partner */}
          <div>
            <p className="text-white/60 text-[10px] font-mono uppercase tracking-widest mb-0.5">
              {ISSUER_LABELS[offer.issuer] ?? offer.issuer} → {partnerLabel}
            </p>
            <p className="text-white font-bold text-lg leading-tight">
              {valueLabel}
              <span className="ml-2 text-white/70 text-sm font-normal font-mono">{valueUnit}</span>
            </p>
          </div>
        </div>

        {/* Body */}
        <div className="p-5 flex flex-col gap-4">

          {/* Minimum */}
          {minimumLabel && (
            <div className={`flex items-center gap-2 text-sm font-mono ${muted}`}>
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.25"/>
                <path d="M8 5v3.5M8 11v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              {minimumLabel}
            </div>
          )}

          {/* Description */}
          {offer.description ? (
            <div>
              <p className={`text-[10px] font-mono font-bold tracking-widest mb-1.5 ${muted}`}>DETAILS</p>
              <p className={`text-sm leading-relaxed ${ink}`}>{offer.description}</p>
            </div>
          ) : (
            <p className={`text-sm italic ${muted}`}>No additional details provided.</p>
          )}

          {/* Metadata row */}
          <div className={`border-t pt-4 grid grid-cols-2 gap-3 ${line}`}>
            <div>
              <p className={`text-[10px] font-mono font-bold tracking-widest mb-0.5 ${muted}`}>EXPIRES</p>
              <p className={`text-sm font-semibold ${ink}`}>{formatDate(offer.end_date)}</p>
            </div>
            <div>
              <p className={`text-[10px] font-mono font-bold tracking-widest mb-0.5 ${muted}`}>COUNTRY</p>
              <p className={`text-sm font-semibold ${ink}`}>{offer.country ?? 'US'}</p>
            </div>
            {offer.is_targeted && (
              <div className="col-span-2">
                <span className={`inline-flex items-center gap-1.5 text-[10px] font-mono font-bold px-2 py-0.5 rounded-md ${
                  isDark ? 'bg-amber-900/40 text-amber-300' : 'bg-amber-100 text-amber-700'
                }`}>
                  TARGETED — may not be available to all cardholders
                </span>
              </div>
            )}
          </div>

          {/* Source link */}
          {offer.source_url ? (
            <a
              href={offer.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-colors ${
                isDark ? 'bg-white text-gray-900 hover:bg-gray-100' : 'bg-gray-900 text-white hover:bg-gray-700'
              }`}
            >
              View source
              <svg className="w-3.5 h-3.5" viewBox="0 0 12 12" fill="none">
                <path d="M2.5 9.5l7-7M9.5 9.5V2.5H2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </a>
          ) : (
            <p className={`text-center text-xs font-mono ${muted}`}>No source URL provided.</p>
          )}
        </div>
      </div>
    </div>
  );
}
