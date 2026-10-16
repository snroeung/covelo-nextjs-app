// Stage 1 of the moderation pipeline (plan §8.1): offensive-word screening.
//
// All matching is done by `obscenity` (github.com/jo3-l/obscenity) — no
// offensive words are written anywhere in this repo. Its English dataset is
// the term list; its recommended transformers handle leetspeak, Unicode
// look-alikes, stretched letters and its whitelist avoids Scunthorpe-style
// false positives.
//
// Tiers:
//   - English dataset hit → `soft` → decide() holds the post for review. The
//     LLM classifier still runs and rejects outright at toxicity ≥ 0.85, so
//     slurs and threats are rejected, and held when the LLM is down.
//   - Admin terms from the board_blocked_terms table (passed as `extra`) are
//     matched through obscenity too, at the tier the admin chose.
//
// False positive from the dataset? Add the innocent phrase as a whitelisted
// term in `englishMatcher()` (PhraseBuilder.addWhitelistedTerm on a custom
// DataSet built with `.addAll(englishDataset)`), with a test.
//
// Server-only: keep this out of client bundles (topics.ts takes an
// `isBlocked` callback instead of importing it).

import {
  DataSet,
  RegExpMatcher,
  englishDataset,
  englishRecommendedTransformers,
  parseRawPattern,
} from "obscenity";

export type BlockTier = "hard" | "soft";

/** An admin-added term (board_blocked_terms row). */
export interface BlockedTerm {
  term: string;
  tier: BlockTier;
}

export interface BlocklistResult {
  tier: BlockTier | null;
  /** What matched — admin-facing only, never shown to the member */
  hits: string[];
}

interface Screen {
  matcher: RegExpMatcher;
  dataset: DataSet<{ originalWord?: string }>;
}

let english: Screen | null = null;

function englishMatcher(): Screen {
  if (!english) {
    english = {
      dataset: englishDataset,
      matcher: new RegExpMatcher({ ...englishDataset.build(), ...englishRecommendedTransformers }),
    };
  }
  return english;
}

/** Escape obscenity pattern syntax: `[ ]` optional, `?` wildcard, `|` word boundary, `\` escape. */
function escapePattern(term: string): string {
  return term.replace(/[[\]?|\\]/g, "\\$&");
}

function buildScreen(terms: readonly BlockedTerm[]): Screen | null {
  const dataset = new DataSet<{ originalWord?: string }>();
  let added = 0;
  for (const t of terms) {
    const term = t.term.trim().toLowerCase().replace(/\s+/g, " ");
    if (!term) continue;
    // Whole-word match: admins add specific words, not substrings
    dataset.addPhrase((p) => p.setMetadata({ originalWord: term }).addPattern(parseRawPattern(`|${escapePattern(term)}|`)));
    added++;
  }
  if (added === 0) return null;
  return { dataset, matcher: new RegExpMatcher({ ...dataset.build(), ...englishRecommendedTransformers }) };
}

// Admin term lists come from one DB read per request; cache compiled matchers
// by list identity so a request scanning title + body + topics compiles once.
const adminScreens = new WeakMap<readonly BlockedTerm[], { hard: Screen | null; soft: Screen | null }>();

function adminMatchers(extra: readonly BlockedTerm[]) {
  let screens = adminScreens.get(extra);
  if (!screens) {
    screens = {
      hard: buildScreen(extra.filter((t) => t.tier === "hard")),
      soft: buildScreen(extra.filter((t) => t.tier === "soft")),
    };
    adminScreens.set(extra, screens);
  }
  return screens;
}

function hitsFor(screen: Screen, text: string): string[] {
  return screen.matcher
    .getAllMatches(text, true)
    .map((m) => screen.dataset.getPayloadWithPhraseMetadata(m).phraseMetadata?.originalWord ?? "")
    .filter(Boolean);
}

/**
 * Screen text for offensive words. `hard` (admin terms only) wins over `soft`.
 * `extra` = the board_blocked_terms rows; pass the same array for every scan
 * in a request so its matchers compile once.
 */
export function scanBlocklist(text: string, extra: readonly BlockedTerm[] = []): BlocklistResult {
  if (!text.trim()) return { tier: null, hits: [] };

  const hits = new Set<string>();
  let tier: BlockTier | null = null;

  if (extra.length > 0) {
    const admin = adminMatchers(extra);
    if (admin.hard) {
      const h = hitsFor(admin.hard, text);
      if (h.length > 0) { tier = "hard"; h.forEach((x) => hits.add(x)); }
    }
    if (admin.soft) {
      const h = hitsFor(admin.soft, text);
      if (h.length > 0) { tier ??= "soft"; h.forEach((x) => hits.add(x)); }
    }
  }

  const h = hitsFor(englishMatcher(), text);
  if (h.length > 0) { tier ??= "soft"; h.forEach((x) => hits.add(x)); }

  return { tier, hits: [...hits] };
}
