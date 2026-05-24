'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
  createTrip, deleteTrip, loadTrips, updateTrip as localUpdate,
  loadTripsFromDb, upsertTripToDb, deleteTripFromDb, migrateLocalTripsToDb,
  type Trip, type Activity,
} from '@/lib/trips';

type DbClient = Awaited<ReturnType<typeof import('@/lib/supabase/client').createClient>>;

export function useTrips() {
  const { user }  = useAuth();
  const [trips, setTrips]       = useState<Trip[]>([]);
  const [syncing, setSyncing]   = useState(false);
  const dbRef = useRef<DbClient | null>(null);

  // ── Bootstrap: load trips from the right source when auth state settles ─────
  useEffect(() => {
    let cancelled = false;

    async function boot() {
      if (user) {
        // Signed in — use Supabase
        const { createClient } = await import('@/lib/supabase/client');
        const db = createClient();
        dbRef.current = db;

        setSyncing(true);

        // Migrate any pre-auth localStorage trips first, then load from DB
        await migrateLocalTripsToDb(db, user.id);
        if (cancelled) return;

        const remote = await loadTripsFromDb(db, user.id);
        if (!cancelled) setTrips(remote);
        setSyncing(false);
      } else {
        // Not signed in — fall back to localStorage
        dbRef.current = null;
        setTrips(
          loadTrips().map((t) => ({
            ...t,
            activities:     t.activities     ?? [],
            pins:           t.pins           ?? [],
            itinerary_days: t.itinerary_days ?? {},
          }))
        );
      }
    }

    boot();
    return () => { cancelled = true; };
  }, [user]);

  // ── Helpers: write to Supabase or localStorage depending on auth ────────────

  async function persist(trip: Trip) {
    if (dbRef.current) {
      await upsertTripToDb(dbRef.current, trip);
    } else {
      localUpdate(trip.id, trip);
    }
  }

  // ── Public API ───────────────────────────────────────────────────────────────

  const addTrip = useCallback(async (input: Omit<Trip, 'id' | 'user_id' | 'created_at' | 'activities' | 'pins'>) => {
    if (dbRef.current && user) {
      const trip: Trip = {
        ...input,
        activities:     [],
        pins:           [],
        itinerary_days: {},
        id:             crypto.randomUUID(),
        user_id:        user.id,
        created_at:     new Date().toISOString(),
      };
      await upsertTripToDb(dbRef.current, trip);
      setTrips((prev) => [trip, ...prev]);
      return trip;
    }
    // Unauthenticated — localStorage path
    const trip = createTrip(input);
    setTrips((prev) => [...prev, trip]);
    return trip;
  }, [user]);

  const removeTrip = useCallback(async (id: string) => {
    if (dbRef.current) {
      await deleteTripFromDb(dbRef.current, id);
    } else {
      deleteTrip(id);
    }
    setTrips((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const updateTrip = useCallback(async (id: string, updates: Partial<Omit<Trip, 'id' | 'user_id' | 'created_at'>>) => {
    setTrips((prev) => {
      const next = prev.map((t) => (t.id === id ? { ...t, ...updates } : t));
      const updated = next.find((t) => t.id === id);
      if (updated) persist(updated);
      return next;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addActivity = useCallback((tripId: string, name: string, address: string): string => {
    const newActivity: Activity = {
      id:       crypto.randomUUID(),
      name,
      address,
      added_at: new Date().toISOString(),
    };
    setTrips((prev) => {
      const next = prev.map((t) =>
        t.id === tripId ? { ...t, activities: [...(t.activities ?? []), newActivity] } : t
      );
      const trip = next.find((t) => t.id === tripId);
      if (trip) persist(trip);
      return next;
    });
    return newActivity.id;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const patchActivity = useCallback((tripId: string, activityId: string, patch: Partial<Omit<Activity, 'id' | 'added_at'>>) => {
    setTrips((prev) => {
      const next = prev.map((t) =>
        t.id === tripId
          ? { ...t, activities: (t.activities ?? []).map((a) => a.id === activityId ? { ...a, ...patch } : a) }
          : t
      );
      const trip = next.find((t) => t.id === tripId);
      if (trip) persist(trip);
      return next;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const removeActivity = useCallback((tripId: string, activityId: string) => {
    setTrips((prev) => {
      const next = prev.map((t) =>
        t.id === tripId ? { ...t, activities: (t.activities ?? []).filter((a) => a.id !== activityId) } : t
      );
      const trip = next.find((t) => t.id === tripId);
      if (trip) persist(trip);
      return next;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
      if (trip) persist(trip);
      return next;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const removeActivityFromDay = useCallback((tripId: string, date: string, activityId: string) => {
    setTrips((prev) => {
      const next = prev.map((t) => {
        if (t.id !== tripId) return t;
        const days = t.itinerary_days ?? {};
        return { ...t, itinerary_days: { ...days, [date]: (days[date] ?? []).filter((a) => a.id !== activityId) } };
      });
      const trip = next.find((t) => t.id === tripId);
      if (trip) persist(trip);
      return next;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
      if (trip) persist(trip);
      return next;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const reorderActivityInDay = useCallback((tripId: string, date: string, fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return;
    setTrips((prev) => {
      const next = prev.map((t) => {
        if (t.id !== tripId) return t;
        const days = t.itinerary_days ?? {};
        const items = [...(days[date] ?? [])];
        const [moved] = items.splice(fromIndex, 1);
        const insertAt = toIndex > fromIndex ? toIndex - 1 : toIndex;
        items.splice(insertAt, 0, moved);
        return { ...t, itinerary_days: { ...days, [date]: items } };
      });
      const trip = next.find((t) => t.id === tripId);
      if (trip) persist(trip);
      return next;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
      if (trip) persist(trip);
      return next;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    trips, syncing,
    addTrip, removeTrip, updateTrip,
    addActivity, patchActivity, removeActivity,
    assignActivityToDay, removeActivityFromDay, patchItineraryActivity,
    reorderActivityInDay, moveActivityToDay,
  };
}
