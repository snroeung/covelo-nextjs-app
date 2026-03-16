'use client';

import { useMemo } from 'react';
import { calcPoints } from '@/lib/points/calcPoints';
import { BookingType, PointsResult } from '@/lib/points/types';
import { useSelectedCards } from '@/contexts/SelectedCardsContext';

/**
 * Calls calcPoints() synchronously (pure, no async).
 * Returns null if no cards are selected or priceUsd is invalid.
 * Memoized — only recalculates when price, bookingType, or selectedCards change.
 */
export function usePointsCalc(priceUsd: number, bookingType: BookingType): PointsResult | null {
  const { selectedCards } = useSelectedCards();

  return useMemo(() => {
    if (priceUsd <= 0) return null;
    try {
      // No cards selected → default to all available cards (shows disclaimer in UI)
      return selectedCards.length === 0
        ? calcPoints(priceUsd, bookingType)
        : calcPoints(priceUsd, bookingType, selectedCards);
    } catch {
      return null;
    }
  }, [priceUsd, bookingType, selectedCards]);
}
