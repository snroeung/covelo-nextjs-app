'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { CardId } from '@/lib/points/types';

const STORAGE_KEY = 'milepath_selected_cards';
const CARD_BALANCE_STORAGE_KEY = 'covelo_card_balances';

interface SelectedCardsContextValue {
  selectedCards: CardId[];
  toggleCard: (cardId: CardId) => void;
  initCards: (cards: CardId[]) => void;
  cardBalances: Partial<Record<CardId, number>>;
  setCardBalance: (cardId: CardId, value: number) => void;
}

const SelectedCardsContext = createContext<SelectedCardsContextValue | null>(null);

export function SelectedCardsProvider({ children }: { children: React.ReactNode }) {
  const [selectedCards, setSelectedCards] = useState<CardId[]>([]);
  const [cardBalances, setCardBalances] = useState<Partial<Record<CardId, number>>>({});

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) setSelectedCards(JSON.parse(stored));
    } catch {}
    try {
      const stored = localStorage.getItem(CARD_BALANCE_STORAGE_KEY);
      if (stored) setCardBalances(JSON.parse(stored));
    } catch {}
  }, []);

  function initCards(cards: CardId[]) {
    setSelectedCards(cards);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(cards)); } catch {}
  }

  function toggleCard(cardId: CardId) {
    setSelectedCards((prev) => {
      const next = prev.includes(cardId)
        ? prev.filter((c) => c !== cardId)
        : [...prev, cardId];
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }

  function setCardBalance(cardId: CardId, value: number) {
    setCardBalances((prev) => {
      const next = { ...prev, [cardId]: value };
      try { localStorage.setItem(CARD_BALANCE_STORAGE_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }

  return (
    <SelectedCardsContext.Provider value={{ selectedCards, toggleCard, initCards, cardBalances, setCardBalance }}>
      {children}
    </SelectedCardsContext.Provider>
  );
}

export function useSelectedCards() {
  const ctx = useContext(SelectedCardsContext);
  if (!ctx) throw new Error('useSelectedCards must be used within SelectedCardsProvider');
  return ctx;
}
