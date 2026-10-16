// Smart topics (plan §12). Pure — shared by the composer (client-side
// "Did you mean" / suggestions) and the router (dedupe ladder before insert).
// The server ladder adds alias lookup and pg_trgm (board_similar_topics);
// these helpers are the parts that need no database.

import { TOPIC_RULES } from "@/lib/board/constants";
import { sameProgram } from "@/lib/points/programNames";
import { SEED_TRANSFER_PARTNERS } from "@/lib/points/transferPartners";
import { normalizeForLexicon } from "@/lib/board/moderation/normalize";

const EMOJI = /[\p{Extended_Pictographic}\p{Emoji_Modifier}\u{FE0F}\u{20E3}]/gu;

/** Always upper-cased in display names */
const ACRONYMS = new Set([
  "tsa", "cpp", "ihg", "ana", "klm", "tap", "eva", "spg", "aa", "ba", "jal", "sas", "nyc", "la",
  "sfo", "lax", "jfk", "us", "usa", "uk", "eu", "uae", "sub", "ur", "mr", "c1", "qr", "dl", "ua",
]);

/** Words that end in "s" but aren't plural */
const SINGULAR_S = new Set([
  "status", "bonus", "plus", "class", "pass", "business", "gas", "news", "series", "access",
  "express", "atlas", "campus", "lexus", "always", "this", "is", "us", "its", "airbus",
  "christmas", "seychelles", "maldives", "bahamas", "honors", "rewards", "miles",
  "smiles", "skymiles", "lifemiles", "privileges", "atmos",
]);

/** Singular form of one lowercase word. Conservative: unknown words keep their "s" off only when clearly plural. */
export function singularize(word: string): string {
  if (word.length <= 3 || SINGULAR_S.has(word)) return word;
  if (word.endsWith("ies") && word.length > 4) return `${word.slice(0, -3)}y`;
  if (/(?:ss|sh|ch|x|z)es$/.test(word)) return word.slice(0, -2);
  if (/uses$/.test(word)) return word.slice(0, -2);
  if (word.endsWith("ss") || word.endsWith("us") || word.endsWith("is")) return word;
  if (word.endsWith("s")) return word.slice(0, -1);
  return word;
}

function stripEmoji(s: string): string {
  return s.replace(EMOJI, " ");
}

/**
 * Display form: NFKC, emoji and stray punctuation gone (keeps & + - '),
 * whitespace collapsed, sentence case with acronyms upper-cased.
 * "airport LOUNGES 🛋️" → "Airport lounges", "tsa precheck" → "TSA precheck".
 * Mixed-case words the member typed on purpose ("AAdvantage") are kept.
 */
export function normalizeTopic(raw: string): string {
  const cleaned = stripEmoji(raw.normalize("NFKC"))
    .replace(/[^\p{L}\p{N}\s&+\-']/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, TOPIC_RULES.maxLength)
    .trim();

  return cleaned
    .split(" ")
    .map((word, i) => {
      const lower = word.toLowerCase();
      if (ACRONYMS.has(lower)) return lower.toUpperCase();
      // Capitals after the first letter mean deliberate casing ("AAdvantage", "iPhone");
      // plain Title Case ("More") folds to sentence case
      const mixed = /\p{Lu}/u.test(word.slice(1)) && word !== word.toUpperCase();
      const shortCaps = word === word.toUpperCase() && /\p{L}/u.test(word) && word.length <= 3;
      const kept = mixed || shortCaps ? word : lower;
      return i === 0 && kept === lower ? lower.charAt(0).toUpperCase() + lower.slice(1) : kept;
    })
    .join(" ");
}

/**
 * Dedupe key: lowercase, "&"/"and" dropped, hyphen/slash/underscore → space,
 * punctuation gone, last word singularized. "Award-Flights" and "award
 * flight" → "award flight"; "Bars & Lounges" → "bar lounge".
 * Must stay in step with the keys seeded in 025_board.sql.
 */
export function topicKey(raw: string): string {
  const words = stripEmoji(raw.normalize("NFKC"))
    .toLowerCase()
    .replace(/[-/_]/g, " ")
    .replace(/&/g, " ")
    .replace(/[^\p{L}\p{N}\s+]/gu, "")
    .split(/\s+/)
    .filter((w) => w && w !== "and");
  return words.map((w, i) => (i === words.length - 1 ? singularize(w) : w)).join(" ");
}

export type TopicValidation =
  | { ok: true; name: string; key: string }
  | { ok: false; error: string };

const URL_LIKE = /(?:https?:|www\.|\.(?:com|net|org|io|co|ly|me|app)\b)/i;

export interface ValidateTopicOptions {
  /**
   * Offensive-name check. The router passes
   * `(name) => scanBlocklist(name, terms).tier !== null`; the composer omits
   * it so obscenity never ships to the client.
   */
  isBlocked?: (name: string) => boolean;
}

/** Member-facing validation for a new topic name (plan §12.1). */
export function validateTopic(raw: string, opts: ValidateTopicOptions = {}): TopicValidation {
  if (/[@#]/.test(raw) || URL_LIKE.test(raw)) return { ok: false, error: "Topics can't include links, @ or #." };
  const name = normalizeTopic(raw);
  const key = topicKey(name);
  if (name.length < TOPIC_RULES.minLength || !key) return { ok: false, error: `Topics need at least ${TOPIC_RULES.minLength} characters.` };
  if (!/\p{L}/u.test(name)) return { ok: false, error: "Topics need at least one letter." };
  if (name.split(" ").length > TOPIC_RULES.maxWords) return { ok: false, error: `Keep topics to ${TOPIC_RULES.maxWords} words or fewer.` };
  if (opts.isBlocked?.(name)) return { ok: false, error: "That topic name breaks the board rules." };
  return { ok: true, name, key };
}

// ─── Client-side matching (composer) ────────────────────────────────────────

export interface TopicRef {
  id?: string;
  name: string;
  key: string;
}

function bigrams(s: string): Map<string, number> {
  const padded = ` ${s} `;
  const out = new Map<string, number>();
  for (let i = 0; i < padded.length - 1; i++) {
    const g = padded.slice(i, i + 2);
    out.set(g, (out.get(g) ?? 0) + 1);
  }
  return out;
}

/** Sørensen–Dice over character bigrams, 0–1. Client stand-in for pg_trgm. */
export function keySimilarity(a: string, b: string): number {
  if (a === b) return 1;
  const ga = bigrams(a);
  const gb = bigrams(b);
  let overlap = 0;
  let total = 0;
  for (const [g, n] of ga) {
    overlap += Math.min(n, gb.get(g) ?? 0);
    total += n;
  }
  for (const n of gb.values()) total += n;
  return total === 0 ? 0 : (2 * overlap) / total;
}

export interface TopicMatch<T extends TopicRef> {
  /** Same key, or same loyalty program ("Hyatt" ≈ "World of Hyatt") — use it, don't create */
  exact: T | null;
  /** Strong near-match worth a "Did you mean …?" prompt */
  didYouMean: T | null;
  /** "Use existing:" chips — substring or similar, best first, max 5 */
  suggestions: T[];
}

let programNames: string[] | null = null;
function knownPrograms(): string[] {
  if (!programNames) programNames = [...new Set(Object.values(SEED_TRANSFER_PARTNERS).flat().map((p) => p.program))];
  return programNames;
}

/** True when `name` is (a spelling of) a known loyalty program. */
export function isProgramTopic(name: string): boolean {
  return knownPrograms().some((p) => sameProgram(p, name));
}

/**
 * Same-program match for topics ("Hyatt" ≈ "World of Hyatt"). Only applies
 * when both names are loyalty programs — sameProgram's subset rule would
 * otherwise make "Award" swallow "Award flights".
 */
export function sameProgramTopic(a: string, b: string): boolean {
  return sameProgram(a, b) && isProgramTopic(a) && isProgramTopic(b);
}

/** Composer dedupe preview for a draft topic name (plan §12.4). */
export function matchTopic<T extends TopicRef>(draft: string, topics: readonly T[]): TopicMatch<T> {
  const key = topicKey(draft);
  if (!key) return { exact: null, didYouMean: null, suggestions: [] };

  const exact = topics.find((t) => t.key === key) ?? topics.find((t) => sameProgramTopic(t.name, draft)) ?? null;
  const scored = topics
    .filter((t) => t !== exact)
    .map((t) => ({ t, sim: t.key.includes(key) || key.includes(t.key) ? Math.max(0.7, keySimilarity(key, t.key)) : keySimilarity(key, t.key) }))
    .filter((x) => x.sim >= TOPIC_RULES.suggestSimilarity)
    .sort((a, b) => b.sim - a.sim || a.t.name.localeCompare(b.t.name));

  const top = scored[0];
  return {
    exact,
    didYouMean: !exact && top && top.sim >= TOPIC_RULES.autoMergeSimilarity ? top.t : null,
    suggestions: scored.slice(0, 5).map((x) => x.t),
  };
}

/** Keyword hints for the seeded common topics, keyed by topic key. */
const TOPIC_HINTS: Record<string, readonly string[]> = {
  "transfer bonus": ["transfer bonus", "transfer", "bonus", "ratio", "partner", "transferred"],
  "hotel": ["hotel", "stay", "night", "resort", "suite", "room", "hyatt", "marriott", "hilton", "ihg", "bonvoy", "check in"],
  "award flight": ["award", "flight", "seat", "saver", "business class", "first class", "economy", "miles", "airline", "cabin"],
  "statement credit": ["statement credit", "credit", "offer", "offers tab", "spend", "posted", "reimburse"],
};

/**
 * Best existing topic for a draft post, from title + body keywords (plan
 * §12.4 "Suggested"). A topic's own key words count as hints, so custom
 * topics are suggested too. Null when nothing scores.
 */
export function suggestTopicForText<T extends TopicRef>(text: string, topics: readonly T[]): T | null {
  const norm = ` ${normalizeForLexicon(text)} `;
  if (norm.trim() === "") return null;

  let best: { t: T; score: number } | null = null;
  for (const t of topics) {
    const hints = new Set([...(TOPIC_HINTS[t.key] ?? []), t.key, ...t.key.split(" ").filter((w) => w.length >= 4)]);
    let score = 0;
    for (const hint of hints) {
      if (norm.includes(` ${hint} `) || norm.includes(` ${hint}s `)) score += hint.includes(" ") ? 2 : 1;
    }
    if (score > 0 && (!best || score > best.score)) best = { t, score };
  }
  return best?.t ?? null;
}
