import "dotenv/config";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { SOURCES, type SourceConfig } from "./sources";
import { fetchStatic, fetchRendered, closeBrowser } from "./fetch";
import { extractRecords } from "./extract";
import { upsertRecord } from "./upsert";
import { invalidateCacheFor } from "./cache";
import { recordSyncRun } from "./audit";

// process.env.SOURCE_KEY_FILTER lets the GitHub Actions workflow_dispatch
// input re-run a single source (e.g. after fixing an extraction prompt)
// instead of the full batch.
const SOURCE_KEY_FILTER = process.env.SOURCE_KEY_FILTER;

async function runSource(source: SourceConfig): Promise<void> {
  const startedAt = new Date();
  const supabase = getSupabaseAdmin();

  console.log(`[${source.key}] fetching ${source.url} (${source.needsBrowser ? "rendered" : "static"})`);

  try {
    const fetched = source.needsBrowser
      ? await fetchRendered(source.url)
      : await fetchStatic(source.url);

    const fetchMs = Date.now() - startedAt.getTime();
    console.log(`[${source.key}] fetch step done in ${fetchMs}ms`);

    if (!fetched) {
      await recordSyncRun(supabase, {
        sourceKey: source.key,
        sourceUrl: source.url,
        status: "partial",
        recordsFound: 0,
        recordsWritten: 0,
        errorMessage: "robots.txt disallowed this path, or the fetch failed",
        startedAt,
      });
      console.log(`[${source.key}] skipped — disallowed or fetch failed`);
      return;
    }

    const extracted = await extractRecords(source.recordType, fetched.text, source.url);

    let written = 0;
    for (const record of extracted.records) {
      const ok = await upsertRecord({ supabase, sourceUrl: source.url }, source.recordType, record);
      if (ok) written++;
    }
    if (written > 0) await invalidateCacheFor(source.recordType);

    await recordSyncRun(supabase, {
      sourceKey: source.key,
      sourceUrl: source.url,
      status: written === extracted.records.length ? "success" : "partial",
      recordsFound: extracted.records.length,
      recordsWritten: written,
      llmModel: "claude-sonnet-5",
      llmTokensUsed: extracted.tokensUsed,
      rawTextExcerpt: fetched.text,
      startedAt,
    });

    console.log(`[${source.key}] found ${extracted.records.length}, wrote ${written} pending`);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    const elapsedMs = Date.now() - startedAt.getTime();
    await recordSyncRun(supabase, {
      sourceKey: source.key,
      sourceUrl: source.url,
      status: "failed",
      recordsFound: 0,
      recordsWritten: 0,
      errorMessage,
      startedAt,
    });
    console.error(`[${source.key}] failed after ${elapsedMs}ms: ${errorMessage}`);
    if (err instanceof Error && err.stack) console.error(err.stack);
    if (err instanceof Error && "cause" in err && err.cause) {
      console.error(`[${source.key}] cause:`, err.cause);
    }
  }
}

async function main(): Promise<void> {
  console.log(`SOURCE_KEY_FILTER=${SOURCE_KEY_FILTER ?? "(unset)"}`);

  const targets =
    SOURCE_KEY_FILTER && SOURCE_KEY_FILTER !== "all"
      ? SOURCES.filter((source) => source.key === SOURCE_KEY_FILTER)
      : SOURCES;

  if (targets.length === 0) {
    console.error(`No source matches SOURCE_KEY_FILTER=${SOURCE_KEY_FILTER}`);
    process.exit(1);
  }

  console.log(`running ${targets.length} source(s): ${targets.map((s) => s.key).join(", ")}`);

  // Sequential, not parallel — the rate limiter in fetch.ts is per-domain
  // in-process state, and sequential runs keep total request pressure low
  // across all 5 issuer domains for one weekly run.
  for (const source of targets) {
    await runSource(source);
  }

  await closeBrowser();
  console.log("done");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
