import "dotenv/config";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { extractRecords } from "./extract";
import { SOURCES } from "./sources";
import type { RecordType } from "./schemas";

// Manual, pre-merge harness (never run in the weekly cron): replays saved
// raw_text_excerpt snapshots through the current extraction prompt and
// checks whether previously-recorded admin corrections would now match.
// Run this before merging any prompt/schema change in extract.ts.

interface CorrectionRow {
  run_id: string | null;
  record_type: RecordType;
  field: string;
  corrected_value: string | null;
}

interface SyncRunRow {
  source_key: string;
  source_url: string;
  raw_text_excerpt: string | null;
}

async function main(): Promise<void> {
  const supabase = getSupabaseAdmin();

  const { data: corrections, error } = await supabase
    .from("portal_sync_corrections")
    .select("run_id, record_type, field, corrected_value")
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) throw error;
  if (!corrections || corrections.length === 0) {
    console.log("No corrections recorded yet — nothing to eval against.");
    return;
  }

  const byRun = new Map<string, CorrectionRow[]>();
  for (const correction of corrections as CorrectionRow[]) {
    if (!correction.run_id) continue;
    byRun.set(correction.run_id, [...(byRun.get(correction.run_id) ?? []), correction]);
  }

  let matched = 0;
  let total = 0;

  for (const [runId, runCorrections] of byRun) {
    const { data: run, error: runError } = await supabase
      .from("portal_sync_runs")
      .select("source_key, source_url, raw_text_excerpt")
      .eq("id", runId)
      .single();

    if (runError || !run || !(run as SyncRunRow).raw_text_excerpt) {
      console.log(`[${runId}] skipped — no raw_text_excerpt saved for this run`);
      continue;
    }

    const typedRun = run as SyncRunRow;
    const recordType = runCorrections[0].record_type;
    const source = SOURCES.find((s) => s.key === typedRun.source_key);
    const replay = await extractRecords(
      recordType,
      typedRun.raw_text_excerpt as string,
      typedRun.source_url,
      source?.extraInstructions,
    );

    for (const correction of runCorrections) {
      total++;
      const replayedValue = replay.records
        .map((record) => (record as Record<string, unknown>)[correction.field])
        .find((value) => value !== undefined);
      if (String(replayedValue ?? "") === correction.corrected_value) matched++;
    }

    console.log(`[${typedRun.source_key}] replayed ${replay.records.length} record(s)`);
  }

  console.log(`Eval result: ${matched}/${total} previously-corrected fields matched on replay`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
