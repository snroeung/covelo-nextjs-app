'use client';

import { useId, useState } from 'react';
import { BOARD_TEXT_LIMITS } from '@/lib/board/constants';
import { BTN_GHOST, BTN_PRIMARY } from '@/components/ui/button';

interface Props {
  placeholder: string;
  cta?: string;
  autoFocus?: boolean;
  /** Return an error message to show, or null on success (the box clears itself) */
  onSubmit: (body: string) => Promise<string | null>;
  onCancel?: () => void;
  /** Accessible name for the textarea */
  label: string;
}

/** Comment / reply input. Ctrl or ⌘ + Enter submits. */
export function ReplyBox({ placeholder, cta = 'Reply', autoFocus, onSubmit, onCancel, label }: Props) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const errorId = useId();
  const ready = text.trim().length > 0 && !busy;

  async function submit() {
    if (!ready) return;
    setBusy(true);
    setError(null);
    const failure = await onSubmit(text.trim());
    setBusy(false);
    if (failure) setError(failure);
    else setText('');
  }

  return (
    <div className="overflow-hidden rounded-lg border border-gph-line bg-gph-card focus-within:border-gph-ink">
      <textarea
        autoFocus={autoFocus}
        value={text}
        rows={3}
        maxLength={BOARD_TEXT_LIMITS.commentMax}
        aria-label={label}
        aria-describedby={error ? errorId : undefined}
        aria-invalid={error ? true : undefined}
        placeholder={placeholder}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); void submit(); } }}
        className="block w-full resize-y bg-transparent px-3.5 py-3 text-[13px] leading-normal text-gph-ink outline-none placeholder:text-gph-muted"
      />
      {error && <p id={errorId} role="alert" className="px-3.5 pb-2 text-[12.5px] font-semibold text-gph-danger">{error}</p>}
      <div className="flex justify-end gap-2 border-t border-gph-linesoft bg-gph-bg px-2.5 py-2">
        {onCancel && <button type="button" onClick={onCancel} className={BTN_GHOST}>Cancel</button>}
        <button type="button" onClick={submit} disabled={!ready} className={BTN_PRIMARY}>{busy ? 'Sending…' : cta}</button>
      </div>
    </div>
  );
}
