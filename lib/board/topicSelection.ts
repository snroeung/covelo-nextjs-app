// What the composer's topic picker holds, and the rules for changing it.
// Pure, so the caps and de-duplication are tested rather than clicked through.
// The server re-checks all of it — this only keeps the form from offering
// choices that would be refused.

import { BOARD_PER_POST_LIMITS } from "./limits";

export type TopicSelection =
  | { type: "existing"; id: string; name: string; key: string }
  | { type: "new"; name: string; key: string };

export const MAX_TOPICS = BOARD_PER_POST_LIMITS.topicsPerPost;
export const MAX_NEW_TOPICS = BOARD_PER_POST_LIMITS.newTopicsPerPost;

export const newCount = (sel: readonly TopicSelection[]) => sel.filter((s) => s.type === "new").length;

export const isSelectedExisting = (sel: readonly TopicSelection[], id: string) => sel.some((s) => s.type === "existing" && s.id === id);
export const isSelectedNew = (sel: readonly TopicSelection[], key: string) => sel.some((s) => s.type === "new" && s.key === key);

/** Another topic fits. */
export const canAddAny = (sel: readonly TopicSelection[]) => sel.length < MAX_TOPICS;
/** Another brand-new topic fits. */
export const canAddNew = (sel: readonly TopicSelection[]) => canAddAny(sel) && newCount(sel) < MAX_NEW_TOPICS;

/** Pick an existing topic; a repeat or a full list changes nothing. */
export function addExisting(sel: readonly TopicSelection[], topic: { id: string; name: string; key: string }): TopicSelection[] {
  if (isSelectedExisting(sel, topic.id) || !canAddAny(sel)) return [...sel];
  return [...sel, { type: "existing", ...topic }];
}

/** Add a name that doesn't exist yet; a repeat, or a full list / quota, changes nothing. */
export function addNew(sel: readonly TopicSelection[], topic: { name: string; key: string }): TopicSelection[] {
  if (isSelectedNew(sel, topic.key) || !canAddNew(sel)) return [...sel];
  return [...sel, { type: "new", ...topic }];
}

export function removeSelection(sel: readonly TopicSelection[], target: TopicSelection): TopicSelection[] {
  return sel.filter((s) => !(s.type === target.type && s.key === target.key && (s.type === "new" || (target.type === "existing" && s.id === target.id))));
}

/** board.posts.create's `topics`. The first pick is the post's main topic. */
export function toTopicInputs(sel: readonly TopicSelection[]): Array<{ id: string } | { name: string }> {
  return sel.map((s) => (s.type === "existing" ? { id: s.id } : { name: s.name }));
}

/** Why the current picks can't be posted, or null. */
export function selectionError(sel: readonly TopicSelection[]): string | null {
  if (sel.length === 0) return "Pick at least one topic.";
  if (sel.length > MAX_TOPICS) return `Pick up to ${MAX_TOPICS} topics.`;
  if (newCount(sel) > MAX_NEW_TOPICS) return `Max ${MAX_NEW_TOPICS} new topics per post.`;
  return null;
}
