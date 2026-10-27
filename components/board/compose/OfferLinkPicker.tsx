'use client';

import { useId, useState } from 'react';
import { useDebounce } from '@/hooks/useDebounce';
import { useCatalogOffers } from '@/hooks/useBoard';
import { describeError } from '@/lib/board/errors';
import type { BoardOffer } from '@/lib/board/types';
import { BoardIcon } from '@/components/board/shared/icons';

interface Props {
  selected: BoardOffer | null;
  onSelect: (offer: BoardOffer) => void;
  /** "Create it" in the empty state */
  onCreateInstead: () => void;
}

/** Search the live covelo offers and pick the one the post is about. */
export function OfferLinkPicker({ selected, onSelect, onCreateInstead }: Props) {
  const [q, setQ] = useState('');
  const debounced = useDebounce(q.trim(), 250);
  const offers = useCatalogOffers(debounced, true);
  const name = useId();

  return (
    <div className="overflow-hidden rounded-lg border border-gph-line">
      <label className="flex items-center gap-2 border-b border-gph-line bg-gph-bg px-3">
        <BoardIcon name="search" size={14} className="text-gph-muted" />
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search covelo offers"
          aria-label="Search covelo offers"
          className="min-h-11 min-w-0 flex-1 bg-transparent text-[13.5px] text-gph-ink outline-none placeholder:text-gph-muted [&::-webkit-search-cancel-button]:hidden"
        />
      </label>

      <div className="max-h-56 overflow-y-auto" role="radiogroup" aria-label="Covelo offers" aria-busy={offers.isFetching}>
        {offers.isPending ? (
          <p className="px-3.5 py-3.5 text-[12.5px] text-gph-muted">Loading offers…</p>
        ) : offers.isError ? (
          <p role="alert" className="px-3.5 py-3.5 text-[12.5px] text-gph-danger">{describeError(offers.error).message}</p>
        ) : offers.data.length === 0 ? (
          <p className="px-3.5 py-3.5 text-[12.5px] text-gph-muted">
            No covelo offers match{debounced ? <> &ldquo;{debounced}&rdquo;</> : ' right now'}.{' '}
            <button type="button" onClick={onCreateInstead} className="min-h-11 font-bold text-gph-ink underline underline-offset-2">Create it</button>
          </p>
        ) : (
          offers.data.map((o) => {
            const on = selected?.id === o.id && selected.table === o.table;
            return (
              <label
                key={`${o.table}:${o.id}`}
                className={`grid min-h-11 cursor-pointer grid-cols-[18px_56px_minmax(0,1fr)] items-center gap-2.5 border-b border-gph-linesoft px-3 py-2.5 last:border-b-0 ${on ? 'bg-gph-linesoft' : 'hover:bg-gph-linesoft'}`}
              >
                <input type="radio" name={name} checked={on} onChange={() => onSelect(o)} className="size-4 accent-[var(--gph-action)]" />
                <span className="font-mono text-sm font-extrabold tracking-tighter text-gph-ink">{o.value}</span>
                <span className="min-w-0">
                  <span className="block truncate text-[13px] font-bold text-gph-ink">{o.title}</span>
                  <span className="mt-0.5 block font-mono text-[10.5px] text-gph-muted">{o.type} · {o.endsIn}</span>
                </span>
              </label>
            );
          })
        )}
      </div>
    </div>
  );
}
