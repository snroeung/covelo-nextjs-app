'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { countComments, sortThread, type CommentSort, type PostDetailData } from '@/lib/board/cache';
import { describeError } from '@/lib/board/errors';
import { timeAgo } from '@/lib/board/format';
import { useCreateComment, useDeletePost, useRequireSignIn, useSavePost, useVotePost, useBoardViewer } from '@/hooks/useBoard';
import { Avatar } from '@/components/board/shared/Avatar';
import { KindBadge, VerifyBadge } from './Badges';
import { BTN_ACTION, BTN_DANGER, BTN_GHOST } from '@/components/ui/button';
import { CommentThread } from './CommentThread';
import { Dialog, DialogBody, DialogFooter, DialogHeader } from '@/components/board/shared/Dialog';
import { BoardIcon } from '@/components/board/shared/icons';
import { ModBanner } from '@/components/board/moderation/ModBanner';
import { ModMenu } from '@/components/board/moderation/ModMenu';
import { ModStrip } from '@/components/board/moderation/ModStrip';
import { OfferPreview } from '@/components/board/offers/OfferPreview';
import { ReplyBox } from './ReplyBox';
import { ReportDialog } from '@/components/board/moderation/ReportDialog';
import { copyLink, postPath } from '@/components/board/shared/share';
import { useBoardToast } from '@/components/board/shared/Toast';
import { VoteControl } from './VoteControl';

/** Verified / not-yet-verified explainer under an offer post. */
function VerificationPanel({ post }: { post: PostDetailData['post'] }) {
  if (post.review === 'rejected' || post.kind !== 'offer') return null;
  const ok = !!post.verified;
  return (
    <div className={`flex items-start gap-2.5 rounded-lg px-3.5 py-3 ${ok ? 'bg-gph-ok-soft text-gph-ok' : 'bg-gph-pending-soft text-gph-pending'}`}>
      <BoardIcon name={ok ? 'shield' : 'clock'} size={16} className="mt-0.5" />
      <div className="text-[12.5px] leading-normal">
        <div className="mb-0.5 font-mono text-[10px] font-extrabold tracking-[0.12em]">
          {ok ? `VERIFIED BY ADMIN ${post.verified!.by} · ${timeAgo(post.verified!.at).toUpperCase()} AGO` : 'NOT VERIFIED'}
        </div>
        <span className="text-gph-ink">
          {ok
            ? 'An admin confirmed the terms, eligibility, and expiry against the linked offer.'
            : "An admin hasn't confirmed this yet. Check the terms on the linked offer before you act on it."}
        </span>
      </div>
    </div>
  );
}

export function PostDetail({ data }: { data: PostDetailData }) {
  const { post, comments } = data;
  const router = useRouter();
  const toast = useBoardToast();
  const viewer = useBoardViewer();
  const requireSignIn = useRequireSignIn();
  const vote = useVotePost();
  const save = useSavePost();
  const remove = useDeletePost();
  const createComment = useCreateComment(post.id);

  const [sort, setSort] = useState<CommentSort>('top');
  const [reporting, setReporting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const thread = useMemo(() => sortThread(comments, sort), [comments, sort]);
  const total = countComments(comments);
  const href = postPath(post.id);

  async function share() {
    toast.show((await copyLink(href)) ? 'Link copied' : "Couldn't copy the link");
  }

  async function comment(body: string): Promise<string | null> {
    try {
      const { moderation } = await createComment.mutateAsync({ body });
      if (moderation.status === 'held') toast.show('Your comment is held for review — only you can see it for now');
      return null;
    } catch (err) {
      return describeError(err).message;
    }
  }

  return (
    <div>
      <article className="grid grid-cols-[44px_minmax(0,1fr)] gap-x-2 rounded-[10px] border border-gph-line bg-gph-card py-4 pl-1 pr-4 sm:pr-[22px]">
        <VoteControl
          subject="post"
          score={post.score}
          myVote={post.myVote}
          onVote={(value) => requireSignIn(() => vote.mutate({ postId: post.id, value }), 'vote')}
        />

        <div className="min-w-0">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Avatar initials={post.author.initials} tone={post.author.tone} size={22} />
            <span className="text-[12.5px] font-bold text-gph-ink">{post.author.name}</span>
            <span className="font-mono text-[11px] font-semibold text-gph-muted">· {timeAgo(post.createdAt)} ago</span>
            <KindBadge kind={post.kind} />
            <VerifyBadge post={post} />
          </div>

          <h1 className="text-2xl font-extrabold leading-tight tracking-[-0.025em] text-gph-ink" style={{ textWrap: 'pretty' }}>{post.title}</h1>
          {post.topics.length > 0 && (
            <p className="mt-2 flex flex-wrap gap-1.5" aria-label="Topics">
              {post.topics.map((t) => (
                <span key={t.id} className="rounded-full border border-gph-line px-2.5 py-0.5 text-[11px] font-bold text-gph-muted">{t.name}</span>
              ))}
            </p>
          )}
          {post.body && (
            <p className="mt-3 max-w-[680px] whitespace-pre-wrap break-words text-[14.5px] leading-[1.65] text-gph-ink" style={{ textWrap: 'pretty' }}>{post.body}</p>
          )}

          {post.notice && <div className="mt-4"><ModBanner notice={post.notice} /></div>}
          {post.mod && <div className="mt-3"><ModStrip mod={post.mod} postId={post.id} topicId={post.topics[0]?.id} /></div>}
          {post.offer && (
            <div className="mt-[18px] flex flex-col gap-2.5">
              <OfferPreview offer={post.offer} />
              <VerificationPanel post={post} />
            </div>
          )}

          <div className="-ml-2.5 mt-3 flex flex-wrap">
            <span className={`${BTN_ACTION} cursor-default hover:bg-transparent hover:text-gph-muted`}>
              <BoardIcon name="msg" size={13} />
              {total} {total === 1 ? 'comment' : 'comments'}
            </span>
            <button type="button" onClick={share} className={BTN_ACTION}>
              <BoardIcon name="share" size={13} />
              Share
            </button>
            <button
              type="button"
              aria-pressed={post.saved}
              onClick={() => requireSignIn(() => save.mutate({ postId: post.id, saved: !post.saved }), 'save posts')}
              className={`${BTN_ACTION} ${post.saved ? 'text-gph-ink' : ''}`}
            >
              <BoardIcon name="save" size={13} filled={post.saved} />
              {post.saved ? 'Saved' : 'Save'}
            </button>
            {post.isMine ? (
              <button type="button" onClick={() => setConfirmDelete(true)} className={BTN_ACTION}>
                <BoardIcon name="trash" size={13} />
                Delete
              </button>
            ) : (
              <button type="button" onClick={() => requireSignIn(() => setReporting(true), 'report posts')} className={BTN_ACTION}>
                <BoardIcon name="flag" size={13} />
                Report
              </button>
            )}
            <ModMenu kind="post" post={post} />
          </div>
        </div>
      </article>

      <section aria-label="Comments" className="mt-4 rounded-[10px] border border-gph-line bg-gph-card px-[18px] pb-2 pt-4">
        {post.commentsLocked ? (
          <p className="flex items-center gap-2 pb-4 text-[13px] text-gph-muted">
            <BoardIcon name="lock" size={14} />
            Comments are locked on this post.
          </p>
        ) : viewer.signedIn ? (
          <>
            <p className="mb-2 text-[11.5px] text-gph-muted">Comment as <b className="text-gph-ink">{viewer.name}</b></p>
            <ReplyBox label="Add a comment" placeholder="Add to the discussion…" cta="Comment" onSubmit={comment} />
          </>
        ) : (
          <p className="pb-2 text-[13px] text-gph-muted">
            <a href="/auth" className="font-bold text-gph-ink underline underline-offset-2">Sign in</a> to join the discussion.
          </p>
        )}

        <div className="mb-3.5 mt-[18px] flex items-center justify-between border-b border-gph-line pb-2.5">
          <h2 className="font-mono text-[10px] font-extrabold tracking-[0.12em] text-gph-muted">{total} {total === 1 ? 'COMMENT' : 'COMMENTS'}</h2>
          <div role="group" aria-label="Sort comments" className="flex gap-1">
            {(['top', 'new'] as const).map((k) => (
              <button
                key={k}
                type="button"
                aria-pressed={sort === k}
                onClick={() => setSort(k)}
                className={`min-h-11 min-w-11 rounded-md px-3 text-[11px] font-bold focus-visible:outline-2 focus-visible:outline-gph-ink ${
                  sort === k ? 'bg-gph-action text-gph-bg' : 'border border-gph-line text-gph-muted hover:text-gph-ink'
                }`}
              >
                {k === 'top' ? 'Top' : 'New'}
              </button>
            ))}
          </div>
        </div>

        {thread.length === 0 ? (
          <p className="pb-4 text-[13px] text-gph-muted">No comments yet. Start the thread.</p>
        ) : (
          <CommentThread postId={post.id} comments={thread} locked={post.commentsLocked} />
        )}
      </section>

      {reporting && <ReportDialog kind="post" id={post.id} onClose={() => setReporting(false)} />}
      {confirmDelete && (
        <Dialog label="Delete this post?" onClose={() => setConfirmDelete(false)} width="sm">
          <DialogHeader title="Delete this post?" onClose={() => setConfirmDelete(false)} />
          <DialogBody>
            <p className="text-sm leading-relaxed text-gph-muted">It disappears from the board along with its comments. This can&apos;t be undone.</p>
          </DialogBody>
          <DialogFooter>
            <button type="button" onClick={() => setConfirmDelete(false)} className={BTN_GHOST}>Keep it</button>
            <button
              type="button"
              disabled={remove.isPending}
              className={BTN_DANGER}
              onClick={() => remove.mutate(post.id, {
                onSuccess: () => { toast.show('Post deleted'); router.push('/discover/board'); },
                onError: (err) => { setConfirmDelete(false); toast.show(describeError(err).message, { tone: 'error' }); },
              })}
            >
              {remove.isPending ? 'Deleting…' : 'Delete post'}
            </button>
          </DialogFooter>
        </Dialog>
      )}
    </div>
  );
}
