'use client';

import { useId, useState } from 'react';
import { BOARD_REPORT_REASONS, BOARD_TEXT_LIMITS } from '@/lib/board/constants';
import { describeError } from '@/lib/board/errors';
import { useReport } from '@/hooks/useBoard';
import { BTN_GHOST, BTN_PRIMARY, FIELD, LABEL } from './buttons';
import { Dialog, DialogBody, DialogFooter, DialogHeader } from './Dialog';
import { useBoardToast } from './Toast';

type Reason = (typeof BOARD_REPORT_REASONS)[number];

interface Props {
  kind: 'post' | 'comment';
  id: string;
  onClose: () => void;
}

export function ReportDialog({ kind, id, onClose }: Props) {
  const toast = useBoardToast();
  const report = useReport();
  const [reason, setReason] = useState<Reason | null>(null);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const group = useId();
  const noteId = useId();

  function submit() {
    if (!reason) return;
    setError(null);
    report.mutate(
      { kind, id, reason, note: note.trim() || undefined },
      {
        onSuccess: ({ held }) => {
          toast.show(held ? 'Reported — it is hidden while an admin checks it' : 'Reported — thanks, an admin will take a look');
          onClose();
        },
        onError: (err) => setError(describeError(err).message),
      },
    );
  }

  return (
    <Dialog label={`Report this ${kind}`} onClose={onClose} width="sm">
      <DialogHeader title={`Report this ${kind}`} kicker="BOARD RULES" onClose={onClose} />
      <DialogBody>
        <fieldset>
          <legend className={LABEL}>WHAT&apos;S WRONG?</legend>
          <div className="flex flex-col gap-1.5">
            {BOARD_REPORT_REASONS.map((r) => (
              <label
                key={r}
                className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border px-3 text-[13.5px] font-semibold ${
                  reason === r ? 'border-gph-ink bg-gph-linesoft' : 'border-gph-line hover:bg-gph-linesoft'
                }`}
              >
                <input type="radio" name={group} value={r} checked={reason === r} onChange={() => setReason(r)} className="size-4 accent-[var(--gph-action)]" />
                {r}
              </label>
            ))}
          </div>
        </fieldset>

        <div className="mt-4">
          <label htmlFor={noteId} className={LABEL}>
            ANYTHING ELSE? <span className="font-sans font-medium normal-case tracking-normal">(optional)</span>
          </label>
          <textarea
            id={noteId}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={BOARD_TEXT_LIMITS.reportNoteMax}
            rows={3}
            className={`${FIELD} resize-y`}
            placeholder="What should the reviewer know?"
          />
        </div>

        {error && <p role="alert" className="mt-3 text-[13px] font-semibold text-gph-danger">{error}</p>}
      </DialogBody>
      <DialogFooter>
        <button type="button" onClick={onClose} className={BTN_GHOST}>Cancel</button>
        <button type="button" onClick={submit} disabled={!reason || report.isPending} className={BTN_PRIMARY}>
          {report.isPending ? 'Sending…' : 'Send report'}
        </button>
      </DialogFooter>
    </Dialog>
  );
}
