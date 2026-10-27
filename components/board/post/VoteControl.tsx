'use client';

import { toggleVote } from '@/lib/board/cache';
import type { VoteValue } from '@/lib/board/types';
import { BoardIcon } from '@/components/board/shared/icons';

interface Props {
  score: number;
  myVote: VoteValue;
  onVote: (value: VoteValue) => void;
  /** What is being voted on — read out by screen readers ("Upvote post") */
  subject: 'post' | 'comment';
  /** Stacked beside a post, or inline under a comment */
  layout?: 'column' | 'row';
}

/**
 * Up / down with the running score. Each arrow is a 44px tap target around a
 * 28px mark. Clicking the vote you already cast clears it.
 */
export function VoteControl({ score, myVote, onVote, subject, layout = 'column' }: Props) {
  const arrow = (dir: 1 | -1) => {
    const on = myVote === dir;
    return (
      <button
        type="button"
        aria-label={`${dir === 1 ? 'Upvote' : 'Downvote'} ${subject}`}
        aria-pressed={on}
        onClick={(e) => { e.stopPropagation(); onVote(toggleVote(myVote, dir)); }}
        className="group grid min-h-11 min-w-11 place-items-center rounded-md focus-visible:outline-2 focus-visible:outline-gph-ink"
      >
        <span
          className={`grid size-7 place-items-center rounded-md transition-colors ${
            on
              ? dir === 1 ? 'bg-[#84cc16] text-[#0c0c0d]' : 'bg-[#dc2626] text-white'
              : 'text-gph-muted group-hover:bg-gph-linesoft group-hover:text-gph-ink'
          }`}
        >
          <BoardIcon name={dir === 1 ? 'up' : 'down'} size={15} filled={on} />
        </span>
      </button>
    );
  };

  return (
    <div className={`flex items-center ${layout === 'column' ? 'flex-col' : 'flex-row'}`}>
      {arrow(1)}
      <div className={`min-w-6 text-center font-mono text-sm font-extrabold tracking-tight ${myVote === -1 ? 'text-gph-danger' : 'text-gph-ink'}`}>
        {score}
        <span className="sr-only"> points</span>
      </div>
      {arrow(-1)}
    </div>
  );
}
