'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { CardId } from '@/lib/points/types';

const STORAGE_KEY = 'milepath_selected_cards';

interface SelectedCardsContextValue {
  selectedCards: CardId[];
  toggleCard: (cardId: CardId) => void;
}

const SelectedCardsContext = createContext<SelectedCardsContextValue | null>(null);

export function SelectedCardsProvider({ children }: { children: React.ReactNode }) {
  const [selectedCards, setSelectedCards] = useState<CardId[]>([]);

  // Hydrate from localStorage after mount (avoids SSR mismatch)
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) setSelectedCards(JSON.parse(stored));
    } catch {
      // corrupt storage — start fresh
    }
  }, []);

  function toggleCard(cardId: CardId) {
    setSelectedCards((prev) => {
      const next = prev.includes(cardId)
        ? prev.filter((c) => c !== cardId)
        : [...prev, cardId];
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  }

  return (
    <SelectedCardsContext.Provider value={{ selectedCards, toggleCard }}>
      {children}
    </SelectedCardsContext.Provider>
  );
}

export function useSelectedCards() {
  const ctx = useContext(SelectedCardsContext);
  if (!ctx) throw new Error('useSelectedCards must be used within SelectedCardsProvider');
  return ctx;
}
