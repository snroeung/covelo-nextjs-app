interface RobotsRules {
  disallow: string[];
  allow: string[];
}

const robotsCache = new Map<string, RobotsRules>();

function parseRobots(text: string, userAgent: string): RobotsRules {
  const lines = text.split("\n").map((line) => line.trim());
  const rules: RobotsRules = { disallow: [], allow: [] };
  let groupApplies = false;
  let sawSpecificGroup = false;

  for (const line of lines) {
    if (!line || line.startsWith("#")) continue;
    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) continue;

    const key = line.slice(0, colonIdx).trim().toLowerCase();
    const value = line.slice(colonIdx + 1).trim();

    if (key === "user-agent") {
      const ua = value.toLowerCase();
      if (ua === "*") {
        groupApplies = !sawSpecificGroup;
      } else if (userAgent.toLowerCase().includes(ua)) {
        groupApplies = true;
        sawSpecificGroup = true;
      } else {
        groupApplies = false;
      }
      continue;
    }

    if (!groupApplies || !value) continue;
    if (key === "disallow") rules.disallow.push(value);
    if (key === "allow") rules.allow.push(value);
  }

  return rules;
}

// Fetches and in-memory caches robots.txt per origin for the lifetime of the
// process (one run of run.ts). A fetch/parse failure is treated as fully
// disallowed — fail closed rather than crawl a page we couldn't check.
export async function isAllowed(url: string, userAgent: string): Promise<boolean> {
  const { origin, pathname } = new URL(url);

  let rules = robotsCache.get(origin);
  if (!rules) {
    try {
      const res = await fetch(`${origin}/robots.txt`, { headers: { "User-Agent": userAgent } });
      if (!res.ok) {
        console.warn(`[robots] ${origin}/robots.txt → HTTP ${res.status}, treating as no rules`);
      }
      rules = res.ok ? parseRobots(await res.text(), userAgent) : { disallow: [], allow: [] };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[robots] fetch failed for ${origin}/robots.txt: ${message} — failing closed`);
      rules = { disallow: ["/"], allow: [] };
    }
    robotsCache.set(origin, rules);
  }

  const disallowed = rules.disallow.some((rule) => pathname.startsWith(rule));
  const explicitlyAllowed = rules.allow.some((rule) => pathname.startsWith(rule));
  const result = !disallowed || explicitlyAllowed;
  if (!result) console.log(`[robots] ${pathname} disallowed by ${origin}/robots.txt`);
  return result;
}

export function clearRobotsCache(): void {
  robotsCache.clear();
}
