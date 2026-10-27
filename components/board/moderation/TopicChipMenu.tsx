'use client';

import { useId, useState } from 'react';
import { describeError } from '@/lib/board/errors';
import type { BoardTopic } from '@/lib/board/types';
import { useModAction, type ModOp } from '@/hooks/useBoard';
import { useIsAdmin } from '@/hooks/useIsAdmin';
import { BTN_DANGER, BTN_GHOST, BTN_PRIMARY, btn } from '@/components/ui/button';
import { FIELD, LABEL } from '@/components/ui/field';
import { Dialog, DialogBody, DialogHeader } from '@/components/board/shared/Dialog';
import { BoardIcon } from '@/components/board/shared/icons';
import { useBoardToast } from '@/components/board/shared/Toast';

/** Admin-only: rename, merge, hide or promote the topic currently selected as a filter. */
export function TopicChipMenu({ topic, topics, onGone }: { topic: BoardTopic; topics: BoardTopic[]; onGone: () => void }) {
  const isAdmin = useIsAdmin();
  const [open, setOpen] = useState(false);
  if (!isAdmin) return null;
  return (
    <>
      <button type="button" aria-haspopup="dialog" onClick={() => setOpen(true)} className={btn('quiet', 'md', 'shrink-0 rounded-full! text-xs!')}>
        <BoardIcon name="shield" size={13} />
        Manage “{topic.name}”
      </button>
      {open && <ManageDialog topic={topic} topics={topics} onGone={onGone} onClose={() => setOpen(false)} />}
    </>
  );
}

function ManageDialog({ topic, topics, onGone, onClose }: { topic: BoardTopic; topics: BoardTopic[]; onGone: () => void; onClose: () => void }) {
  const toast = useBoardToast();
  const act = useModAction();
  const nameId = useId();
  const mergeId = useId();
  const [name, setName] = useState(topic.name);
  const [into, setInto] = useState('');
  const [error, setError] = useState<string | null>(null);
  const others = topics.filter((t) => t.id !== topic.id && t.status !== 'hidden');
  const hidden = topic.status === 'hidden';

  function run(op: ModOp, done: string, leaves = false) {
    setError(null);
    act.mutate(op, {
      onSuccess: () => { toast.show(done); if (leaves) onGone(); onClose(); },
      onError: (e) => setError(describeError(e).message),
    });
  }

  return (
    <Dialog label={`Manage topic ${topic.name}`} onClose={onClose} width="sm">
      <DialogHeader title={`Manage “${topic.name}”`} kicker="TOPIC TOOLS" onClose={onClose} />
      <DialogBody>
        <div>
          <label htmlFor={nameId} className={LABEL}>RENAME</label>
          <div className="flex gap-2">
            <input id={nameId} value={name} onChange={(e) => setName(e.target.value)} maxLength={60} className={`${FIELD} min-h-11`} />
            <button type="button" className={BTN_PRIMARY} disabled={act.isPending || !name.trim() || name.trim() === topic.name} onClick={() => run({ op: 'renameTopic', id: topic.id, name: name.trim() }, 'Topic renamed')}>
              Save
            </button>
          </div>
        </div>

        <div className="mt-5">
          <label htmlFor={mergeId} className={LABEL}>MERGE INTO</label>
          <div className="flex gap-2">
            <select id={mergeId} value={into} onChange={(e) => setInto(e.target.value)} className={`${FIELD} min-h-11`}>
              <option value="">Choose a topic…</option>
              {others.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            <button type="button" className={BTN_DANGER} disabled={act.isPending || !into} onClick={() => run({ op: 'mergeTopic', sourceId: topic.id, targetId: into }, 'Topics merged', true)}>
              Merge
            </button>
          </div>
          <p className="mt-1.5 text-[11.5px] text-gph-muted">Posts move to the other topic and this name stays as an alias.</p>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {topic.status === 'provisional' && (
            <button type="button" className={BTN_GHOST} disabled={act.isPending} onClick={() => run({ op: 'promoteTopic', id: topic.id }, 'Topic promoted')}>Promote to active</button>
          )}
          <button type="button" className={BTN_GHOST} disabled={act.isPending} onClick={() => run({ op: 'hideTopic', id: topic.id, hidden: !hidden }, hidden ? 'Topic unhidden' : 'Topic hidden', !hidden)}>
            {hidden ? 'Unhide topic' : 'Hide topic'}
          </button>
        </div>
        {error && <p role="alert" className="mt-3 text-[13px] font-semibold text-gph-danger">{error}</p>}
      </DialogBody>
    </Dialog>
  );
}
