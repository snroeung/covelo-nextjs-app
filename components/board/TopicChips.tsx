'use client';

import { useMemo, useState } from 'react';
import { TOPIC_RULES } from '@/lib/board/constants';
import type { BoardTopic } from '@/lib/board/types';
import { FIELD } from '@/components/ui/field';
import { Dialog, DialogBody, DialogHeader } from './Dialog';

interface Props {
  topics: BoardTopic[];
  selected: string | null;
  /** Posts per topic id, for the current type filter */
  counts: Record<string, number> | null;
  allCount: number | null;
  onSelect: (topicId: string | null) => void;
}

const CHIP = 'inline-flex min-h-11 shrink-0 items-center gap-2 whitespace-nowrap rounded-full border px-3.5 text-xs font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gph-ink';
const ON = 'border-gph-action bg-gph-action text-gph-bg';
const OFF = 'border-gph-line bg-gph-card text-gph-ink hover:bg-gph-linesoft';

/**
 * The filter chips: every common and active topic (up to 12), then "More
 * topics" for the rest — including quiet ones, which still show up in search.
 * On a phone the row scrolls; wider screens wrap it.
 */
export function TopicChips({ topics, selected, counts, allCount, onSelect }: Props) {
  const [moreOpen, setMoreOpen] = useState(false);

  const { shown, hasMore } = useMemo(() => {
    const live = topics.filter((t) => t.status === 'common' || t.status === 'active');
    const head = live.slice(0, TOPIC_RULES.chipCap);
    // A topic picked from "More" (or a shared link) must stay visible as a chip
    const pinned = selected && !head.some((t) => t.id === selected) ? topics.find((t) => t.id === selected) : undefined;
    return { shown: pinned ? [...head, pinned] : head, hasMore: topics.length > head.length };
  }, [topics, selected]);

  const count = (n: number | null | undefined) =>
    n == null ? null : <span className="font-mono text-[10.5px] opacity-80">{n}</span>;

  return (
    <>
      <div className="relative mb-3">
        <div
          role="group"
          aria-label="Filter by topic"
          className="cv-scroll -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5 [mask-image:linear-gradient(to_right,black_calc(100%-28px),transparent)] md:mx-0 md:flex-wrap md:overflow-visible md:px-0 md:[mask-image:none]"
        >
          <button type="button" aria-pressed={selected === null} onClick={() => onSelect(null)} className={`${CHIP} ${selected === null ? ON : OFF}`}>
            All topics {count(allCount)}
          </button>
          {shown.map((t) => (
            <button key={t.id} type="button" aria-pressed={selected === t.id} onClick={() => onSelect(t.id)} className={`${CHIP} ${selected === t.id ? ON : OFF}`}>
              {t.name} {count(counts?.[t.id] ?? (counts ? 0 : null))}
            </button>
          ))}
          {hasMore && (
            <button type="button" onClick={() => setMoreOpen(true)} aria-haspopup="dialog" className={`${CHIP} ${OFF} border-dashed text-gph-muted`}>
              More topics
            </button>
          )}
        </div>
      </div>
      {moreOpen && (
        <MoreTopics
          topics={topics}
          selected={selected}
          counts={counts}
          onClose={() => setMoreOpen(false)}
          onPick={(id) => { onSelect(id); setMoreOpen(false); }}
        />
      )}
    </>
  );
}

function MoreTopics({ topics, selected, counts, onClose, onPick }: { topics: BoardTopic[]; selected: string | null; counts: Record<string, number> | null; onClose: () => void; onPick: (id: string) => void }) {
  const [q, setQ] = useState('');
  const list = topics.filter((t) => t.name.toLowerCase().includes(q.trim().toLowerCase()));
  return (
    <Dialog label="All topics" onClose={onClose} width="sm">
      <DialogHeader title="All topics" onClose={onClose} />
      <DialogBody>
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a topic" aria-label="Find a topic" className={`${FIELD} mb-3 min-h-11`} />
        <ul className="flex flex-col gap-1">
          {list.map((t) => (
            <li key={t.id}>
              <button
                type="button"
                aria-pressed={selected === t.id}
                onClick={() => onPick(t.id)}
                className={`flex min-h-11 w-full items-center justify-between rounded-lg px-3 text-left text-[13.5px] font-semibold hover:bg-gph-linesoft ${selected === t.id ? 'bg-gph-linesoft' : ''}`}
              >
                <span>{t.name}{t.status === 'dormant' && <span className="ml-2 text-[11px] font-medium text-gph-muted">quiet lately</span>}</span>
                {counts && <span className="font-mono text-[11px] text-gph-muted">{counts[t.id] ?? 0}</span>}
              </button>
            </li>
          ))}
          {list.length === 0 && <li className="px-3 py-4 text-[13px] text-gph-muted">No topic matches &ldquo;{q}&rdquo;.</li>}
        </ul>
      </DialogBody>
    </Dialog>
  );
}
