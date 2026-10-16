// Text normalization for topicality matching (lexicon.ts, topic
// suggestions). Offensive-word screening does NOT use this — obscenity has
// its own transformers (see blocklist.ts).

const ZERO_WIDTH = /[​-‍⁠﻿­]/g;
const COMBINING_MARKS = /\p{M}+/gu;

/** Lowercase, accent-free, "&" → "and", punctuation as spaces, digits kept. */
export function normalizeForLexicon(text: string): string {
  return text
    .normalize("NFKC")
    .replace(ZERO_WIDTH, "")
    .normalize("NFD")
    .replace(COMBINING_MARKS, "")
    .normalize("NFC")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\s]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
