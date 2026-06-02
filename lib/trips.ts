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

export interface TripPin {
  id: string;
  label: string;
  lng: number;
  lat: number;
}

export interface Activity {
  id: string;
  name: string;
  address: string;
  added_at: string; // ISO timestamp
  photo_url?: string;
  time?: string;                        // "HH:MM" — scheduled time in itinerary
  duration?: string;                    // e.g. "1h", "30m", "2h 30m"
  price?: number;                       // cost in USD (default 0)
  price_type?: 'per_person' | 'total'; // how the price is applied
  notes?: string;
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
  activities: Activity[];
  pins: TripPin[];
  itinerary_days?: Record<string, Activity[]>; // "YYYY-MM-DD" → activities assigned to that day
  user_id: string;
  created_at: string;  // ISO timestamp
}

// ─── localStorage helpers (used when the user is not signed in) ───────────────

const STORAGE_KEY    = 'covelo_trips';
const LOCAL_USER_KEY = 'covelo_user_id';

export function getLocalUserId(): string {
  if (typeof window === 'undefined') return '';
  let id = localStorage.getItem(LOCAL_USER_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(LOCAL_USER_KEY, id);
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

export function createTrip(input: Omit<Trip, 'id' | 'user_id' | 'created_at' | 'activities' | 'pins'>): Trip {
  const trip: Trip = {
    ...input,
    activities: [],
    pins: [],
    id: crypto.randomUUID(),
    user_id: getLocalUserId(),
    created_at: new Date().toISOString(),
  };
  const trips = loadTrips();
  saveTrips([...trips, trip]);
  return trip;
}

export function deleteTrip(id: string): void {
  saveTrips(loadTrips().filter((t) => t.id !== id));
}

export function updateTrip(id: string, updates: Partial<Omit<Trip, 'id' | 'user_id' | 'created_at'>>): Trip | null {
  const trips = loadTrips();
  const idx = trips.findIndex((t) => t.id === id);
  if (idx === -1) return null;
  const updated = { ...trips[idx], ...updates };
  trips[idx] = updated;
  saveTrips(trips);
  return updated;
}

// ─── Supabase helpers (used when the user is signed in) ───────────────────────

type DbClient = Awaited<ReturnType<typeof import('@/lib/supabase/client').createClient>>;

export async function loadTripsFromDb(db: DbClient, userId: string): Promise<Trip[]> {
  const { data } = await db
    .from('trips')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  return (data ?? []).map(normalizeDbTrip);
}

export async function upsertTripToDb(db: DbClient, trip: Trip): Promise<void> {
  await db.from('trips').upsert(
    { ...trip, updated_at: new Date().toISOString() },
    { onConflict: 'id' }
  );
}

export async function deleteTripFromDb(db: DbClient, id: string): Promise<void> {
  await db.from('trips').delete().eq('id', id);
}

// Migrates any trips from localStorage to Supabase under the authenticated user_id.
// Returns the number of trips migrated. Safe to call multiple times (upsert).
export async function migrateLocalTripsToDb(db: DbClient, authUserId: string): Promise<number> {
  const local = loadTrips();
  if (!local.length) return 0;
  const toMigrate = local.map((t) => ({ ...t, user_id: authUserId, updated_at: new Date().toISOString() }));
  const { error } = await db.from('trips').upsert(toMigrate, { onConflict: 'id' });
  if (!error) {
    // Clear local storage so we don't migrate again next session
    saveTrips([]);
    if (typeof window !== 'undefined') localStorage.removeItem(LOCAL_USER_KEY);
  }
  return toMigrate.length;
}

// Supabase returns JSONB fields already parsed, but ensure arrays/objects are never null.
function normalizeDbTrip(row: Record<string, unknown>): Trip {
  return {
    ...(row as unknown as Trip),
    activities:     Array.isArray(row.activities)     ? (row.activities as Activity[])                       : [],
    pins:           Array.isArray(row.pins)           ? (row.pins as TripPin[])                              : [],
    itinerary_days: row.itinerary_days && typeof row.itinerary_days === 'object' && !Array.isArray(row.itinerary_days)
      ? (row.itinerary_days as Record<string, Activity[]>)
      : {},
  };
}
