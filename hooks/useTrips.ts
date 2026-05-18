'use client';

import { useCallback, useEffect, useState } from 'react';
import { createTrip, deleteTrip, loadTrips, updateTrip as updateTripLib, type Trip, type Activity } from '@/lib/trips';

export function useTrips() {
  const [trips, setTrips] = useState<Trip[]>([]);

  // Hydrate from localStorage once mounted (avoids SSR mismatch).
  // Backfill `activities` for trips saved before the field was added.
  useEffect(() => {
    setTrips(loadTrips().map((t) => ({ ...t, activities: t.activities ?? [], pins: t.pins ?? [], itinerary_days: t.itinerary_days ?? {} })));
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

  const assignActivityToDay = useCallback((tripId: string, date: string, activity: Activity) => {
    setTrips((prev) => {
      const next = prev.map((t) => {
        if (t.id !== tripId) return t;
        const days = t.itinerary_days ?? {};
        const existing = days[date] ?? [];
        if (existing.some((a) => a.id === activity.id)) return t;
        return { ...t, itinerary_days: { ...days, [date]: [...existing, activity] } };
      });
      const trip = next.find((t) => t.id === tripId);
      if (trip) updateTripLib(tripId, { itinerary_days: trip.itinerary_days });
      return next;
    });
  }, []);

  const removeActivityFromDay = useCallback((tripId: string, date: string, activityId: string) => {
    setTrips((prev) => {
      const next = prev.map((t) => {
        if (t.id !== tripId) return t;
        const days = t.itinerary_days ?? {};
        return { ...t, itinerary_days: { ...days, [date]: (days[date] ?? []).filter((a) => a.id !== activityId) } };
      });
      const trip = next.find((t) => t.id === tripId);
      if (trip) updateTripLib(tripId, { itinerary_days: trip.itinerary_days });
      return next;
    });
  }, []);

  const patchItineraryActivity = useCallback((tripId: string, date: string, activityId: string, patch: Partial<Omit<Activity, 'id' | 'added_at'>>) => {
    setTrips((prev) => {
      const next = prev.map((t) => {
        if (t.id !== tripId) return t;
        const days = t.itinerary_days ?? {};
        return {
          ...t,
          itinerary_days: {
            ...days,
            [date]: (days[date] ?? []).map((a) => a.id === activityId ? { ...a, ...patch } : a),
          },
        };
      });
      const trip = next.find((t) => t.id === tripId);
      if (trip) updateTripLib(tripId, { itinerary_days: trip.itinerary_days });
      return next;
    });
  }, []);

  const reorderActivityInDay = useCallback((tripId: string, date: string, fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return;
    setTrips((prev) => {
      const next = prev.map((t) => {
        if (t.id !== tripId) return t;
        const days = t.itinerary_days ?? {};
        const items = [...(days[date] ?? [])];
        const [moved] = items.splice(fromIndex, 1);
        // Adjust insertion index because one item was removed
        const insertAt = toIndex > fromIndex ? toIndex - 1 : toIndex;
        items.splice(insertAt, 0, moved);
        return { ...t, itinerary_days: { ...days, [date]: items } };
      });
      const trip = next.find((t) => t.id === tripId);
      if (trip) updateTripLib(tripId, { itinerary_days: trip.itinerary_days });
      return next;
    });
  }, []);

  const moveActivityToDay = useCallback((tripId: string, sourceDate: string, targetDate: string, activityId: string, targetIndex: number) => {
    setTrips((prev) => {
      const next = prev.map((t) => {
        if (t.id !== tripId) return t;
        const days = t.itinerary_days ?? {};
        const sourceItems = [...(days[sourceDate] ?? [])];
        const actIdx = sourceItems.findIndex((a) => a.id === activityId);
        if (actIdx === -1) return t;
        const [activity] = sourceItems.splice(actIdx, 1);
        const targetItems = [...(days[targetDate] ?? [])];
        targetItems.splice(targetIndex, 0, activity);
        return { ...t, itinerary_days: { ...days, [sourceDate]: sourceItems, [targetDate]: targetItems } };
      });
      const trip = next.find((t) => t.id === tripId);
      if (trip) updateTripLib(tripId, { itinerary_days: trip.itinerary_days });
      return next;
    });
  }, []);

  return { trips, addTrip, removeTrip, updateTrip, addActivity, patchActivity, removeActivity, assignActivityToDay, removeActivityFromDay, patchItineraryActivity, reorderActivityInDay, moveActivityToDay };
}
