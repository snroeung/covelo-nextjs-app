'use client';

import { useCallback, useEffect, useState } from 'react';
import { createTrip, deleteTrip, loadTrips, updateTrip as updateTripLib, type Trip, type Activity } from '@/lib/trips';

export function useTrips() {
  const [trips, setTrips] = useState<Trip[]>([]);

  // Hydrate from localStorage once mounted (avoids SSR mismatch).
  // Backfill `activities` for trips saved before the field was added.
  useEffect(() => {
    setTrips(loadTrips().map((t) => ({ ...t, activities: t.activities ?? [], pins: t.pins ?? [] })));
  }, []);

  const addTrip = useCallback((input: Omit<Trip, 'id' | 'user_id' | 'created_at' | 'activities' | 'pins'>) => {
    const trip = createTrip(input);
    setTrips((prev) => [...prev, trip]);
    return trip;
  }, []);

  const removeTrip = useCallback((id: string) => {
    deleteTrip(id);
    setTrips((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const updateTrip = useCallback((id: string, updates: Partial<Omit<Trip, 'id' | 'user_id' | 'created_at'>>) => {
    const updated = updateTripLib(id, updates);
    if (updated) setTrips((prev) => prev.map((t) => (t.id === id ? updated : t)));
  }, []);

  const addActivity = useCallback((tripId: string, name: string, address: string): string => {
    const newActivity: Activity = {
      id: crypto.randomUUID(),
      name,
      address,
      added_at: new Date().toISOString(),
    };
    setTrips((prev) => {
      const next = prev.map((t) =>
        t.id === tripId ? { ...t, activities: [...(t.activities ?? []), newActivity] } : t,
      );
      const trip = next.find((t) => t.id === tripId);
      if (trip) updateTripLib(tripId, { activities: trip.activities });
      return next;
    });
    return newActivity.id;
  }, []);

  const patchActivity = useCallback((tripId: string, activityId: string, patch: Partial<Omit<Activity, 'id' | 'added_at'>>) => {
    setTrips((prev) => {
      const next = prev.map((t) =>
        t.id === tripId
          ? { ...t, activities: (t.activities ?? []).map((a) => a.id === activityId ? { ...a, ...patch } : a) }
          : t,
      );
      const trip = next.find((t) => t.id === tripId);
      if (trip) updateTripLib(tripId, { activities: trip.activities });
      return next;
    });
  }, []);

  const removeActivity = useCallback((tripId: string, activityId: string) => {
    setTrips((prev) => {
      const next = prev.map((t) =>
        t.id === tripId ? { ...t, activities: (t.activities ?? []).filter((a) => a.id !== activityId) } : t,
      );
      const trip = next.find((t) => t.id === tripId);
      if (trip) updateTripLib(tripId, { activities: trip.activities });
      return next;
    });
  }, []);

  return { trips, addTrip, removeTrip, updateTrip, addActivity, patchActivity, removeActivity };
}
