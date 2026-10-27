'use client';

import { useState } from 'react';
import { pluralize, timeAgo } from '@/lib/board/format';
import { describeError } from '@/lib/board/errors';
import type { BoardComment, VoteValue } from '@/lib/board/types';
import { useCreateComment, useDeleteComment, useRequireSignIn, useVoteComment } from '@/hooks/useBoard';
import { Avatar } from '@/components/board/shared/Avatar';
import { BTN_ACTION } from '@/components/ui/button';
import { BoardIcon } from '@/components/board/shared/icons';
import { ModBanner } from '@/components/board/moderation/ModBanner';
import { ModMenu } from '@/components/board/moderation/ModMenu';
import { ModStrip } from '@/components/board/moderation/ModStrip';
import { ReplyBox } from './ReplyBox';
import { ReportDialog } from '@/components/board/moderation/ReportDialog';
import { useBoardToast } from '@/components/board/shared/Toast';
import { VoteControl } from './VoteControl';

/** Past this depth replies stop indenting, so a deep thread still fits a phone. */
export const MAX_INDENT_DEPTH = 5;

interface ThreadProps {
  postId: string;
  comments: BoardComment[];
  locked: boolean;
}

/** Shared by every comment in the thread: the handlers, so they aren't threaded through props. */
function useThreadActions(postId: string) {
  const toast = useBoardToast();
  const requireSignIn = useRequireSignIn();
  const create = useCreateComment(postId);
  const vote = useVoteComment(postId);
  const remove = useDeleteComment();

  async function reply(body: string, parentId?: string): Promise<string | null> {
    try {
      const { moderation } = await create.mutateAsync({ body, parentId });
      if (moderation.status === 'held') toast.show('Your comment is held for review — only you can see it for now');
      return null;
    } catch (err) {
      return describeError(err).message;
    }
  }

  return {
    reply,
    vote: (commentId: string, value: VoteValue) => requireSignIn(() => vote.mutate({ commentId, value }), 'vote'),
    remove: (commentId: string) => remove.mutate(commentId, { onError: (err) => toast.show(describeError(err).message, { tone: 'error' }) }),
    requireSignIn,
  };
}
type Actions = ReturnType<typeof useThreadActions>;

export function CommentThread({ postId, comments, locked }: ThreadProps) {
  const actions = useThreadActions(postId);
  return (
    <div>
      {comments.map((c) => (
        <CommentNode key={c.id} comment={c} depth={0} locked={locked} actions={actions} />
      ))}
    </div>
  );
}

function CommentNode({ comment: c, depth, locked, actions }: { comment: BoardComment; depth: number; locked: boolean; actions: Actions }) {
  const [open, setOpen] = useState(true);
  const [replying, setReplying] = useState(false);
  const [reporting, setReporting] = useState(false);
  const placeholder = c.author.name === '[deleted]' || c.body === '[removed by moderator]';
  const nest = depth < MAX_INDENT_DEPTH;

  const children = open && c.replies.map((r) => (
    <CommentNode key={r.id} comment={r} depth={depth + 1} locked={locked} actions={actions} />
  ));

  return (
    <>
      <div className="grid grid-cols-[28px_minmax(0,1fr)] gap-x-2.5">
        <div className="flex flex-col items-center pt-1">
          <Avatar initials={c.author.initials} tone={c.author.tone} size={26} />
          {open && <span aria-hidden="true" className="mt-1.5 w-0.5 flex-1 rounded bg-gph-line" />}
        </div>

        <div className={`min-w-0 ${open ? 'pb-1' : 'pb-3'}`}>
          <div className="flex min-h-11 flex-wrap items-center gap-x-2">
            <span className="text-[12.5px] font-bold text-gph-ink">{c.author.name}</span>
            {c.isOp && <span className="rounded-[3px] bg-gph-action px-[5px] py-[2px] font-mono text-[8.5px] font-extrabold tracking-[0.12em] text-gph-bg">OP</span>}
            <span className="font-mono text-[11px] font-semibold text-gph-muted">{timeAgo(c.createdAt)} ago</span>
            <button
              type="button"
              aria-expanded={open}
              onClick={() => setOpen((v) => !v)}
              className="inline-flex min-h-11 items-center px-2 font-mono text-[11px] font-bold text-gph-muted hover:text-gph-ink focus-visible:outline-2 focus-visible:outline-gph-ink"
            >
              {open ? 'Collapse' : `Show ${pluralize(countAll(c), 'comment')}`}
              <span className="sr-only"> thread by {c.author.name}</span>
            </button>
          </div>

          {open && (
            <>
              <p className={`whitespace-pre-wrap break-words text-[13.5px] leading-relaxed ${placeholder ? 'italic text-gph-muted' : 'text-gph-ink'}`} style={{ textWrap: 'pretty' }}>
                {c.body}
              </p>
              {c.notice && <div className="mt-2"><ModBanner notice={c.notice} /></div>}
              {c.mod && <div className="mt-2"><ModStrip mod={c.mod} /></div>}

              {!placeholder && (
                <div className="-ml-1 mb-1.5 mt-1 flex flex-wrap items-center">
                  <VoteControl subject="comment" layout="row" score={c.score} myVote={c.myVote} onVote={(v) => actions.vote(c.id, v)} />
                  {!locked && (
                    <button type="button" aria-expanded={replying} onClick={() => actions.requireSignIn(() => setReplying((v) => !v), 'reply')} className={BTN_ACTION}>
                      <BoardIcon name="reply" size={13} />
                      Reply
                    </button>
                  )}
                  {c.isMine ? (
                    <button
                      type="button"
                      onClick={() => { if (window.confirm('Delete this comment?')) actions.remove(c.id); }}
                      className={BTN_ACTION}
                    >
                      <BoardIcon name="trash" size={13} />
                      Delete
                    </button>
                  ) : (
                    <button type="button" onClick={() => actions.requireSignIn(() => setReporting(true), 'report comments')} className={BTN_ACTION}>
                      <BoardIcon name="flag" size={13} />
                      Report
                    </button>
                  )}
                  <ModMenu kind="comment" comment={c} />
                </div>
              )}

              {c.body === '[removed by moderator]' && (
                <div className="-ml-1 mb-1.5 flex"><ModMenu kind="comment" comment={c} /></div>
              )}

              {replying && (
                <div className="mb-3.5">
                  <ReplyBox
                    autoFocus
                    label={`Reply to ${c.author.name}`}
                    placeholder={`Reply to ${c.author.name}…`}
                    onCancel={() => setReplying(false)}
                    onSubmit={async (body) => {
                      const failure = await actions.reply(body, c.id);
                      if (!failure) setReplying(false);
                      return failure;
                    }}
                  />
                </div>
              )}

              {nest && children}
            </>
          )}
        </div>
      </div>
      {!nest && children}
      {reporting && <ReportDialog kind="comment" id={c.id} onClose={() => setReporting(false)} />}
    </>
  );
}

const countAll = (c: BoardComment): number => 1 + c.replies.reduce((n, r) => n + countAll(r), 0);
