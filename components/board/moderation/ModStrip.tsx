'use client';

import { describeError } from '@/lib/board/errors';
import type { ModDetail } from '@/lib/board/types';
import { useBoardTopics, useModAction } from '@/hooks/useBoard';
import { useIsAdmin } from '@/hooks/useIsAdmin';
import { btn } from '@/components/ui/button';
import { BoardIcon } from '@/components/board/shared/icons';
import { useBoardToast } from '@/components/board/shared/Toast';

interface Props {
  mod: ModDetail | null;
  /** Posts only: where "Move to X" applies */
  postId?: string;
  /** Primary topic id, so a suggestion equal to it is not offered */
  topicId?: string | null;
}

/**
 * What a moderator sees on a post or comment that needs a look: its state
 * (held / removed), why, open reports, and a one-tap answer to a topic
 * mismatch. Nothing renders for clean, unreported content — or for members.
 */
export function ModStrip({ mod, postId, topicId }: Props) {
  const isAdmin = useIsAdmin();
  const topics = useBoardTopics();
  const act = useModAction();
  const toast = useBoardToast();

  if (!isAdmin || !mod) return null;
  const state = mod.status === 'held' ? 'HELD' : mod.status === 'removed' ? 'REMOVED' : null;
  const reported = mod.reportCount > 0 || (mod.reportedComments ?? 0) > 0;
  const mismatch = postId && mod.flags.includes('topic_mismatch');
  if (!state && !reported && !mismatch) return null;

  const suggested = typeof mod.scores?.suggested_topic === 'string' ? mod.scores.suggested_topic : null;
  const target = mismatch && suggested ? topics.data?.find((t) => t.name.toLowerCase() === suggested.toLowerCase() && t.id !== topicId) : undefined;

  const bits = [
    ...mod.reasons.map((r) => r.replace(/_/g, ' ')),
    mod.removedReason,
    mod.reportCount > 0 ? `${mod.reportCount} report${mod.reportCount === 1 ? '' : 's'}${mod.reportReasons.length ? ` (${mod.reportReasons.join(', ')})` : ''}` : null,
    mod.reportedComments ? `${mod.reportedComments} reported comment${mod.reportedComments === 1 ? '' : 's'}` : null,
    mismatch && !target ? 'topic may not fit' : null,
  ].filter(Boolean);

  return (
    <div role="note" aria-label="Moderator details" className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-dashed border-gph-line bg-gph-linesoft px-3 py-2 text-xs text-gph-ink">
      <BoardIcon name="shield" size={13} className="text-gph-muted" />
      {state && <span className="font-mono text-[10px] font-extrabold tracking-[0.1em] text-gph-pending">{state}</span>}
      {bits.length > 0 && <span className="min-w-0 flex-1 text-gph-muted">{bits.join(' · ')}</span>}
      {postId && target && (
        <button
          type="button"
          disabled={act.isPending}
          onClick={() => act.mutate({ op: 'setTopic', postId, topicId: target.id }, {
            onSuccess: () => toast.show(`Moved to ${target.name}`),
            onError: (e) => toast.show(describeError(e).message, { tone: 'error' }),
          })}
          className={btn('secondary', 'md', 'text-xs!')}
        >
          Move to {target.name}
        </button>
      )}
    </div>
  );
}
