'use client';

import { useEffect, useState } from 'react';
import { localIsoDate } from '@/lib/dates';

/**
 * Today in the viewer's timezone (YYYY-MM-DD) — the floor for every travel
 * date picker. `undefined` on the server and the first client render: SSR
 * can't know the client's timezone, so syncing a tick later avoids a
 * hydration mismatch on `min`.
 */
export function useToday(): string | undefined {
  const [today, setToday] = useState<string | undefined>(undefined);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setToday(localIsoDate(Date.now()));
  }, []);
  return today;
}
