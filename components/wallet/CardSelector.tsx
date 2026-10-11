'use client';

import { useState } from 'react';
import { CardId, CARD_NAMES } from '@/lib/points/types';
import { useSelectedCards } from '@/contexts/SelectedCardsContext';
import { useTheme } from '@/contexts/ThemeContext';

const CARD_GROUPS: { issuer: string; cards: CardId[] }[] = [
  { issuer: 'Chase',            cards: ['chase_reserve', 'chase_preferred', 'chase_freedom_unlimited'] },
  { issuer: 'American Express', cards: ['amex_platinum', 'amex_gold', 'amex_green'] },
  { issuer: 'Capital One',      cards: ['c1_venture_x', 'c1_venture', 'c1_savor'] },
  { issuer: 'Bilt',             cards: ['bilt_blue', 'bilt_obsidian', 'bilt_palladium'] },
  { issuer: 'Citi',             cards: ['citi_strata_premier', 'citi_strata_elite'] },
];

const VISIBLE_GROUPS = 3;

export function CardSelector() {
  const { selectedCards, toggleCard } = useSelectedCards();
  const { isDark } = useTheme();
  const [expanded, setExpanded] = useState(false);

  const headingColor  = isDark ? 'text-gph-dark-ink'   : 'text-gray-900';
  const countColor    = isDark ? 'text-gph-dark-muted' : 'text-gray-500';
  const issuerColor   = isDark ? 'text-gph-dark-muted' : 'text-gray-400';

  const visibleGroups = expanded ? CARD_GROUPS : CARD_GROUPS.slice(0, VISIBLE_GROUPS);
  const hiddenCount   = CARD_GROUPS.slice(VISIBLE_GROUPS).reduce((n, g) => n + g.cards.length, 0);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className={`text-sm font-bold tracking-tight ${headingColor}`}>
          Your cards
        </h2>
        {selectedCards.length > 0 && (
          <span className={`text-[10px] font-bold font-mono tracking-widest uppercase ${countColor}`}>
            {selectedCards.length} active
          </span>
        )}
      </div>

      <div className="space-y-4">
        {visibleGroups.map(({ issuer, cards }) => (
          <div key={issuer}>
            <p className={`text-[10px] font-bold uppercase tracking-widest mb-2 font-mono ${issuerColor}`}>
              {issuer}
            </p>
            <div className="flex flex-col gap-1.5">
              {cards.map((cardId) => {
                const selected = selectedCards.includes(cardId);
                return (
                  <button
                    key={cardId}
                    onClick={() => toggleCard(cardId)}
                    aria-pressed={selected}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-md border text-sm font-medium transition-colors cursor-pointer text-left
                      ${selected
                        ? isDark
                          ? 'border-gph-dark-action bg-gph-dark-linesoft text-gph-dark-ink'
                          : 'border-gray-900 bg-gray-100 text-gray-900'
                        : isDark
                          ? 'border-gph-dark-line text-gph-dark-muted hover:border-gph-dark-action hover:text-gph-dark-ink'
                          : 'border-gray-200 text-gray-700 hover:border-gray-400'
                      }`}
                  >
                    <span>{CARD_NAMES[cardId]}</span>
                    {selected && (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} className={`${isDark ? 'text-gph-dark-action' : 'text-gray-900'} shrink-0`}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
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
          {expanded ? 'View less' : `+ ${hiddenCount} more cards`}
        </button>
      )}
    </div>
  );
}
