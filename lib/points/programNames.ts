// Shared program-name canonicalization for transfer partners. Used both by
// the cron scraper (scripts/portal-sync/upsert.ts) to avoid re-inserting a
// program under a new pending row when its name is scraped slightly
// differently, and by calcTransferAlternatives (this dir) to merge the same
// real-world loyalty program into one UI row when different portals'
// approved rows spell it differently (e.g. "TAP Air Portugal Miles&Go" on
// Capital One vs "TAP Miles&Go" on Bilt).
const FILLER_WORDS = new Set(["airlines", "airline"]);

/**
 * Loyalty-program scaffolding that says nothing about *which* program this is.
 * Issuers write the same partner as "British Airways Club", "British Airways
 * Executive Club" and "British Airways Avios"; strip these and all three state
 * the same brand. `avios` and `miles` are here because they name shared
 * currencies, not programs — Qatar and British Airways both issue Avios.
 */
const PROGRAM_STRUCTURE_WORDS = new Set([
  "club", "executive", "privilege", "program", "programme", "loyalty",
  "rewards", "reward", "avios", "miles", "mile", "points", "point", "the",
]);

/** Single tokens too generic to merge a program on by themselves. */
const WEAK_TOKENS = new Set(["air", "one", "plus", "world", "hotel", "hotels"]);

// Same-program names the token rule cannot reach — different brand words for
// one program. Keyed by normalized variant -> normalized canonical form.
const PROGRAM_ALIASES: Record<string, string> = {
  "aadvantage": "american aadvantage",
};

/** Lowercased, punctuation-free words with filler removed. */
function baseWords(name: string): string[] {
  return name
    .toLowerCase()
    .replace(/[/\-–—]/g, " ")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\s]/g, "")
    .split(/\s+/)
    .filter((word) => word && !FILLER_WORDS.has(word));
}

export function normalizeProgramName(name: string): string {
  const base = baseWords(name).join(" ").trim();
  return PROGRAM_ALIASES[base] ?? base;
}

/**
 * The brand words that identify a program — everything left after the
 * structural words come out. "Qatar Airways Privilege Club (Avios)" and
 * "Qatar Airways Avios" both reduce to {qatar, airways}.
 */
export function programTokens(name: string): Set<string> {
  const tokens = baseWords(normalizeProgramName(name)).filter(
    (word) => !PROGRAM_STRUCTURE_WORDS.has(word),
  );
  // A name made entirely of structural words keeps them rather than vanishing.
  return new Set(tokens.length > 0 ? tokens : baseWords(name));
}

function isSubset(small: Set<string>, large: Set<string>): boolean {
  for (const token of small) if (!large.has(token)) return false;
  return true;
}

/**
 * Two names describe one program when one's brand tokens contain the other's —
 * "British Airways Club" ⊂ "British Airways Executive Club", "TAP Miles&Go" ⊂
 * "TAP Air Portugal Miles&Go". Guarded so a name that reduces to a single weak
 * token ("Air …") can't swallow unrelated programs.
 */
export function sameProgram(a: string, b: string): boolean {
  const ta = programTokens(a);
  const tb = programTokens(b);
  if (ta.size === 0 || tb.size === 0) return false;
  const [small, large] = ta.size <= tb.size ? [ta, tb] : [tb, ta];
  if (!isSubset(small, large)) return false;
  if (small.size > 1) return true;
  const [only] = [...small];
  return !WEAK_TOKENS.has(only) && only.length >= 3;
}

/**
 * Cluster a batch of program names, returning name → shared key.
 *
 * Merging has to be decided across the whole batch, not name by name: the
 * chain "I Prefer Hotel Rewards" → "I Prefer Hotel Rewards (Preferred Hotels &
 * Resorts)" → "Preferred Hotels & Resorts" only collapses when the middle name
 * links the two ends. Each cluster's key is its shortest member, so the key
 * stays stable as longer spellings come and go.
 */
export function clusterProgramNames(names: string[]): Map<string, string> {
  const clusters: Array<{ key: string; members: string[] }> = [];

  for (const name of names) {
    const matched = clusters.filter((c) => c.members.some((m) => sameProgram(m, name)));
    if (matched.length === 0) {
      clusters.push({ key: normalizeProgramName(name), members: [name] });
      continue;
    }
    // A name can bridge two clusters that never matched each other directly.
    const [head, ...rest] = matched;
    head.members.push(name);
    for (const other of rest) {
      head.members.push(...other.members);
      clusters.splice(clusters.indexOf(other), 1);
    }
    head.key = head.members
      .map(normalizeProgramName)
      .reduce((shortest, cur) => (cur.length < shortest.length ? cur : shortest));
  }

  const keyed = new Map<string, string>();
  for (const cluster of clusters) {
    for (const member of cluster.members) keyed.set(member, cluster.key);
  }
  return keyed;
}
