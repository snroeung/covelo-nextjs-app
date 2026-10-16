// Pure helpers for reading `supabase migration list --linked` output.
// Kept apart from run.ts so they can be unit-tested without the CLI.

export interface MigrationRow {
  local: string;
  remote: string;
  time: string;
}

/**
 * The CLI prints progress lines around one JSON object
 * ({"migrations":[{local, remote, time}, …]}). Pull that object out.
 */
export function parseMigrationList(stdout: string): MigrationRow[] {
  const line = stdout.split("\n").find((l) => l.trimStart().startsWith("{") && l.includes('"migrations"'));
  if (!line) throw new Error("Could not find the migration list JSON in the Supabase CLI output.");
  const parsed = JSON.parse(line) as { migrations?: MigrationRow[] };
  if (!Array.isArray(parsed.migrations)) throw new Error("Unexpected migration list shape from the Supabase CLI.");
  return parsed.migrations;
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
