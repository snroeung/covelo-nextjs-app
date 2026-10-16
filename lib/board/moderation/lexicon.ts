// Stage 3 (plan §8.1). Cheap topicality signal: how many travel / points
// words a post uses. A post with zero hits that the classifier also calls
// off-topic is held; any hit keeps borderline posts up.

import { SEED_TRANSFER_PARTNERS } from "@/lib/points/transferPartners";
import { programTokens } from "@/lib/points/programNames";
import { normalizeForLexicon } from "./normalize";

const GENERAL_TERMS = [
  // travel
  "travel", "trip", "vacation", "flight", "airline", "airport", "lounge", "layover", "itinerary",
  "hotel", "resort", "stay", "night", "suite", "room", "check in", "checkin", "check out",
  "cruise", "rental car", "car rental", "passport", "tsa", "precheck", "global entry", "clear",
  "seat", "cabin", "economy", "premium economy", "business class", "first class", "upgrade",
  "saver", "alliance", "oneworld", "star alliance", "skyteam", "codeshare", "nonstop", "redeye",
  "booking", "fare", "destination",
  // points
  "points", "pts", "miles", "award", "redeem", "redemption", "transfer", "transfer bonus",
  "transfer partner", "portal", "cpp", "cents per point", "valuation", "status", "elite",
  "loyalty", "rewards", "bonus", "sign up bonus", "signup bonus", "sub", "welcome offer",
  "annual fee", "statement credit", "cash back", "cashback", "multiplier", "free night",
  "certificate", "companion pass", "companion fare", "credit card", "card", "churn", "5 24",
  // issuers + currencies + card families
  "chase", "amex", "american express", "capital one", "citi", "bilt", "ultimate rewards",
  "membership rewards", "thankyou", "venture", "venture x", "sapphire", "sapphire reserve",
  "sapphire preferred", "freedom", "ink", "platinum", "gold card", "strata", "rent day",
  // brands not in the transfer seed
  "hyatt", "marriott", "hilton", "ihg", "wyndham", "accor", "four seasons", "aman", "ritz",
  "delta", "united", "american airlines", "southwest", "alaska", "jetblue", "frontier", "spirit",
];

/** Tokens that are real words too generic to count as a points signal on their own. */
const GENERIC_BRAND_TOKENS = new Set(["air", "one", "plus", "world", "blue", "guest", "true", "club", "go", "ana", "eva"]);

function buildTerms(): string[] {
  const terms = new Set(GENERAL_TERMS.map(normalizeForLexicon));
  for (const partners of Object.values(SEED_TRANSFER_PARTNERS)) {
    for (const p of partners) {
      terms.add(normalizeForLexicon(p.program));
      for (const token of programTokens(p.program)) {
        if (token.length >= 3 && !GENERIC_BRAND_TOKENS.has(token)) terms.add(token);
      }
    }
  }
  terms.delete("");
  return [...terms];
}

let compiled: Array<{ term: string; re: RegExp }> | null = null;
function terms() {
  if (!compiled) {
    compiled = buildTerms().map((term) => ({
      term,
      // whole words, optional plural "s"
      re: new RegExp(`(?:^| )${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}s?(?= |$)`),
    }));
  }
  return compiled;
}

export interface LexiconResult {
  /** Distinct lexicon terms found */
  score: number;
  hits: string[];
}

export function lexiconScore(text: string): LexiconResult {
  const norm = normalizeForLexicon(text);
  if (!norm) return { score: 0, hits: [] };
  const hits = terms().filter((t) => t.re.test(norm)).map((t) => t.term);
  return { score: hits.length, hits };
}
