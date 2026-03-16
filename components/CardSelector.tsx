'use client';

import { CardId, CARD_NAMES } from '@/lib/points/types';
import { useSelectedCards } from '@/contexts/SelectedCardsContext';

const CARD_GROUPS: { issuer: string; cards: CardId[] }[] = [
  {
    issuer: 'Chase',
    cards: ['chase_reserve', 'chase_preferred', 'chase_freedom_unlimited'],
  },
  {
    issuer: 'American Express',
    cards: ['amex_platinum', 'amex_gold', 'amex_green'],
  },
  {
    issuer: 'Capital One',
    cards: ['c1_venture_x', 'c1_venture', 'c1_savor'],
  },
  {
    issuer: 'Bilt',
    cards: ['bilt'],
  },
  {
    issuer: 'Citi',
    cards: ['citi_strata_premier', 'citi_strata_elite'],
  },
];

export function CardSelector() {
  const { selectedCards, toggleCard } = useSelectedCards();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
          Your Cards
        </h2>
        {selectedCards.length > 0 && (
          <span className="text-xs text-gray-400">{selectedCards.length} selected</span>
        )}
      </div>

      {selectedCards.length === 0 && (
        <p className="text-sm text-gray-400 italic">
          Select the cards you hold to see points estimates.
        </p>
      )}

      <div className="space-y-3">
        {CARD_GROUPS.map(({ issuer, cards }) => (
          <div key={issuer}>
            <p className="text-xs font-medium text-gray-400 mb-1.5">{issuer}</p>
            <div className="flex flex-wrap gap-2">
              {cards.map((cardId) => {
                const selected = selectedCards.includes(cardId);
                return (
                  <button
                    key={cardId}
                    onClick={() => toggleCard(cardId)}
                    aria-pressed={selected}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors cursor-pointer ${
                      selected
                        ? 'bg-blue-600 border-blue-600 text-white'
                        : 'bg-white border-gray-300 text-gray-700 hover:border-blue-400 hover:text-blue-600'
                    }`}
                  >
                    {CARD_NAMES[cardId]}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
