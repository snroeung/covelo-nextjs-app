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

  // No staleTime override — unlike transferPartners above, valuations are
  // scraped weekly and only reach this query once an admin approves a
  // pending row, so an already-open tab should pick that up sooner than an
  // hour. Falls back to the 5-min app default in app/providers.tsx.
  const { data: pointsValuations } = useQuery({
    queryKey: ['portalData.pointsValuations'],
    queryFn:  () => trpc.portalData.listPointsValuations.query(),
  });

  return useMemo(() => {
    if (priceUsd <= 0) return null;
    try {
      // No cards selected → default to all available cards (shows disclaimer in UI)
      return selectedCards.length === 0
        ? calcPoints(priceUsd, bookingType, undefined, flightCtx, portalPrices, hotelChain, transferPartners, pointsValuations)
        : calcPoints(priceUsd, bookingType, selectedCards, flightCtx, portalPrices, hotelChain, transferPartners, pointsValuations);
    } catch {
      return null;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [priceUsd, bookingType, selectedCards,
    flightCtx?.airlineIata, flightCtx?.originIata, flightCtx?.destIata,
    flightCtx?.routeType, flightCtx?.cabin, hotelChain, transferPartners, pointsValuations,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    JSON.stringify(portalPrices)]);
}
