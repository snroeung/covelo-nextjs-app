import { CARD_NAMES, ISSUER_BRAND_WORDS } from './types';

/**
 * Transfer ratios arrive as free text written for humans, not as `N:M`. The live
 * `transfer_partners` table carries thousands separators, several variants in one
 * string, and parenthetical qualifiers naming which cards each variant applies to:
 *
 *   "1:1 (standard, Sapphire Reserve); 4:3 (Chase Sapphire Preferred and Ink
 *    Business Preferred, effective 2026)"
 *   "1,000:1,200 (Strata Elite/Premier/Prestige) or 1,000:840 or 700 (other Citi
 *    ThankYou cards)"
 *
 * So the ratio is a property of the *card*, not the issuer, and a regex over the
 * whole string reads none of these — it used to return 1.0 for all of them, which
 * understated every affected row and disabled the better-ratio-wins rule.
 *
 * This module is the only place that interprets one. The grammar is driven by the
 * shape of the string with no issuer-specific branches, and anything it cannot
 * read degrades to 1:1 with the original text preserved for display.
 */

export interface ParsedTransferRatio {
  /** Partner points per source point. 1 when nothing parsable was found. */
  multiplier: number;
  /** Short, always-renderable form — "4:3", "1:1.2", or "ratio varies". */
  label: string;
  /** The original string, for a hover/title attribute. */
  detail: string;
}

const UNPARSEABLE_LABEL = 'ratio varies';

/** A pair plus the qualifier that says which cards it applies to. */
interface Variant {
  from: number;
  to: number;
  qualifier: string;
}

/** "1,000" → 1000. Written for values, not for locale-aware formatting. */
function toNumber(raw: string): number {
  return Number(raw.replace(/,/g, ''));
}

function words(text: string): Set<string> {
  return new Set(text.toLowerCase().split(/[^a-z0-9+]+/i).filter(Boolean));
}

/**
 * The distinctive part of a card name — "Citi Strata Premier" → {strata, premier}.
 * Issuer words are dropped because every qualifier on that issuer's row mentions
 * them: "other Citi ThankYou cards" would otherwise match every Citi card and
 * swallow the tier-specific variant that was written for exactly one of them.
 */
function cardWords(cardName: string): Set<string> {
  const generic = words(ISSUER_BRAND_WORDS.join(' '));
  return new Set([...words(cardName)].filter(w => !generic.has(w)));
}

/** Catch-all variants — the rate for cards no other variant names. */
function isFallbackQualifier(qualifier: string): boolean {
  const w = words(qualifier);
  return w.has('other') || w.has('standard') || w.has('others') || qualifier.trim() === '';
}

/**
 * Split on the separators these strings actually use, then pair each ratio with
 * its qualifier. A fragment carrying a qualifier but no ratio ("or 700 (other
 * Citi ThankYou cards)") hands that qualifier back to the preceding ratio, which
 * is how the Citi rows scope their fallback rate.
 */
function parseVariants(raw: string): Variant[] {
  const variants: Variant[] = [];
  for (const fragment of raw.split(/;|\bor\b/i)) {
    const pair = /(\d[\d,]*(?:\.\d+)?)\s*:\s*(\d[\d,]*(?:\.\d+)?)/.exec(fragment);
    const qualifier = (fragment.match(/\(([^)]*)\)/)?.[1] ?? '').trim();
    if (!pair) {
      if (qualifier && variants.length > 0) {
        const prev = variants[variants.length - 1];
        prev.qualifier = prev.qualifier ? `${prev.qualifier} ${qualifier}` : qualifier;
      }
      continue;
    }
    const from = toNumber(pair[1]);
    const to = toNumber(pair[2]);
    if (!from || !to || !Number.isFinite(from) || !Number.isFinite(to)) continue;
    variants.push({ from, to, qualifier });
  }
  return variants;
}

/** Every word of the card's distinctive name appearing in the qualifier. */
function namesCard(qualifier: string, cardName: string): boolean {
  const target = cardWords(cardName);
  if (target.size === 0) return false;
  const inQualifier = words(qualifier);
  return [...target].every(w => inQualifier.has(w));
}

function pickVariant(variants: Variant[], cardName?: string): Variant {
  if (cardName) {
    const named = variants.find(v => namesCard(v.qualifier, cardName));
    if (named) return named;
  }
  return variants.find(v => isFallbackQualifier(v.qualifier)) ?? variants[0];
}

/**
 * Small whole pairs read best exactly as written — "4:3" says more than "1:0.75",
 * and it is the form the program itself publishes. Anything larger is restated
 * against one source point, so "1,000:1,200" shows as "1:1.2" rather than a
 * reduced "5:6" nobody would recognise.
 */
function formatPair(from: number, to: number): string {
  if (Number.isInteger(from) && Number.isInteger(to) && from <= 99 && to <= 99) {
    return `${from}:${to}`;
  }
  return `1:${Math.round((to / from) * 100) / 100}`;
}

/**
 * @param raw      ratio string from the partner config
 * @param cardName resolves per-card variants; omit for the issuer's default rate
 */
export function parseTransferRatio(raw: string, cardName?: string): ParsedTransferRatio {
  const detail = (raw ?? '').trim();
  const variants = parseVariants(detail);
  if (variants.length === 0) {
    return { multiplier: 1, label: detail.length > 0 && detail.length <= 12 ? detail : UNPARSEABLE_LABEL, detail };
  }
  const chosen = pickVariant(variants, cardName);
  return {
    multiplier: chosen.to / chosen.from,
    label: formatPair(chosen.from, chosen.to),
    detail,
  };
}

/** Best rate any of these cards gets on the same config string. */
export function bestRatioFor(raw: string, cardNames: string[]): ParsedTransferRatio {
  const candidates = cardNames.length > 0
    ? cardNames.map(name => parseTransferRatio(raw, name))
    : [parseTransferRatio(raw)];
  return candidates.reduce((best, cur) => (cur.multiplier > best.multiplier ? cur : best));
}

/** Back-compat shim for callers that only need the number. */
export function ratioMultiplier(raw: string, cardId?: keyof typeof CARD_NAMES): number {
  return parseTransferRatio(raw, cardId ? CARD_NAMES[cardId] : undefined).multiplier;
}
