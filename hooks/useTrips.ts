'use client';

import { useCallback, useEffect, useState } from 'react';
import { createTrip, deleteTrip, loadTrips, type Trip } from '@/lib/trips';

export function useTrips() {
  const [trips, setTrips] = useState<Trip[]>([]);

  // Hydrate from localStorage once mounted (avoids SSR mismatch)
  useEffect(() => {
    setTrips(loadTrips());
  }, []);

  const addTrip = useCallback((input: Omit<Trip, 'id' | 'user_id' | 'created_at'>) => {
    const trip = createTrip(input);
    setTrips((prev) => [...prev, trip]);
    return trip;
  }, []);

  const removeTrip = useCallback((id: string) => {
    deleteTrip(id);
    setTrips((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return { trips, addTrip, removeTrip };
}
