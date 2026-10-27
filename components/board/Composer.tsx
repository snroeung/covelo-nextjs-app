'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useId, useMemo, useState } from 'react';
import { BOARD_TEXT_LIMITS } from '@/lib/board/constants';
import { describeError, isRateLimited } from '@/lib/board/errors';
import { selectionError, toTopicInputs, type TopicSelection } from '@/lib/board/topicSelection';
import type { BoardOffer } from '@/lib/board/types';
import { useBoardLimits, useBoardTopics, useCreatePost } from '@/hooks/useBoard';
import { saveFeedSearch } from './backLink';
import { BTN_GHOST, BTN_PRIMARY } from '@/components/ui/button';
import { FIELD, LABEL } from '@/components/ui/field';
import { Dialog, DialogBody, DialogFooter, DialogHeader } from './Dialog';
import { BoardIcon } from './icons';
import { KindPicker, type PostKind } from './KindPicker';
import { EMPTY_OFFER, NewOfferForm, newOfferError, type NewOfferDraft } from './NewOfferForm';
import { OfferLinkPicker } from './OfferLinkPicker';
import { postPath } from './share';
import { useBoardToast } from './Toast';
import { TopicPicker } from './TopicPicker';

type OfferMode = 'link' | 'new';

const orUndefined = (s: string) => s.trim() || undefined;

export function Composer({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const toast = useBoardToast();
  const topics = useBoardTopics();
  const limits = useBoardLimits(true);
  const create = useCreatePost();

  const [kind, setKind] = useState<PostKind>('tip');
  const [mode, setMode] = useState<OfferMode>('link');
  const [linked, setLinked] = useState<BoardOffer | null>(null);
  const [offer, setOffer] = useState<NewOfferDraft>(EMPTY_OFFER);
  const [picked, setPicked] = useState<TopicSelection[]>([]);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);
  const titleId = useId();
  const bodyId = useId();

  const dirty = title.trim() !== '' || body.trim() !== '' || picked.length > 0 || linked !== null || offer.value !== '' || offer.name !== '';
  function requestClose() {
    if (!dirty || create.isPending || window.confirm('Discard this draft?')) onClose();
  }

  // The 30-second gap between posts: counted from when the numbers arrived, so the button re-enables itself
  const quota = limits.data;
  const gap = quota?.postCooldownSeconds ?? 0;
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (gap <= 0) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [gap]);
  const cooldown = gap > 0 ? Math.max(0, Math.ceil(gap - (now - limits.dataUpdatedAt) / 1000)) : 0;

  const ofKind = quota ? (kind === 'offer' ? (mode === 'new' ? quota.newOfferPost : quota.offerPost) : null) : null;
  const outOfPosts = !!quota && (quota.post.day === 0 || quota.post.hour === 0 || (!!ofKind && (ofKind.day === 0 || ofKind.hour === 0)));
  const blockedMessage = quota?.blocked?.message ?? (outOfPosts ? 'You’ve reached the posting limit for now. It resets as older posts age out.' : null);

  const problem =
    !title.trim() ? 'Add a title.'
    : selectionError(picked)
    ?? (kind === 'offer' && mode === 'link' && !linked ? 'Pick the covelo offer this is about, or create a new one.' : null)
    ?? (kind === 'offer' && mode === 'new' ? newOfferError(offer) : null);

  const draftText = useMemo(() => `${title} ${body}`, [title, body]);

  function submit() {
    if (problem || blockedMessage || cooldown > 0) return;
    setError(null);
    create.mutate(
      {
        kind,
        title: title.trim(),
        body: body.trim(),
        topics: toTopicInputs(picked),
        ...(kind === 'offer' && mode === 'link' && linked?.table ? { link: { table: linked.table, id: linked.id } } : {}),
        ...(kind === 'offer' && mode === 'new'
          ? {
              newOffer: {
                type: offer.type, value: offer.value.trim(), name: offer.name.trim(), from: offer.from.trim(),
                to: orUndefined(offer.to), conditions: orUndefined(offer.conditions), ends: orUndefined(offer.ends), url: orUndefined(offer.url),
              },
            }
          : {}),
      },
      {
        onSuccess: ({ post, moderation }) => {
          // Show the new post, and make "The board" lead back to a feed where it's on top
          saveFeedSearch('?sort=new');
          toast.show(moderation.status === 'held' ? (moderation.message ?? 'Held for review — only you can see it for now') : 'Posted');
          onClose();
          router.push(postPath(post.id));
        },
        onError: (err) => {
          setError(describeError(err).message);
          void limits.refetch();
        },
      },
    );
  }

  const canSubmit = !problem && !blockedMessage && cooldown <= 0 && !create.isPending;
  const left = quota?.post.day;

  return (
    <Dialog label="New post" onClose={requestClose} width="lg">
      <DialogHeader title="New post" onClose={requestClose} />
      <DialogBody className="flex flex-col gap-[18px]">
        <KindPicker value={kind} onChange={setKind} />

        {kind === 'offer' && (
          <section aria-label="The offer">
            <div className="mb-2 flex items-center justify-between gap-3">
              <span className={`${LABEL} !mb-0`}>OFFER</span>
              <div role="group" aria-label="How to add the offer" className="flex gap-[3px] rounded-[7px] bg-gph-bg p-[3px]">
                {([['link', 'Link a covelo offer'], ['new', 'Create new offer']] as const).map(([k, text]) => (
                  <button
                    key={k}
                    type="button"
                    aria-pressed={mode === k}
                    onClick={() => setMode(k)}
                    className={`min-h-11 rounded-[5px] px-3 text-xs font-bold focus-visible:outline-2 focus-visible:outline-gph-ink ${
                      mode === k ? 'bg-gph-card text-gph-ink shadow-[0_0_0_1px_var(--gph-line)]' : 'text-gph-muted hover:text-gph-ink'
                    }`}
                  >
                    {text}
                  </button>
                ))}
              </div>
            </div>
            {mode === 'link' ? (
              <OfferLinkPicker selected={linked} onSelect={setLinked} onCreateInstead={() => setMode('new')} />
            ) : (
              <NewOfferForm value={offer} onChange={setOffer} />
            )}
          </section>
        )}

        <TopicPicker topics={topics.data ?? []} value={picked} onChange={setPicked} draftText={draftText} status={topics.isPending ? 'loading' : topics.isError ? 'error' : 'ready'} />

        <div>
          <label htmlFor={titleId} className={LABEL}>TITLE</label>
          <input
            id={titleId}
            value={title}
            maxLength={BOARD_TEXT_LIMITS.titleMax}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={kind === 'tip' ? 'What did you learn?' : "What's the deal, and who's it for?"}
            className={`${FIELD} min-h-11`}
          />
        </div>

        <div>
          <label htmlFor={bodyId} className={LABEL}>DETAILS</label>
          <textarea
            id={bodyId}
            value={body}
            rows={4}
            maxLength={BOARD_TEXT_LIMITS.bodyMax}
            onChange={(e) => setBody(e.target.value)}
            placeholder={kind === 'tip' ? 'Steps, dates, cabins — whatever helps the next person.' : 'Your experience with the offer: did it post, any catches?'}
            className={`${FIELD} resize-y leading-normal`}
          />
        </div>

        {kind === 'offer' && (
          <div className="flex items-start gap-2.5 rounded-lg bg-gph-pending-soft px-3 py-2.5 text-xs leading-normal text-gph-ink">
            <BoardIcon name="clock" size={15} className="mt-px text-gph-pending" />
            <span>Offer posts go live right away marked <b>Member offer</b>. A covelo admin checks the terms and expiry, then adds the verified mark.</span>
          </div>
        )}
      </DialogBody>

      <DialogFooter>
        {(error || blockedMessage || cooldown > 0) && (
          <p role="alert" className={`basis-full text-left text-[12.5px] font-semibold ${error && !isRateLimited({ message: error, code: null, retryAt: null }) ? 'text-gph-danger' : 'text-gph-pending'}`}>
            {error ?? blockedMessage ?? `You can post again in ${cooldown} s.`}
          </p>
        )}
        {left != null && left !== null && !blockedMessage && (
          <span className="mr-auto font-mono text-[11px] text-gph-muted">{left} {left === 1 ? 'post' : 'posts'} left today</span>
        )}
        <button type="button" onClick={requestClose} className={BTN_GHOST}>Cancel</button>
        <button type="button" onClick={submit} disabled={!canSubmit} title={problem ?? undefined} className={BTN_PRIMARY}>
          {create.isPending ? 'Posting…' : cooldown > 0 ? `Post (${cooldown})` : 'Post'}
        </button>
      </DialogFooter>
    </Dialog>
  );
}
