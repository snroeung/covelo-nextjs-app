// Shared program-name canonicalization for transfer partners. Used both by
// the cron scraper (scripts/portal-sync/upsert.ts) to avoid re-inserting a
// program under a new pending row when its name is scraped slightly
// differently, and by calcTransferAlternatives (this dir) to merge the same
// real-world loyalty program into one UI row when different portals'
// approved rows spell it differently (e.g. "TAP Air Portugal Miles&Go" on
// Capital One vs "TAP Miles&Go" on Bilt).
const FILLER_WORDS = new Set(["airlines", "airline"]);

// Known same-program alternate names, keyed by normalized variant -> normalized canonical form.
// Add here as new mismatches surface in admin review.
const PROGRAM_ALIASES: Record<string, string> = {
  "british airways avios": "british airways executive club",
  "tap miles and go": "tap air portugal miles and go",
  "aadvantage program": "american aadvantage",
};

export function normalizeProgramName(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[/\-–—]/g, " ")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\s]/g, "")
    .split(/\s+/)
    .filter((word) => word && !FILLER_WORDS.has(word))
    .join(" ")
    .trim();
  return PROGRAM_ALIASES[base] ?? base;
}
