// npm run db:push:dev [-- --dry]
//
// Dry-runs, then pushes, any migration in supabase/migrations/ that the
// covelo-dev history has not recorded. Hard-wired to the dev project: it
// links the CLI to dev itself and never targets anything else.
//
//   --dry   stop after the dry run
//
// Uses the Supabase CLI's own login (no DB password needed).

import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import {
  outOfOrderMigrations, parseMigrationList, pendingMigrations, remoteOnlyMigrations, type MigrationRow,
} from "./history";

const DEV_REF = "erwsamxgdyhypwibtqrl"; // covelo-dev
const LINK_FILE = "supabase/.temp/project-ref";

function fail(message: string): never {
  console.error(`\n✗ ${message}`);
  process.exit(1);
}

function cli(args: string[], opts: { capture?: boolean } = {}) {
  const res = spawnSync("supabase", args, {
    encoding: "utf8",
    stdio: opts.capture ? ["inherit", "pipe", "pipe"] : "inherit",
  });
  if (res.error) fail(`Could not run the Supabase CLI (${res.error.message}). Install it: https://supabase.com/docs/guides/cli`);
  return res;
}

function linkedRef(): string | null {
  return existsSync(LINK_FILE) ? readFileSync(LINK_FILE, "utf8").trim() : null;
}

function listMigrations(): MigrationRow[] {
  // Ask for JSON outright: left to itself the CLI answers in a table unless it believes an AI agent is calling
  const res = cli(["migration", "list", "--linked", "--output-format", "json"], { capture: true });
  if (res.status !== 0) fail(`supabase migration list failed:\n${res.stderr || res.stdout}`);
  try {
    return parseMigrationList(`${res.stdout}\n${res.stderr}`);
  } catch (err) {
    return fail(err instanceof Error ? err.message : String(err));
  }
}

/** "027_board_vote_edit.sql — <first comment line>" for a pending version. */
function describe(version: string): string {
  const name = readdirSync("supabase/migrations").find((f) => f.startsWith(`${version}_`));
  if (!name) return version;
  const comment = readFileSync(`supabase/migrations/${name}`, "utf8")
    .split("\n")
    .find((l) => l.startsWith("--") && !l.includes("Run in Supabase"));
  return comment ? `${name}  ${comment.replace(/^--\s*/, "— ")}` : name;
}

const dryOnly = process.argv.includes("--dry");

// 1. Only ever dev
if (linkedRef() !== DEV_REF) {
  console.log(`CLI is linked to ${linkedRef() ?? "nothing"}; linking to covelo-dev (${DEV_REF}).`);
  if (cli(["link", "--project-ref", DEV_REF]).status !== 0) fail("Could not link to covelo-dev.");
}
if (linkedRef() !== DEV_REF) fail(`Refusing to continue: linked project is not covelo-dev (${DEV_REF}).`);
console.log(`Target: covelo-dev (${DEV_REF})\n`);

// 2. What is pending?
const rows = listMigrations();
const remoteOnly = remoteOnlyMigrations(rows);
if (remoteOnly.length > 0) {
  fail(
    `covelo-dev has migrations this branch doesn't: ${remoteOnly.join(", ")}.\n` +
    "  Pull or merge the branch that added them before pushing.",
  );
}
const outOfOrder = outOfOrderMigrations(rows);
if (outOfOrder.length > 0) {
  fail(
    `Pending migration(s) ${outOfOrder.join(", ")} are older than the newest one on dev.\n` +
    "  Renumber them after the latest version, or push with `supabase db push --linked --include-all` yourself.",
  );
}
const pending = pendingMigrations(rows);
if (pending.length === 0) {
  console.log("✓ covelo-dev is up to date — nothing to push.");
  process.exit(0);
}
console.log(`Pending on covelo-dev (${pending.length}):`);
for (const v of pending) console.log(`  • ${describe(v)}`);

// 3. Dry run, then push
console.log("\n— Dry run —");
if (cli(["db", "push", "--linked", "--dry-run"]).status !== 0) fail("Dry run failed; nothing was pushed.");
if (dryOnly) {
  console.log("\n✓ Dry run only (--dry); nothing was pushed.");
  process.exit(0);
}

console.log("\n— Pushing to covelo-dev —");
if (cli(["db", "push", "--linked", "--yes"]).status !== 0) {
  fail("Push failed. Postgres runs each migration file in a transaction, so a failed file left no partial changes; earlier files in this run may have been applied.");
}

// 4. Confirm the history caught up
const after = pendingMigrations(listMigrations());
if (after.length > 0) fail(`Push finished but these are still unrecorded: ${after.join(", ")}.`);
console.log(`\n✓ Pushed ${pending.length} migration(s) to covelo-dev; history is in sync.`);
