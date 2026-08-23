'use client';

import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { CardId, CARD_PORTAL_MAP } from '@/lib/points/types';
import { useAuth } from '@/contexts/AuthContext';

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

const KNOWN_CARD_IDS = new Set<string>(Object.keys(CARD_PORTAL_MAP));

export function SelectedCardsProvider({ children }: { children: React.ReactNode }) {
  const { user, profile, updateProfile } = useAuth();
  const [selectedCards, setSelectedCards] = useState<CardId[]>([]);
  const [cardBalances, setCardBalances] = useState<Partial<Record<CardId, number>>>({});
  const syncedProfileCards = useRef<string | null>(null);

  useEffect(() => {
    // Deliberately not lazy useState initializers: SSR always renders the
    // empty defaults, so the first client render must match them exactly
    // to avoid a hydration mismatch. Syncing from localStorage one tick
    // later here is the tradeoff, not an oversight.
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (stored) setSelectedCards(JSON.parse(stored));
    } catch {}
    try {
      const stored = localStorage.getItem(CARD_BALANCE_STORAGE_KEY);
      if (stored) setCardBalances(JSON.parse(stored));
    } catch {}
  }, []);

  // The signed-in profile owns the wallet; localStorage is the offline copy.
  // This used to live in ProfilePopup and only ran when localStorage was empty,
  // so cards picked during onboarding — or a card removed later — never reached
  // the points engine unless the user happened to open that popup. Pricing then
  // read a wallet the user hadn't had for weeks and told them a card they hold
  // wasn't in it. Re-syncing on every profile change keeps the two honest;
  // keying on the serialized value leaves local toggles alone in between.
  useEffect(() => {
    const cards = profile?.preferred_cards;
    if (!cards) return;
    const key = JSON.stringify(cards);
    if (syncedProfileCards.current === key) return;
    syncedProfileCards.current = key;
    const known = cards.filter(id => KNOWN_CARD_IDS.has(id)) as CardId[];
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelectedCards(known);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(known)); } catch {}
  }, [profile]);

  /**
   * One write path for the wallet, so the two stores can't drift.
   *
   * The sidebar selector only ever wrote localStorage, while `preferred_cards`
   * moved solely through the profile popup's Save button — so a card removed in
   * the sidebar stayed in the database, and the profile→local sync above would
   * hand it straight back on the next page load. Stamping `syncedProfileCards`
   * with what we just wrote stops the returning row from bouncing the change.
   */
  function persist(next: CardId[]) {
    setSelectedCards(next);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch {}
    if (!user) return;
    syncedProfileCards.current = JSON.stringify(next);
    void updateProfile({ preferred_cards: next }).catch(() => {
      // Offline or RLS refusal: localStorage keeps the change for this session,
      // and the profile wins again on the next load. Better a reverted toggle
      // than a wallet the user can't explain.
      syncedProfileCards.current = null;
    });
  }

  function initCards(cards: CardId[]) {
    persist(cards);
  }

  function toggleCard(cardId: CardId) {
    persist(
      selectedCards.includes(cardId)
        ? selectedCards.filter((c) => c !== cardId)
        : [...selectedCards, cardId],
    );
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
