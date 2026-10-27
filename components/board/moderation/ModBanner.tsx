import type { ModNotice } from '@/lib/board/types';
import { BoardIcon } from './icons';

const TITLE = { held: 'Held for review', removed: 'Removed by a moderator', rejected: 'Offer not verified' } as const;

/**
 * What an author sees on their own held / removed / rejected content. Nobody
 * else can see those posts at all, so this is never shown to other members.
 */
export function ModBanner({ notice }: { notice: ModNotice }) {
  const bad = notice.kind !== 'held';
  return (
    <div
      role="note"
      className={`flex items-start gap-2.5 rounded-lg px-3 py-2.5 text-xs leading-snug ${bad ? 'bg-gph-danger-soft text-gph-danger' : 'bg-gph-pending-soft text-gph-pending'}`}
    >
      <BoardIcon name={notice.kind === 'held' ? 'clock' : 'flag'} size={14} className="mt-px" />
      <div>
        <div className="font-mono text-[10px] font-extrabold tracking-[0.1em]">{TITLE[notice.kind].toUpperCase()}</div>
        <div className="mt-0.5 text-gph-ink">
          {notice.message}
          {notice.reason && <> Reason: <b>{notice.reason}</b>.</>}
        </div>
      </div>
    </div>
  );
}
