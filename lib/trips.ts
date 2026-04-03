// ─── Data model ────────────────────────────────────────────────────────────────
// Matches the canonical schema:
//   Trip       { id, title, destination, start_date, end_date, user_id }
//   Day        { trip_id, date, order }
//   ItineraryItem { day_id, type, order, time_start, time_end, title, notes,
//                   booking_ref?, source_data? }

export type ItineraryItemType =
  | 'flight'
  | 'hotel'
  | 'activity'
  | 'restaurant'
  | 'transport'
  | 'note';

export interface ItineraryItem {
  id: string;
  day_id: string;
  type: ItineraryItemType;
  order: number;
  time_start?: string; // "HH:MM"
  time_end?: string;   // "HH:MM"
  title: string;
  notes?: string;
  booking_ref?: string;
  source_data?: Record<string, unknown>;
}

export interface Day {
  id: string;
  trip_id: string;
  date: string; // "YYYY-MM-DD"
  order: number;
}

export interface TripTravelers {
  adults: number;
  children: number;
  pets: number;
}

export interface Trip {
  id: string;
  title: string;
  destination: string;          // human-readable place name
  destination_place_id?: string; // Google Places ID for future use
  destination_lat?: number;
  destination_lng?: number;
  start_date: string;  // "YYYY-MM-DD"
  end_date: string;    // "YYYY-MM-DD"
  travelers: TripTravelers;
  user_id: string;     // client-generated UUID until auth is added
  created_at: string;  // ISO timestamp
}

// ─── localStorage helpers ──────────────────────────────────────────────────────

const STORAGE_KEY = 'covelo_trips';

function getUserId(): string {
  const key = 'covelo_user_id';
  let id = typeof window !== 'undefined' ? localStorage.getItem(key) : null;
  if (!id) {
    id = crypto.randomUUID();
    if (typeof window !== 'undefined') localStorage.setItem(key, id);
  }
  return id;
}

export function loadTrips(): Trip[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Trip[]) : [];
  } catch {
    return [];
  }
}

export function saveTrips(trips: Trip[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(trips));
}

export function createTrip(input: Omit<Trip, 'id' | 'user_id' | 'created_at'>): Trip {
  const trip: Trip = {
    ...input,
    id: crypto.randomUUID(),
    user_id: getUserId(),
    created_at: new Date().toISOString(),
  };
  const trips = loadTrips();
  saveTrips([...trips, trip]);
  return trip;
}

export function deleteTrip(id: string): void {
  saveTrips(loadTrips().filter((t) => t.id !== id));
}
