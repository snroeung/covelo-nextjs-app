// Regenerates DEPS.md (reverse import map). Run by the SessionStart hook.
import fs from "fs";
import path from "path";

const roots = ["app", "components", "lib", "server", "contexts", "hooks"];
const files = [];
for (const r of roots)
  (function walk(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.(ts|tsx)$/.test(e.name)) files.push(p);
    }
  })(r);

const set = new Set(files);
function resolve(from, spec) {
  const p = spec.startsWith("@/") ? spec.slice(2)
    : spec.startsWith(".") ? path.normalize(path.join(path.dirname(from), spec))
    : null;
  if (!p) return null;
  for (const c of [p, p + ".ts", p + ".tsx", path.join(p, "index.ts"), path.join(p, "index.tsx")])
    if (set.has(c)) return c;
  return null;
}

const rev = {};
for (const f of files) {
  const src = fs.readFileSync(f, "utf8");
  const re = /(?:^|\n)\s*(?:import|export)[^;]*?from\s+["']([^"']+)["']/g;
  let m;
  while ((m = re.exec(src))) {
    const t = resolve(f, m[1]);
    if (t && t !== f) (rev[t] = rev[t] || new Set()).add(f);
  }
}

const body = Object.entries(rev)
  .sort((a, b) => b[1].size - a[1].size)
  .map(([t, s]) => `${t} << ${[...s].sort().join(", ")}`)
  .join("\n");

fs.writeFileSync("DEPS.md", `# Module Dependency Map (generated ${new Date().toISOString().slice(0, 10)})

Reverse import map: \`target << files that import it\`. Sorted by importer count.
Grep this file for a path to get its importers (blast radius) — do not read the whole file.
Covers \`@/\` and relative imports across app/, components/, lib/, server/, contexts/, hooks/.
Auto-regenerated each session by scripts/dep-graph.mjs (SessionStart hook) — do not edit.

\`\`\`
${body}
\`\`\`
`);
console.log(`DEPS.md: ${Object.keys(rev).length} modules, ${files.length} files scanned`);
