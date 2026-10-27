'use client';

import { useId, useMemo, useState } from 'react';
import { TOPIC_RULES } from '@/lib/board/constants';
import { matchTopic, suggestTopicForText, validateTopic } from '@/lib/board/topics';
import {
  addExisting, addNew, canAddAny, canAddNew, isSelectedNew, MAX_NEW_TOPICS, MAX_TOPICS, newCount, removeSelection,
  type TopicSelection,
} from '@/lib/board/topicSelection';
import type { BoardTopic } from '@/lib/board/types';
import { FIELD, LABEL } from './buttons';
import { BoardIcon } from './icons';

interface Props {
  topics: BoardTopic[];
  value: TopicSelection[];
  onChange: (next: TopicSelection[]) => void;
  /** Title + details typed so far, to suggest a topic from */
  draftText: string;
  /** Where the topic list stands — typing a new topic works either way */
  status?: 'loading' | 'error' | 'ready';
}

const CHIP = 'inline-flex min-h-11 items-center gap-1.5 whitespace-nowrap rounded-full border px-3.5 text-xs font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gph-ink disabled:cursor-not-allowed disabled:opacity-40';
const ON = 'border-gph-action bg-gph-action text-gph-bg';
const OFF = 'border-gph-line bg-gph-card text-gph-ink hover:bg-gph-linesoft';

/**
 * Pick 1–5 topics (the first is the main one), or add new ones — up to 3.
 * Typing finds existing topics before offering to create one, so "lounges"
 * and "Lounge" don't become two topics; the server makes the final call.
 */
export function TopicPicker({ topics, value, onChange, draftText, status = 'ready' }: Props) {
  const [draft, setDraft] = useState('');
  const inputId = useId();
  const helpId = useId();

  // Chips: the common topics, the busiest active ones, and the member's own provisional ones
  const chips = useMemo(
    () => [
      ...topics.filter((t) => t.status === 'common'),
      ...topics.filter((t) => t.status === 'active').slice(0, TOPIC_RULES.composerChipCap),
      ...topics.filter((t) => t.status === 'provisional'),
    ],
    [topics],
  );

  const selectedIds = new Set(value.flatMap((s) => (s.type === 'existing' ? [s.id] : [])));
  // Anything searchable that isn't already a chip: quiet topics still turn up when typed
  const text = draft.trim();
  const match = text ? matchTopic(text, topics) : null;
  const validation = text ? validateTopic(text) : null;
  const suggestion = value.length === 0 && draftText.trim().length > 8 ? suggestTopicForText(draftText, chips) : null;

  const roomForAny = canAddAny(value);
  const roomForNew = canAddNew(value);
  const exactSelected = match?.exact ? selectedIds.has(match.exact.id) : false;
  const canCreate = !!validation?.ok && !match?.exact && !isSelectedNew(value, validation.key) && roomForNew;

  const toggleExisting = (t: BoardTopic) =>
    onChange(selectedIds.has(t.id) ? removeSelection(value, { type: 'existing', id: t.id, name: t.name, key: t.key }) : addExisting(value, t));

  function commit() {
    if (!text) return;
    if (match?.exact) {
      if (!exactSelected) onChange(addExisting(value, match.exact));
    } else if (validation?.ok && canCreate) {
      onChange(addNew(value, { name: validation.name, key: validation.key }));
    } else return;
    setDraft('');
  }

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <span id={`${inputId}-label`} className={LABEL}>TOPIC</span>
        <span className="mb-1.5 font-mono text-[10.5px] text-gph-muted" aria-live="polite">
          {value.length} / {MAX_TOPICS}
        </span>
      </div>

      {status === 'loading' && chips.length === 0 && <p className="mb-1 text-xs text-gph-muted">Loading topics…</p>}
      {status === 'error' && chips.length === 0 && (
        <p role="alert" className="mb-1 text-xs font-semibold text-gph-pending">Couldn&apos;t load the topic list — you can still add a topic by name.</p>
      )}
      <div role="group" aria-labelledby={`${inputId}-label`} className="flex flex-wrap gap-1.5">
        {chips.map((t) => {
          const on = selectedIds.has(t.id);
          const main = value[0]?.type === 'existing' && value[0].id === t.id;
          return (
            <button key={t.id} type="button" aria-pressed={on} disabled={!on && !roomForAny} onClick={() => toggleExisting(t)} className={`${CHIP} ${on ? ON : OFF}`}>
              {t.name}
              {main && <span className="font-mono text-[9px] tracking-wider opacity-80">MAIN</span>}
            </button>
          );
        })}
        {value.filter((s) => s.type === 'new').map((s) => {
          const main = value[0] === s;
          return (
            <button key={s.key} type="button" aria-pressed="true" onClick={() => onChange(removeSelection(value, s))} aria-label={`Remove new topic ${s.name}`} className={`${CHIP} ${ON} border-dashed`}>
              {s.name}
              {main && <span className="font-mono text-[9px] tracking-wider opacity-80">MAIN</span>}
              <span className="font-mono text-[9px] tracking-wider opacity-80">NEW</span>
              <BoardIcon name="x" size={11} />
            </button>
          );
        })}
      </div>

      {suggestion && !selectedIds.has((suggestion as BoardTopic).id ?? '') && (
        <p className="mt-2 text-xs text-gph-muted">
          Suggested:{' '}
          <button type="button" onClick={() => toggleExisting(suggestion as BoardTopic)} className="min-h-11 font-bold text-gph-ink underline underline-offset-2">
            {suggestion.name}
          </button>
        </p>
      )}

      <div className="mt-2.5">
        <label htmlFor={inputId} className="sr-only">Find or add a topic</label>
        <input
          id={inputId}
          value={draft}
          maxLength={TOPIC_RULES.maxLength}
          disabled={!roomForAny}
          aria-describedby={helpId}
          placeholder={roomForAny ? 'Find or add a topic…' : `You've picked ${MAX_TOPICS} topics`}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); commit(); }
            // Escape clears the box; the dialog only closes on an empty one
            if (e.key === 'Escape' && draft) { e.stopPropagation(); setDraft(''); }
          }}
          className={`${FIELD} min-h-11`}
        />

        {text && (
          <div className="mt-2 flex flex-col items-start gap-1.5">
            {match?.exact && (
              <button type="button" disabled={exactSelected || !roomForAny} onClick={commit} className={`${CHIP} ${OFF}`}>
                {exactSelected ? `${match.exact.name} is already picked` : `Use existing: ${match.exact.name}`}
              </button>
            )}
            {!match?.exact && match?.didYouMean && (
              <p className="text-xs text-gph-muted">
                Did you mean{' '}
                <button type="button" onClick={() => { onChange(addExisting(value, match.didYouMean!)); setDraft(''); }} className="min-h-11 font-bold text-gph-ink underline underline-offset-2">
                  {match.didYouMean.name}
                </button>
                ?
              </p>
            )}
            {!match?.exact && match && match.suggestions.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs text-gph-muted">Use existing:</span>
                {match.suggestions.map((t) => (
                  <button key={t.key} type="button" disabled={!roomForAny} onClick={() => { onChange(addExisting(value, t as BoardTopic)); setDraft(''); }} className={`${CHIP} ${OFF}`}>
                    {t.name}
                  </button>
                ))}
              </div>
            )}
            {canCreate && validation?.ok && (
              <button type="button" onClick={commit} className={`${CHIP} ${OFF} border-dashed`}>
                <BoardIcon name="plus" size={12} />
                Add &ldquo;{validation.name}&rdquo; as a new topic
              </button>
            )}
            {validation && !validation.ok && text.length >= TOPIC_RULES.minLength && (
              <p role="alert" className="text-xs font-semibold text-gph-danger">{validation.error}</p>
            )}
            {validation?.ok && !match?.exact && !roomForNew && roomForAny && (
              <p className="text-xs font-semibold text-gph-pending">Max {MAX_NEW_TOPICS} new topics per post.</p>
            )}
          </div>
        )}

        <p id={helpId} className="mt-2 text-[11.5px] text-gph-muted">
          Pick up to {MAX_TOPICS}; the first is the main one.
          {newCount(value) > 0 && ' A new topic shows up as a filter once another member uses it.'}
        </p>
      </div>
    </div>
  );
}
