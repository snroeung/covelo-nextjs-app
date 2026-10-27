'use client';

import { useEffect, useRef, useState } from 'react';
import { useDebounce } from '@/hooks/useDebounce';
import { hasActiveFilters, MAX_QUERY, type BoardFilters as Filters, type FeedSort, type FeedType } from '@/lib/board/filters';
import type { BoardTopic } from '@/lib/board/types';
import type { FeedPage } from '@/lib/board/cache';
import { BoardIcon } from './icons';
import { TopicChips } from './TopicChips';

interface Props {
  filters: Filters;
  onChange: (patch: Partial<Filters>) => void;
  onClear: () => void;
  topics: BoardTopic[];
  counts: FeedPage['counts'];
}

function Segmented<T extends string>({ label, options, value, onChange }: { label: string; options: ReadonlyArray<readonly [T, string]>; value: T; onChange: (v: T) => void }) {
  return (
    <div role="group" aria-label={label} className="flex gap-[3px] rounded-[7px] bg-gph-bg p-[3px]">
      {options.map(([key, text]) => (
        <button
          key={key}
          type="button"
          aria-pressed={value === key}
          onClick={() => onChange(key)}
          className={`min-h-11 min-w-11 rounded-[5px] px-3 text-xs font-bold focus-visible:outline-2 focus-visible:outline-gph-ink ${
            value === key ? 'bg-gph-card text-gph-ink shadow-[0_0_0_1px_var(--gph-line)]' : 'text-gph-muted hover:text-gph-ink'
          }`}
        >
          {text}
        </button>
      ))}
    </div>
  );
}

const SORTS = [['hot', 'Hot'], ['new', 'New'], ['top', 'Top']] as const satisfies ReadonlyArray<readonly [FeedSort, string]>;
const TYPES = [['all', 'All'], ['tip', 'Tips'], ['offer', 'Offers']] as const satisfies ReadonlyArray<readonly [FeedType, string]>;

export function BoardFilters({ filters, onChange, onClear, topics, counts }: Props) {
  // The box keeps what was typed; the URL (and so the query) follows 300 ms later
  const [text, setText] = useState(filters.q);
  const debounced = useDebounce(text, 300);
  const lastPushed = useRef(filters.q);

  useEffect(() => {
    if (debounced.trim() !== lastPushed.current.trim()) {
      lastPushed.current = debounced;
      onChange({ q: debounced });
    }
    // onChange is a fresh closure each render; only a new debounced value should push
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced]);

  // "Clear filters" and back/forward change the URL from outside the box
  useEffect(() => {
    if (filters.q.trim() !== lastPushed.current.trim()) {
      lastPushed.current = filters.q;
      setText(filters.q);
    }
  }, [filters.q]);

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2.5 rounded-[10px] border border-gph-line bg-gph-card px-2.5 py-1.5">
        <Segmented label="Sort posts" options={SORTS} value={filters.sort} onChange={(sort) => onChange({ sort })} />
        <div className="flex flex-wrap items-center gap-2">
          <Segmented label="Show" options={TYPES} value={filters.type} onChange={(type) => onChange({ type })} />
          {filters.type !== 'tip' && (
            <button
              type="button"
              aria-pressed={filters.verified}
              onClick={() => onChange({ verified: !filters.verified })}
              className={`inline-flex min-h-11 items-center gap-1.5 rounded-full border px-3.5 text-[11.5px] font-bold focus-visible:outline-2 focus-visible:outline-gph-ink ${
                filters.verified ? 'border-gph-ok bg-gph-ok-soft text-gph-ok' : 'border-gph-line text-gph-muted hover:text-gph-ink'
              }`}
            >
              <BoardIcon name="shield" size={12} />
              Verified offers only
            </button>
          )}
        </div>
      </div>

      <label className="mb-3 flex items-center gap-2.5 rounded-[10px] border border-gph-line bg-gph-card px-3.5 focus-within:border-gph-ink">
        <BoardIcon name="search" size={15} className="text-gph-muted" />
        <input
          type="search"
          value={text}
          maxLength={MAX_QUERY}
          onChange={(e) => setText(e.target.value)}
          placeholder="Search posts, programs, cards…"
          aria-label="Search posts, programs, cards"
          className="min-h-11 min-w-0 flex-1 bg-transparent text-[13.5px] text-gph-ink outline-none placeholder:text-gph-muted [&::-webkit-search-cancel-button]:hidden"
        />
        {text && (
          <button type="button" aria-label="Clear search" onClick={() => setText('')} className="grid min-h-11 min-w-11 place-items-center text-gph-muted hover:text-gph-ink">
            <BoardIcon name="x" size={14} />
          </button>
        )}
      </label>

      <TopicChips
        topics={topics}
        selected={filters.topic}
        counts={counts?.byTopic ?? null}
        allCount={counts?.all ?? null}
        onSelect={(topic) => onChange({ topic })}
      />

      {hasActiveFilters(filters) && (
        <div className="-mt-1 mb-3">
          <button type="button" onClick={onClear} className="min-h-11 text-xs font-bold text-gph-muted underline underline-offset-2 hover:text-gph-ink">
            Clear filters
          </button>
        </div>
      )}
    </div>
  );
}
