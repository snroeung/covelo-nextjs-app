import type { BoardPost } from '@/lib/board/types';
import { timeAgo } from '@/lib/board/format';
import { BoardIcon } from './icons';

const PILL = 'inline-flex items-center gap-1.5 rounded-full px-2 py-[3px] font-mono text-[9.5px] font-extrabold tracking-[0.08em]';

/** Travel tips only — an offer is labelled by who published it (see VerifyBadge), not by "OFFER". */
export function KindBadge({ kind }: { kind: BoardPost['kind'] }) {
  if (kind === 'offer') return null;
  return <span className="rounded-[3px] border border-gph-line px-[7px] py-[3px] font-mono text-[9px] font-extrabold tracking-[0.12em] text-gph-ink">TRAVEL TIP</span>;
}

const VERIFIED_STYLE = `${PILL} bg-gph-ok-soft text-gph-ok`;
const MEMBER_STYLE = `${PILL} bg-gph-pending-soft text-gph-pending`;

/** The two states without a name or time, for explaining them (the sidebar legend). */
export function VerifyLegendBadge({ verified }: { verified: boolean }) {
  return verified ? (
    <span className={VERIFIED_STYLE}><BoardIcon name="shield" size={11} />VERIFIED BY ADMIN</span>
  ) : (
    <span className={MEMBER_STYLE}><BoardIcon name="clock" size={11} />MEMBER OFFER</span>
  );
}

const SOURCE_STYLE = `${PILL} bg-gph-linesoft text-gph-muted`;

/**
 * Offers only: who published it (member / admin), then whether an admin has
 * confirmed it. An unverified member offer is the one amber state; once
 * verified or rejected the source pill goes neutral and the status pill leads.
 */
export function VerifyBadge({ post }: { post: Pick<BoardPost, 'kind' | 'review' | 'verified'> & { author: Pick<BoardPost['author'], 'isSystem'> } }) {
  if (post.kind !== 'offer') return null;
  const system = post.author.isSystem;
  const sourceLabel = system ? 'ADMIN PUBLISHED' : 'MEMBER OFFER';
  const source = (style: string, icon: boolean) => (
    <span className={style} title={system ? 'Published by a covelo admin' : post.verified ? 'Posted by a member' : "Posted by a member — an admin hasn't confirmed it yet"}>
      {icon && <BoardIcon name="clock" size={11} />}
      {sourceLabel}
    </span>
  );

  if (post.review === 'rejected') {
    return <>{source(SOURCE_STYLE, false)}<span className={`${PILL} bg-gph-danger-soft text-gph-danger`}>REJECTED</span></>;
  }
  if (post.verified) {
    const by = post.verified.by;
    return (
      <>
        {source(SOURCE_STYLE, false)}
        <span className={VERIFIED_STYLE} title={`An admin (${by}) confirmed the terms and expiry`}>
          <BoardIcon name="shield" size={11} />
          VERIFIED · {by} · {timeAgo(post.verified.at).toUpperCase()}
        </span>
      </>
    );
  }
  return system ? source(SOURCE_STYLE, false) : source(MEMBER_STYLE, true);
}
