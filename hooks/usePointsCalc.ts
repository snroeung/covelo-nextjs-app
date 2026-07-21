'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { calcPoints } from '@/lib/points/calcPoints';
import { BookingType, FlightContext, PointsResult, PortalId } from '@/lib/points/types';
import { useSelectedCards } from '@/contexts/SelectedCardsContext';
import { trpc } from '@/lib/trpc-client';

/**
 * Calls calcPoints() synchronously (pure, no async).
 * Returns null if no cards are selected or priceUsd is invalid.
 * Memoized — only recalculates when price, bookingType, selectedCards, or flightCtx change.
 */
export function usePointsCalc(
  priceUsd: number,
  bookingType: BookingType,
  flightCtx?: FlightContext,
  portalPrices?: Partial<Record<PortalId, number>>,
  hotelChain?: string | null,
): PointsResult | null {
  const { selectedCards } = useSelectedCards();

  const { data: transferPartners } = useQuery({
    queryKey: ['portalData.transferPartners'],
    queryFn:  () => trpc.portalData.listTransferPartners.query(),
    staleTime: 60 * 60 * 1000,
  });

  return useMemo(() => {
    if (priceUsd <= 0) return null;
    try {
      // No cards selected → default to all available cards (shows disclaimer in UI)
      return selectedCards.length === 0
        ? calcPoints(priceUsd, bookingType, undefined, flightCtx, portalPrices, hotelChain, transferPartners)
        : calcPoints(priceUsd, bookingType, selectedCards, flightCtx, portalPrices, hotelChain, transferPartners);
    } catch {
      return null;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [priceUsd, bookingType, selectedCards,
    flightCtx?.airlineIata, flightCtx?.originIata, flightCtx?.destIata,
    flightCtx?.routeType, flightCtx?.cabin, hotelChain, transferPartners,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    JSON.stringify(portalPrices)]);
}
