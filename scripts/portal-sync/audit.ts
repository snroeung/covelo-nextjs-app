import type { SupabaseClient } from "@supabase/supabase-js";

const RAW_TEXT_EXCERPT_MAX_CHARS = 20_000;

export interface RunAuditInput {
  sourceKey: string;
  sourceUrl: string;
  status: "success" | "partial" | "failed";
  recordsFound: number;
  recordsWritten: number;
  errorMessage?: string | null;
  llmModel?: string | null;
  llmTokensUsed?: number | null;
  rawTextExcerpt?: string | null;
  startedAt: Date;
}

export async function recordSyncRun(supabase: SupabaseClient, input: RunAuditInput): Promise<void> {
  await supabase.from("portal_sync_runs").insert({
    source_key: input.sourceKey,
    source_url: input.sourceUrl,
    status: input.status,
    records_found: input.recordsFound,
    records_written: input.recordsWritten,
    error_message: input.errorMessage ?? null,
    llm_model: input.llmModel ?? null,
    llm_tokens_used: input.llmTokensUsed ?? null,
    raw_text_excerpt: input.rawTextExcerpt
      ? input.rawTextExcerpt.slice(0, RAW_TEXT_EXCERPT_MAX_CHARS)
      : null,
    started_at: input.startedAt.toISOString(),
    finished_at: new Date().toISOString(),
  });
}
