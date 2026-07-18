'use client';

import { createContext, useContext, useEffect, useRef, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import type { CardId } from '@/lib/points/types';

export interface Profile {
  id: string;
  display_name: string | null;
  username: string | null;
  preferred_cards: CardId[];
  avatar_url: string | null;
  onboarding_completed: boolean;
}

type SupabaseClient = ReturnType<typeof import('@/lib/supabase/client').createClient>;

interface AuthContextValue {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signOut: () => Promise<void>;
  updateProfile: (updates: Partial<Pick<Profile, 'display_name' | 'preferred_cards'>>) => Promise<void>;
  completeOnboarding: (cards: CardId[], username: string, displayName: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser]       = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  // Client is created only inside useEffect (browser-only) so prerendering never calls createClient()
  const supabaseRef = useRef<SupabaseClient | null>(null);

  async function fetchProfile(client: SupabaseClient, userId: string) {
    const { data } = await client.from('profiles').select('*').eq('id', userId).single();
    if (data) setProfile(data as Profile);
  }

  useEffect(() => {
    // Dynamically import so the browser client is never instantiated during SSR
    import('@/lib/supabase/client').then(({ createClient }) => {
      const supabase = createClient();
      supabaseRef.current = supabase;

      supabase.auth.getUser().then(({ data: { user } }) => {
        setUser(user);
        if (user) fetchProfile(supabase, user.id);
        setLoading(false);
      });

      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        const u = session?.user ?? null;
        setUser(u);
        if (u) fetchProfile(supabase, u.id);
        else setProfile(null);
      });

      return () => subscription.unsubscribe();
    });
  }, []);

  async function signOut() {
    if (!supabaseRef.current) return;
    await supabaseRef.current.auth.signOut();
    setUser(null);
    setProfile(null);
  }

  async function updateProfile(updates: Partial<Pick<Profile, 'display_name' | 'preferred_cards'>>) {
    if (!supabaseRef.current || !user) return;
    const { data } = await supabaseRef.current
      .from('profiles')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', user.id)
      .select()
      .single();
    if (data) setProfile(data as Profile);
  }

  async function completeOnboarding(cards: CardId[], username: string, displayName: string) {
    if (!supabaseRef.current || !user) return;
    const { data } = await supabaseRef.current
      .from('profiles')
      .update({ preferred_cards: cards, username, display_name: displayName, onboarding_completed: true, updated_at: new Date().toISOString() })
      .eq('id', user.id)
      .select()
      .single();
    if (data) setProfile(data as Profile);
  }

  return (
    <AuthContext.Provider value={{ user, profile, loading, signOut, updateProfile, completeOnboarding }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
