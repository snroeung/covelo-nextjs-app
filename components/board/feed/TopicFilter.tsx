'use client';

import { useMemo } from 'react';
import { FilterDropdown } from '@/components/discover/FilterDropdown';
import { TopicChipMenu } from '@/components/board/moderation/TopicChipMenu';
import type { BoardTopic } from '@/lib/board/types';

interface Props {
  topics: BoardTopic[];
  selected: string | null;
  /** Posts per topic id, for the current type filter */
  counts: Record<string, number> | null;
  allCount: number | null;
  onSelect: (topicId: string | null) => void;
}

const ALL = '';
const ORDER: Record<string, number> = { common: 0, active: 1 };

/**
 * "Topic" dropdown for the feed filters. Every topic is listed — common and
 * active first, quiet ones last (they still show up in search) — each with its
 * post count. Admins get the topic tools beside it once one is picked.
 */
export function TopicFilter({ topics, selected, counts, allCount, onSelect }: Props) {
  const options = useMemo(() => {
    const sorted = [...topics].sort((a, b) => (ORDER[a.status] ?? 2) - (ORDER[b.status] ?? 2));
    const hint = (n: number | null | undefined) => (n == null ? undefined : String(n));
    return [
      { value: ALL, label: 'All topics', hint: hint(allCount) },
      ...sorted.map((t) => ({
        value: t.id,
        label: t.status === 'dormant' ? `${t.name} · quiet` : t.name,
        hint: hint(counts?.[t.id] ?? (counts ? 0 : null)),
      })),
    ];
  }, [topics, counts, allCount]);

  const selectedTopic = selected ? topics.find((t) => t.id === selected) : undefined;

  return (
    <>
      <FilterDropdown label="Topic" options={options} value={selected ?? ALL} onChange={(v) => onSelect(v === ALL ? null : v)} />
      {selectedTopic && <TopicChipMenu topic={selectedTopic} topics={topics} onGone={() => onSelect(null)} />}
    </>
  );
}
