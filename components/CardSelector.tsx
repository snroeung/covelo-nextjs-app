'use client';

import { useState } from 'react';
import { CardId, CARD_NAMES } from '@/lib/points/types';
import { useSelectedCards } from '@/contexts/SelectedCardsContext';
import { useTheme } from '@/contexts/ThemeContext';

const CARD_GROUPS: { issuer: string; cards: CardId[] }[] = [
  { issuer: 'Chase',           cards: ['chase_reserve', 'chase_preferred', 'chase_freedom_unlimited'] },
  { issuer: 'American Express', cards: ['amex_platinum', 'amex_gold', 'amex_green'] },
  { issuer: 'Capital One',     cards: ['c1_venture_x', 'c1_venture', 'c1_savor'] },
  { issuer: 'Bilt',            cards: ['bilt'] },
  { issuer: 'Citi',            cards: ['citi_strata_premier', 'citi_strata_elite'] },
];

const VISIBLE_GROUPS = 3;

export function CardSelector() {
  const { selectedCards, toggleCard } = useSelectedCards();
  const { isDark } = useTheme();
  const [expanded, setExpanded] = useState(false);

  const labelColor  = isDark ? 'text-cv-blue-300' : 'text-cv-blue-900';
  const issuerColor = isDark ? 'text-cv-blue-400' : 'text-cv-blue-900';
  const countColor  = isDark ? 'text-cv-blue-400' : 'text-cv-blue-600';

  const visibleGroups = expanded ? CARD_GROUPS : CARD_GROUPS.slice(0, VISIBLE_GROUPS);
  const hiddenCount   = CARD_GROUPS.slice(VISIBLE_GROUPS).reduce((n, g) => n + g.cards.length, 0);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className={`text-xs font-semibold uppercase tracking-widest ${labelColor}`}>
          Your Cards
        </h2>
        {selectedCards.length > 0 && (
          <span className={`text-xs ${countColor}`}>{selectedCards.length} selected</span>
        )}
      </div>

      <div className="space-y-4">
        {visibleGroups.map(({ issuer, cards }) => (
          <div key={issuer}>
            <p className={`text-[10px] font-semibold uppercase tracking-widest mb-2 ${issuerColor}`}>
              {issuer}
            </p>
            <div className="flex flex-wrap gap-2">
              {cards.map((cardId) => {
                const selected = selectedCards.includes(cardId);
                const base = 'px-3 py-1.5 rounded-full text-xs font-medium border transition-colors cursor-pointer';
                const active = 'bg-cv-blue-600 border-cv-blue-600 text-white';
                const inactive = isDark
                  ? 'bg-transparent border-cv-blue-900 text-cv-blue-300 hover:border-cv-blue-400 hover:text-cv-blue-400'
                  : 'bg-cv-blue-50 border-cv-blue-300 text-cv-blue-950 hover:border-cv-blue-400 hover:text-cv-blue-600';

                return (
                  <button
                    key={cardId}
                    onClick={() => toggleCard(cardId)}
                    aria-pressed={selected}
                    className={`${base} ${selected ? active : inactive}`}
                  >
                    {CARD_NAMES[cardId]}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {CARD_GROUPS.length > VISIBLE_GROUPS && (
        <button
          onClick={() => setExpanded((v) => !v)}
          className={`text-xs font-medium ${countColor} hover:underline`}
        >
          {expanded ? 'View less' : `View more · ${hiddenCount} cards`}
        </button>
      )}
    </div>
  );
}
