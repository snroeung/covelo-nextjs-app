'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { CardId, PortalId } from '@/lib/points/types';

const STORAGE_KEY = 'milepath_selected_cards';
const BALANCE_STORAGE_KEY = 'covelo_portal_balances';

interface SelectedCardsContextValue {
  selectedCards: CardId[];
  toggleCard: (cardId: CardId) => void;
  portalBalances: Partial<Record<PortalId, number>>;
  setPortalBalance: (portalId: PortalId, value: number) => void;
}

const SelectedCardsContext = createContext<SelectedCardsContextValue | null>(null);

export function SelectedCardsProvider({ children }: { children: React.ReactNode }) {
  const [selectedCards, setSelectedCards] = useState<CardId[]>([]);
  const [portalBalances, setPortalBalances] = useState<Partial<Record<PortalId, number>>>({});

  // Hydrate from localStorage after mount (avoids SSR mismatch)
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) setSelectedCards(JSON.parse(stored));
    } catch {
      // corrupt storage — start fresh
    }
    try {
      const stored = localStorage.getItem(BALANCE_STORAGE_KEY);
      if (stored) setPortalBalances(JSON.parse(stored));
    } catch {}
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

  function setPortalBalance(portalId: PortalId, value: number) {
    setPortalBalances((prev) => {
      const next = { ...prev, [portalId]: value };
      try {
        localStorage.setItem(BALANCE_STORAGE_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  }

  return (
    <SelectedCardsContext.Provider value={{ selectedCards, toggleCard, portalBalances, setPortalBalance }}>
      {children}
    </SelectedCardsContext.Provider>
  );
}

export function useSelectedCards() {
  const ctx = useContext(SelectedCardsContext);
  if (!ctx) throw new Error('useSelectedCards must be used within SelectedCardsProvider');
  return ctx;
}
