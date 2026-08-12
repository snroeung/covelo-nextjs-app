'use client';

import { useEffect, useState } from 'react';
import {
  DEFAULT_PER_PAGE,
  PER_PAGE_STORAGE_KEY,
  parsePerPage,
  type PerPage,
} from '@/lib/pagination';

/**
 * Results-per-page preference, shared by /flights and /hotels and persisted to
 * localStorage. All parsing lives in lib/pagination.ts so this hook stays
 * branch-free (React components aren't unit-testable in this repo).
 */
export function usePerPage(): [PerPage, (next: PerPage) => void] {
  const [perPage, setPerPage] = useState<PerPage>(DEFAULT_PER_PAGE);

  useEffect(() => {
    // Deliberately not a lazy useState initializer: SSR always renders the
    // default, so the first client render must match it exactly to avoid a
    // hydration mismatch. Syncing the stored value one tick later here is the
    // tradeoff, not an oversight.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPerPage(parsePerPage(localStorage.getItem(PER_PAGE_STORAGE_KEY)));
  }, []);

  function update(next: PerPage) {
    localStorage.setItem(PER_PAGE_STORAGE_KEY, String(next));
    setPerPage(next);
  }

  return [perPage, update];
}
