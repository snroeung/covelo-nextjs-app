'use client';

import { useId, useState } from 'react';
import { BOARD_REJECT_REASONS, BOARD_REMOVE_REASONS } from '@/lib/board/constants';
import { describeError } from '@/lib/board/errors';
import type { BoardComment, BoardPost } from '@/lib/board/types';
import { useBoardTopics, useModAction, type ModOp } from '@/hooks/useBoard';
import { useIsAdmin } from '@/hooks/useIsAdmin';
import { BTN_ACTION, BTN_DANGER, BTN_GHOST, BTN_PRIMARY } from '@/components/ui/button';
import { FIELD, LABEL } from '@/components/ui/field';
import { Dialog, DialogBody, DialogFooter, DialogHeader } from '@/components/board/shared/Dialog';
import { BoardIcon } from '@/components/board/shared/icons';
import { useBoardToast } from '@/components/board/shared/Toast';

type Item =
  | { kind: 'post'; post: BoardPost }
  | { kind: 'comment'; comment: BoardComment };

type Step = 'menu' | 'takeDown' | 'reject' | 'topic' | 'standing';

const ROW = 'flex min-h-11 w-full items-center gap-2.5 rounded-lg px-3 text-left text-[13.5px] font-semibold text-gph-ink hover:bg-gph-linesoft focus-visible:outline-2 focus-visible:outline-gph-ink';

/**
 * Moderator actions on one post or comment. A button (not a hover menu) that
 * opens the board's dialog — a bottom sheet on phones — so it works the same
 * with a finger, a mouse or a keyboard. Renders nothing for non-admins.
 */
export function ModMenu(props: Item) {
  const isAdmin = useIsAdmin();
  const [open, setOpen] = useState(false);
  if (!isAdmin) return null;
  return (
    <>
      <button type="button" aria-haspopup="dialog" onClick={() => setOpen(true)} className={BTN_ACTION}>
        <BoardIcon name="shield" size={13} />
        Mod
      </button>
      {open && <ModDialog {...props} onClose={() => setOpen(false)} />}
    </>
  );
}

function ModDialog({ onClose, ...item }: Item & { onClose: () => void }) {
  const toast = useBoardToast();
  const act = useModAction();
  const [step, setStep] = useState<Step>('menu');
  const [error, setError] = useState<string | null>(null);

  const isPost = item.kind === 'post';
  const target = isPost ? item.post : item.comment;
  const mod = target.mod;
  const targetRef = { kind: item.kind, id: target.id } as const;
  const removed = mod?.status === 'removed';
  const held = mod?.status === 'held';
  const authorId = mod?.authorId ?? null;
  const canRestrict = authorId !== null && !target.isMine;
  const pendingOffer = isPost && item.post.offer !== null && item.post.review === 'pending';
  // A member-created offer isn't in the catalog yet: it is verified by publishing it, not by approving the post
  const needsPublish = pendingOffer && isPost && item.post.offer?.source === 'member';

  function run(op: ModOp, done: string, undo?: ModOp) {
    setError(null);
    act.mutate(op, {
      onSuccess: () => {
        toast.show(done, undo ? { action: { label: 'Undo', onClick: () => act.mutate(undo, { onError: (e) => toast.show(describeError(e).message, { tone: 'error' }) }) } } : undefined);
        onClose();
      },
      onError: (e) => setError(describeError(e).message),
    });
  }

  const title = step === 'menu' ? `Moderate this ${item.kind}` : step === 'takeDown' ? 'Take down' : step === 'reject' ? 'Reject offer' : step === 'standing' ? 'Restrict author' : 'Change topic';

  return (
    <Dialog label={title} onClose={onClose} width="sm">
      <DialogHeader title={title} kicker="MODERATION" onClose={onClose} />
      {step === 'menu' && (
        <DialogBody>
          <ul className="flex flex-col gap-0.5">
            {held && <li><button type="button" className={ROW} disabled={act.isPending} onClick={() => run({ op: 'approveHeld', ...targetRef }, 'Approved — it is public now')}>Approve held {item.kind}</button></li>}
            {removed && <li><button type="button" className={ROW} disabled={act.isPending} onClick={() => run({ op: 'restore', ...targetRef }, 'Restored')}>Restore</button></li>}
            {!removed && <li><button type="button" className={`${ROW} text-gph-danger!`} onClick={() => setStep('takeDown')}>Take down…</button></li>}
            {canRestrict && (
              <li><button type="button" className={ROW} onClick={() => setStep('standing')}>
                Restrict author…
                {mod?.authorStanding && mod.authorStanding !== 'normal' && <span className="ml-auto font-mono text-[10px] font-bold uppercase text-gph-pending">{mod.authorStanding}</span>}
              </button></li>
            )}
            {(mod?.reportCount ?? 0) > 0 && (
              <li><button type="button" className={ROW} disabled={act.isPending} onClick={() => run({ op: 'dismissReports', ...targetRef }, 'Reports dismissed')}>
                Dismiss {mod!.reportCount} open report{mod!.reportCount === 1 ? '' : 's'}
              </button></li>
            )}
            {isPost && (
              <>
                {pendingOffer && !needsPublish && <li><button type="button" className={ROW} disabled={act.isPending} onClick={() => run({ op: 'verify', postId: item.post.id }, 'Offer verified')}>Verify offer</button></li>}
                {needsPublish && <li><p className="px-3 py-2 text-[12.5px] leading-snug text-gph-muted">Member-created offer — it has to be reviewed and published to the catalog before it can be verified. That editor is coming; you can still reject it.</p></li>}
                {pendingOffer && <li><button type="button" className={ROW} onClick={() => setStep('reject')}>Reject offer…</button></li>}
                <li><button type="button" className={ROW} onClick={() => setStep('topic')}>Change topic…</button></li>
                <li>
                  <button
                    type="button"
                    className={ROW}
                    disabled={act.isPending}
                    onClick={() => run({ op: 'lockComments', postId: item.post.id, locked: !item.post.commentsLocked }, item.post.commentsLocked ? 'Comments unlocked' : 'Comments locked')}
                  >
                    {item.post.commentsLocked ? 'Unlock comments' : 'Lock comments'}
                  </button>
                </li>
              </>
            )}
          </ul>
          {error && <p role="alert" className="mt-3 text-[13px] font-semibold text-gph-danger">{error}</p>}
        </DialogBody>
      )}

      {step === 'takeDown' && (
        <ReasonStep
          label="WHY IS IT COMING DOWN?"
          reasons={BOARD_REMOVE_REASONS}
          withNote
          cta="Take down"
          danger
          pending={act.isPending}
          error={error}
          onBack={() => setStep('menu')}
          onSubmit={(reason, note) => run({ op: 'takeDown', ...targetRef, reason: reason as (typeof BOARD_REMOVE_REASONS)[number], note }, 'Taken down', { op: 'restore', ...targetRef })}
        />
      )}

      {step === 'reject' && isPost && (
        <ReasonStep
          label="WHY IS IT NOT VERIFIED?"
          reasons={BOARD_REJECT_REASONS}
          cta="Reject offer"
          danger
          pending={act.isPending}
          error={error}
          onBack={() => setStep('menu')}
          onSubmit={(reason) => run({ op: 'rejectOffer', postId: item.post.id, reason: reason as (typeof BOARD_REJECT_REASONS)[number] }, 'Offer rejected')}
        />
      )}

      {step === 'standing' && authorId && (
        <StandingStep
          current={mod?.authorStanding ?? 'normal'}
          pending={act.isPending}
          error={error}
          onBack={() => setStep('menu')}
          onSubmit={(standing, note) => run({ op: 'setStanding', userId: authorId, standing, note }, standing === 'normal' ? 'Restrictions cleared' : `Author ${standing}`)}
        />
      )}

      {step === 'topic' && isPost && (
        <TopicStep
          currentId={item.post.topics[0]?.id ?? null}
          pending={act.isPending}
          error={error}
          onBack={() => setStep('menu')}
          onPick={(topicId) => run({ op: 'setTopic', postId: item.post.id, topicId }, 'Topic changed')}
        />
      )}
    </Dialog>
  );
}

function ReasonStep({ label, reasons, withNote, cta, danger, pending, error, onBack, onSubmit }: {
  label: string; reasons: readonly string[]; withNote?: boolean; cta: string; danger?: boolean; pending: boolean; error: string | null;
  onBack: () => void; onSubmit: (reason: string, note?: string) => void;
}) {
  const group = useId();
  const noteId = useId();
  const [reason, setReason] = useState<string | null>(null);
  const [note, setNote] = useState('');
  return (
    <>
      <DialogBody>
        <fieldset>
          <legend className={LABEL}>{label}</legend>
          <div className="flex flex-col gap-1.5">
            {reasons.map((r) => (
              <label key={r} className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border px-3 text-[13.5px] font-semibold ${reason === r ? 'border-gph-ink bg-gph-linesoft' : 'border-gph-line hover:bg-gph-linesoft'}`}>
                <input type="radio" name={group} value={r} checked={reason === r} onChange={() => setReason(r)} className="size-4 accent-[var(--gph-action)]" />
                {r}
              </label>
            ))}
          </div>
        </fieldset>
        {withNote && (
          <div className="mt-4">
            <label htmlFor={noteId} className={LABEL}>NOTE <span className="font-sans font-medium normal-case tracking-normal">(optional, kept in the audit log)</span></label>
            <textarea id={noteId} value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} rows={2} className={`${FIELD} resize-y`} />
          </div>
        )}
        {error && <p role="alert" className="mt-3 text-[13px] font-semibold text-gph-danger">{error}</p>}
      </DialogBody>
      <DialogFooter>
        <button type="button" onClick={onBack} className={BTN_GHOST}>Back</button>
        <button type="button" disabled={!reason || pending} onClick={() => reason && onSubmit(reason, note.trim() || undefined)} className={danger ? BTN_DANGER : BTN_PRIMARY}>
          {pending ? 'Working…' : cta}
        </button>
      </DialogFooter>
    </>
  );
}

function TopicStep({ currentId, pending, error, onBack, onPick }: { currentId: string | null; pending: boolean; error: string | null; onBack: () => void; onPick: (topicId: string) => void }) {
  const topics = useBoardTopics();
  const [q, setQ] = useState('');
  const list = (topics.data ?? []).filter((t) => t.id !== currentId && t.name.toLowerCase().includes(q.trim().toLowerCase()));
  return (
    <>
      <DialogBody>
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a topic" aria-label="Find a topic" className={`${FIELD} mb-3 min-h-11`} />
        <ul className="flex max-h-72 flex-col gap-0.5 overflow-y-auto">
          {list.map((t) => (
            <li key={t.id}><button type="button" disabled={pending} onClick={() => onPick(t.id)} className={ROW}>{t.name}</button></li>
          ))}
          {topics.isLoading && <li className="px-3 py-3 text-[13px] text-gph-muted">Loading topics…</li>}
          {!topics.isLoading && list.length === 0 && <li className="px-3 py-3 text-[13px] text-gph-muted">No topic matches.</li>}
        </ul>
        {error && <p role="alert" className="mt-3 text-[13px] font-semibold text-gph-danger">{error}</p>}
      </DialogBody>
      <DialogFooter>
        <button type="button" onClick={onBack} className={BTN_GHOST}>Back</button>
      </DialogFooter>
    </>
  );
}

const STANDINGS = [
  ['normal', 'Normal', 'Clears a manual restriction. Removals in the last 30 days can still restrict them on their own.'],
  ['restricted', 'Restricted', 'Posts and comments are held for review, with tighter posting limits.'],
  ['banned', 'Banned', 'Anything they submit is rejected outright.'],
] as const;

function StandingStep({ current, pending, error, onBack, onSubmit }: {
  current: string; pending: boolean; error: string | null; onBack: () => void;
  onSubmit: (standing: 'normal' | 'restricted' | 'banned', note?: string) => void;
}) {
  const group = useId();
  const noteId = useId();
  const [standing, setStanding] = useState<'normal' | 'restricted' | 'banned' | null>(null);
  const [note, setNote] = useState('');
  return (
    <>
      <DialogBody>
        <fieldset>
          <legend className={LABEL}>AUTHOR STANDING <span className="font-sans font-medium normal-case tracking-normal">(now: {current})</span></legend>
          <div className="flex flex-col gap-1.5">
            {STANDINGS.map(([key, label, help]) => (
              <label key={key} className={`flex min-h-11 cursor-pointer items-start gap-3 rounded-lg border px-3 py-2.5 ${standing === key ? 'border-gph-ink bg-gph-linesoft' : 'border-gph-line hover:bg-gph-linesoft'}`}>
                <input type="radio" name={group} value={key} checked={standing === key} onChange={() => setStanding(key)} className="mt-0.5 size-4 accent-[var(--gph-action)]" />
                <span className="text-[13.5px] font-semibold text-gph-ink">{label}<span className="mt-0.5 block text-[12px] font-normal text-gph-muted">{help}</span></span>
              </label>
            ))}
          </div>
        </fieldset>
        <div className="mt-4">
          <label htmlFor={noteId} className={LABEL}>NOTE <span className="font-sans font-medium normal-case tracking-normal">(optional, kept in the audit log)</span></label>
          <textarea id={noteId} value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} rows={2} className={`${FIELD} resize-y`} />
        </div>
        {error && <p role="alert" className="mt-3 text-[13px] font-semibold text-gph-danger">{error}</p>}
      </DialogBody>
      <DialogFooter>
        <button type="button" onClick={onBack} className={BTN_GHOST}>Back</button>
        <button type="button" disabled={!standing || standing === current || pending} onClick={() => standing && onSubmit(standing, note.trim() || undefined)} className={standing === 'normal' ? BTN_PRIMARY : BTN_DANGER}>
          {pending ? 'Working…' : 'Apply'}
        </button>
      </DialogFooter>
    </>
  );
}
