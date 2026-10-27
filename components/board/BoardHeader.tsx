import { BTN_PRIMARY } from './buttons';
import { BoardIcon } from './icons';

export function BoardHeader({ onNewPost }: { onNewPost: () => void }) {
  return (
    <div className="mb-[18px] flex flex-wrap items-end justify-between gap-5 border-b-2 border-gph-ink pb-4">
      <div>
        <div className="mb-2 font-mono text-[10px] font-extrabold tracking-[0.12em] text-gph-muted">DISCOVER · COMMUNITY</div>
        <h1 className="text-[34px] font-extrabold leading-none tracking-[-0.035em] text-gph-ink">The board</h1>
        <p className="mt-2.5 max-w-[560px] text-[13.5px] leading-relaxed text-gph-muted">
          Travel tips and offers from members. Offer posts link to a covelo offer and carry a verified mark once an admin confirms them.
        </p>
      </div>
      <button type="button" onClick={onNewPost} className={BTN_PRIMARY}>
        <BoardIcon name="plus" size={13} />
        New post
      </button>
    </div>
  );
}
