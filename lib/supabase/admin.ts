import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Server-only. Never import from app/ or components/.
// Uses the service role key to bypass RLS for admin operations.
// Lazily initialized so the missing env var doesn't fail at build time.
let _admin: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
  if (!_admin) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SECRET_KEY;
    if (!url || !key) throw new Error('SUPABASE_SECRET_KEY is not set');
    _admin = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
  }
  return _admin;
}
