// Pure helpers for reading `supabase migration list --linked` output.
// Kept apart from run.ts so they can be unit-tested without the CLI.

export interface MigrationRow {
  local: string;
  remote: string;
  time: string;
}

/** The JSON form: one {"migrations":[{local, remote, time}, …]} object among progress lines. */
function parseJson(output: string): MigrationRow[] | null {
  const line = output.split("\n").find((l) => l.trimStart().startsWith("{") && l.includes('"migrations"'));
  if (!line) return null;
  const parsed = JSON.parse(line) as { migrations?: MigrationRow[] };
  if (!Array.isArray(parsed.migrations)) throw new Error("Unexpected migration list shape from the Supabase CLI.");
  return parsed.migrations;
}

/**
 * The human form a normal terminal gets:
 *
 *    Local | Remote | Time (UTC)
 *   -------|--------|------------
 *    `001` | `001`  | `001`
 *    `029` | ` `    | `029`    (a missing remote is a backticked space)
 */
function parseTable(output: string): MigrationRow[] {
  const rows: MigrationRow[] = [];
  for (const line of output.split("\n")) {
    if (!line.includes("|") || /^[\s|-]+$/.test(line)) continue; // not a row, or the ----|---- rule
    // Backticks first, then trim: an empty cell is rendered as `` ` ` `` (a backticked space)
    const cells = line.split("|").map((c) => c.replace(/`/g, "").trim());
    if (cells.length < 3 || cells[0].toLowerCase() === "local") continue; // the header
    rows.push({ local: cells[0], remote: cells[1], time: cells[2] });
  }
  return rows;
}

/**
 * Read `supabase migration list --linked`. The CLI answers in JSON when it
 * thinks an AI agent is calling it and in a table otherwise, whatever
 * --output-format says on an older version — so accept both. When neither
 * parses, the error carries what the CLI actually printed.
 */
export function parseMigrationList(output: string): MigrationRow[] {
  const rows = parseJson(output) ?? parseTable(output);
  if (rows.length === 0) {
    throw new Error(`Could not read the migration list from the Supabase CLI output:\n--- output (first 600 characters) ---\n${output.slice(0, 600)}`);
  }
  return rows;
}

/** Local files the remote history has not recorded yet — what `db push` would apply. */
export function pendingMigrations(rows: readonly MigrationRow[]): string[] {
  return rows.filter((r) => r.local && !r.remote).map((r) => r.local);
}

/** Versions the remote has recorded that no local file has — someone applied a migration this branch lacks. */
export function remoteOnlyMigrations(rows: readonly MigrationRow[]): string[] {
  return rows.filter((r) => r.remote && !r.local).map((r) => r.remote);
}

/**
 * Pending versions older than the newest remote one. `db push` refuses these
 * without --include-all, because applying them would run out of order.
 */
export function outOfOrderMigrations(rows: readonly MigrationRow[]): string[] {
  const newestRemote = rows.filter((r) => r.remote).map((r) => r.remote).sort().at(-1);
  if (!newestRemote) return [];
  return pendingMigrations(rows).filter((v) => v < newestRemote);
}
