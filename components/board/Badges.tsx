import type { BoardPost } from '@/lib/board/types';
import { timeAgo } from '@/lib/board/format';
import { BoardIcon } from './icons';

const PILL = 'inline-flex items-center gap-1.5 rounded-full px-2 py-[3px] font-mono text-[9.5px] font-extrabold tracking-[0.08em]';

export function KindBadge({ kind }: { kind: BoardPost['kind'] }) {
  return kind === 'offer' ? (
    <span className="rounded-[3px] border border-gph-action bg-gph-action px-[7px] py-[3px] font-mono text-[9px] font-extrabold tracking-[0.12em] text-gph-bg">OFFER</span>
  ) : (
    <span className="rounded-[3px] border border-gph-line px-[7px] py-[3px] font-mono text-[9px] font-extrabold tracking-[0.12em] text-gph-ink">TRAVEL TIP</span>
  );
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

/** Offers only. Verified (by whom, when) · rejected · or still a plain member offer. */
export function VerifyBadge({ post }: { post: Pick<BoardPost, 'kind' | 'review' | 'verified'> }) {
  if (post.kind !== 'offer') return null;
  if (post.review === 'rejected') {
    return <span className={`${PILL} bg-gph-danger-soft text-gph-danger`}>REJECTED</span>;
  }
  if (post.verified) {
    const by = post.verified.by;
    return (
      <span className={VERIFIED_STYLE} title={`An admin (${by}) confirmed the terms and expiry`}>
        <BoardIcon name="shield" size={11} />
        VERIFIED · {by} · {timeAgo(post.verified.at).toUpperCase()}
      </span>
    );
  }
  return (
    <span className={MEMBER_STYLE} title="Posted by a member — an admin hasn't confirmed it yet">
      <BoardIcon name="clock" size={11} />
      MEMBER OFFER
    </span>
  );
}
