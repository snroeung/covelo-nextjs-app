'use client';

import { useAuth } from '@/contexts/AuthContext';

/** Mirrors the server's check (`app_metadata.role`, which only the service role can set). UI gating only — every admin route re-checks on the server. */
export function useIsAdmin(): boolean {
  const { user } = useAuth();
  return (user?.app_metadata as { role?: string } | undefined)?.role === 'admin';
}
