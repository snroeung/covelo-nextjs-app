'use client';

import { ISSUER_LABELS } from '@/components/offers/OfferCard';
import type { Issuer } from '@/lib/types/offers';

export const OFFER_CATEGORIES = [
  { key: 'all',      label: 'All offers' },
  { key: 'transfer', label: 'Transfer bonuses' },
  { key: 'spending', label: 'Spending bonuses' },
] as const;

export type OfferCategory = (typeof OFFER_CATEGORIES)[number]['key'];

interface Props {
  selected: OfferCategory;
  onChange: (cat: OfferCategory) => void;
  issuer: Issuer | 'all';
  onIssuerChange: (issuer: Issuer | 'all') => void;
  availableIssuers: Issuer[];
  isDark: boolean;
}

export function OfferCategoryChips({ selected, onChange, issuer, onIssuerChange, availableIssuers, isDark }: Props) {
  return (
    <div className="flex items-center gap-4">
      <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
        {OFFER_CATEGORIES.map((cat) => {
          const active = cat.key === selected;
          return (
            <button
              key={cat.key}
              onClick={() => onChange(cat.key)}
              className={`shrink-0 px-4 py-1.5 rounded-full text-sm font-semibold transition-colors ${
                active
                  ? isDark
                    ? 'bg-white text-gray-900'
                    : 'bg-gray-900 text-white'
                  : isDark
                    ? 'border border-gph-dark-line text-gph-dark-muted hover:text-gph-dark-ink'
                    : 'border border-gray-200 text-gray-500 hover:text-gray-900'
              }`}
            >
              {cat.label}
            </button>
          );
        })}
      </div>
      <select
        aria-label="Filter by card company"
        value={issuer}
        onChange={(e) => onIssuerChange(e.target.value as Issuer | 'all')}
        className={`shrink-0 ml-auto min-h-11 rounded-full border px-4 py-1.5 text-sm font-semibold ${
          isDark
            ? 'bg-gph-dark-card border-gph-dark-line text-gph-dark-ink'
            : 'bg-white border-gray-200 text-gray-900'
        }`}
      >
        <option value="all">All cards</option>
        {availableIssuers.map((iss) => (
          <option key={iss} value={iss}>{ISSUER_LABELS[iss] ?? iss}</option>
        ))}
      </select>
    </div>
  );
}
