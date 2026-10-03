import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, flaggedProcedure, authedProcedure } from "@/server/trpc";
import { createClient } from "@/lib/supabase/server";
import { classifyReport } from "@/lib/reports/classify";
import type { BookingReport, ReportResult } from "@/lib/reports/types";

// No Redis layer: reports are user-generated and must show up for the reporter
// (and everyone else) the moment they're submitted, and the read is a single
// indexed lookup. Nothing here goes through lib/cache-config.ts.

const subjectType = z.enum(["flight", "hotel"]);
// Shape alone lets 2026-13-45 through to a Postgres DATE cast — round-trip it.
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(
  (s) => { const d = new Date(`${s}T00:00:00Z`); return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s; },
  { message: "Invalid date" },
);

/** One report per user per option per window, and a per-user hourly cap — keeps one account from flooding a subject. */
const REPORT_COOLDOWN_MS = 10 * 60 * 1000;
const REPORTS_PER_HOUR = 30;

const quoteSchema = z.object({
  cash: z.number().nonnegative().max(1_000_000),
  points: z.number().int().nonnegative().max(100_000_000).nullable(),
  start: isoDate,
  end: isoDate.nullable(),
});

interface ReportRow {
  id: string;
  user_id: string;
  reporter_name: string;
  option_key: string;
  result: ReportResult;
  quoted_cash: number | string;
  reported_cash: number | string | null;
  reported_points: number | null;
  reported_start: string | null;
  reported_end: string | null;
  created_at: string;
}

const num = (v: number | string | null): number | null => (v === null ? null : Number(v));

/** Strips user_id — the client only learns whether a row is its own. */
function toReport(row: ReportRow, viewerId: string | null): BookingReport {
  return {
    id: row.id,
    optionKey: row.option_key,
    reporterName: row.reporter_name,
    result: row.result,
    quotedCash: Number(row.quoted_cash),
    reportedCash: num(row.reported_cash),
    reportedPoints: row.reported_points,
    reportedStart: row.reported_start,
    reportedEnd: row.reported_end,
    createdAt: row.created_at,
    isMine: viewerId !== null && row.user_id === viewerId,
  };
}

export const reportsRouter = router({
  /** Every report for one itinerary / room, grouped by booking option, newest first. */
  list: flaggedProcedure("api:reports")
    .input(z.object({ subjectType, subjectKey: z.string().min(1).max(500) }))
    .query(async ({ input }): Promise<Record<string, BookingReport[]>> => {
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from("booking_reports")
        .select("id, user_id, reporter_name, option_key, result, quoted_cash, reported_cash, reported_points, reported_start, reported_end, created_at")
        .eq("subject_type", input.subjectType)
        .eq("subject_key", input.subjectKey)
        .order("created_at", { ascending: false })
        .limit(200);

      if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });

      const grouped: Record<string, BookingReport[]> = {};
      for (const row of (data ?? []) as ReportRow[]) {
        (grouped[row.option_key] ??= []).push(toReport(row, user?.id ?? null));
      }
      return grouped;
    }),

  /**
   * Records what the traveller saw. `entered` null means "couldn't find it".
   * The result is recomputed here from quote vs entered — the client's own
   * Matched/Different label is never trusted.
   */
  submit: authedProcedure("api:reports")
    .input(z.object({
      subjectType,
      subjectKey: z.string().min(1).max(500),
      optionKey: z.string().min(1).max(200),
      optionName: z.string().min(1).max(200),
      quote: quoteSchema,
      entered: quoteSchema.nullable(),
    }))
    .mutation(async ({ input, ctx }): Promise<BookingReport> => {
      const { supabase, user } = ctx;
      const result = classifyReport(input.quote, input.entered);

      const now = Date.now();
      const { data: recent, error: recentError } = await supabase
        .from("booking_reports")
        .select("subject_key, option_key, created_at")
        .eq("user_id", user.id)
        .gte("created_at", new Date(now - 60 * 60 * 1000).toISOString())
        .limit(REPORTS_PER_HOUR);
      if (recentError) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: recentError.message });
      const recentRows = (recent ?? []) as { subject_key: string; option_key: string; created_at: string }[];
      const dupe = recentRows.some(r =>
        r.subject_key === input.subjectKey &&
        r.option_key === input.optionKey &&
        now - new Date(r.created_at).getTime() < REPORT_COOLDOWN_MS,
      );
      if (dupe || recentRows.length >= REPORTS_PER_HOUR) {
        throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "You've already reported this recently." });
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("id", user.id)
        .single();
      // Rows are immutable, so take the best name available now: profile, then
      // the OAuth name on the auth user, then a neutral fallback.
      const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
      const reporterName =
        (profile as { display_name: string | null } | null)?.display_name?.trim() ||
        (typeof meta.full_name === "string" ? meta.full_name.trim() : "") ||
        "Traveler";

      const { data, error } = await supabase
        .from("booking_reports")
        .insert({
          user_id: user.id,
          reporter_name: reporterName,
          subject_type: input.subjectType,
          subject_key: input.subjectKey,
          option_key: input.optionKey,
          option_name: input.optionName,
          quoted_cash: input.quote.cash,
          quoted_points: input.quote.points,
          searched_start: input.quote.start,
          searched_end: input.quote.end,
          reported_cash: input.entered?.cash ?? null,
          reported_points: input.entered?.points ?? null,
          reported_start: input.entered?.start ?? null,
          reported_end: input.entered?.end ?? null,
          result,
        })
        .select("id, user_id, reporter_name, option_key, result, quoted_cash, reported_cash, reported_points, reported_start, reported_end, created_at")
        .single();

      if (error || !data) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error?.message ?? "Insert failed" });
      }
      return toReport(data as ReportRow, user.id);
    }),
});
