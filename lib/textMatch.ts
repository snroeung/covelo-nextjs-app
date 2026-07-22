const STOPWORDS = new Set(["hotel", "the", "a", "an", "and", "&", "of", "at", "by", "inn", "suites", "suite", "resort", "spa"]);

export function tokenize(name: string | undefined | null): Set<string> {
  if (!name) return new Set();
  return new Set(
    name
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, "")
      .split(/\s+/)
      .filter((w) => w.length > 1 && !STOPWORDS.has(w)),
  );
}

export function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  let intersection = 0;
  for (const token of a) {
    if (b.has(token)) intersection++;
  }
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}
