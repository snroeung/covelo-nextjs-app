'use client';

export const OFFER_CATEGORIES = [
  { key: 'all',      label: 'All offers' },
  { key: 'transfer', label: 'Transfer bonuses' },
  { key: 'spending', label: 'Spending bonuses' },
] as const;

export type OfferCategory = (typeof OFFER_CATEGORIES)[number]['key'];

interface Props {
  selected: OfferCategory;
  onChange: (cat: OfferCategory) => void;
  isDark: boolean;
}

export function OfferCategoryChips({ selected, onChange, isDark }: Props) {
  return (
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
  );
}
