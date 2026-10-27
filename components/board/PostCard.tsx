'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { timeAgo, pluralize } from '@/lib/board/format';
import type { BoardPost } from '@/lib/board/types';
import { useRequireSignIn, useSavePost, useVotePost } from '@/hooks/useBoard';
import { KindBadge, VerifyBadge } from './Badges';
import { BTN_ACTION } from '@/components/ui/button';
import { BoardIcon } from './icons';
import { ModBanner } from './ModBanner';
import { OfferPreview } from './OfferPreview';
import { ReportDialog } from './ReportDialog';
import { copyLink, postPath } from './share';
import { useBoardToast } from './Toast';
import { VoteControl } from './VoteControl';

/** "pointsplease · 2h · Hotels" */
export function postMeta(post: BoardPost): string {
  return [post.author.name, timeAgo(post.createdAt), post.topics[0]?.name].filter(Boolean).join(' · ');
}

export function PostCard({ post }: { post: BoardPost }) {
  const router = useRouter();
  const toast = useBoardToast();
  const requireSignIn = useRequireSignIn();
  const vote = useVotePost();
  const save = useSavePost();
  const [reporting, setReporting] = useState(false);
  const href = postPath(post.id);

  async function share() {
    toast.show((await copyLink(href)) ? 'Link copied' : "Couldn't copy the link");
  }

  return (
    <article
      onClick={() => router.push(href)}
      className="grid cursor-pointer grid-cols-[44px_minmax(0,1fr)] gap-x-2 rounded-[10px] border border-gph-line bg-gph-card py-2 pl-1 pr-3 transition-colors hover:border-gph-muted sm:pr-[18px]"
    >
      <VoteControl
        subject="post"
        score={post.score}
        myVote={post.myVote}
        onVote={(value) => requireSignIn(() => vote.mutate({ postId: post.id, value }), 'vote')}
      />

      <div className="min-w-0 py-1.5">
        <div className="mb-1.5 flex flex-wrap items-center gap-2">
          <KindBadge kind={post.kind} />
          <VerifyBadge post={post} />
          <span className="font-mono text-[11px] font-semibold text-gph-muted">{postMeta(post)}</span>
        </div>

        <h3 className="text-base font-bold leading-snug tracking-tight text-gph-ink" style={{ textWrap: 'pretty' }}>
          <Link href={href} onClick={(e) => e.stopPropagation()} className="hover:underline focus-visible:outline-2 focus-visible:outline-gph-ink">
            {post.title}
          </Link>
        </h3>
        {post.body && <p className="mt-1.5 line-clamp-2 text-[13px] leading-relaxed text-gph-muted">{post.body}</p>}

        {post.offer && <div className="mt-2.5"><OfferPreview offer={post.offer} compact /></div>}
        {post.notice && <div className="mt-2.5"><ModBanner notice={post.notice} /></div>}

        <div className="-ml-2.5 mt-1.5 flex flex-wrap" onClick={(e) => e.stopPropagation()}>
          <Link href={href} className={BTN_ACTION}>
            <BoardIcon name="msg" size={13} />
            {pluralize(post.commentCount, 'comment')}
          </Link>
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
          {!post.isMine && (
            <button type="button" onClick={() => requireSignIn(() => setReporting(true), 'report posts')} className={BTN_ACTION}>
              <BoardIcon name="flag" size={13} />
              Report
            </button>
          )}
        </div>
      </div>

      {reporting && <ReportDialog kind="post" id={post.id} onClose={() => setReporting(false)} />}
    </article>
  );
}
