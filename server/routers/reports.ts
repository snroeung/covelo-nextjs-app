import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, flaggedProcedure, authedProcedure } from "@/server/trpc";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
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
const HOUR_MS = 60 * 60 * 1000;
const REPORT_COOLDOWN_MS = 24 * HOUR_MS;
const REPORTS_PER_HOUR = 5;
/** Most rows one user can have inside the cooldown window, given the hourly cap */
const MAX_ROWS_IN_COOLDOWN = REPORTS_PER_HOUR * (REPORT_COOLDOWN_MS / HOUR_MS);

const quoteSchema = z.object({
  cash: z.number().nonnegative().max(1_000_000),
  points: z.number().int().nonnegative().max(100_000_000).nullable(),
  start: isoDate,
  end: isoDate.nullable(),
}).refine((q) => q.end === null || q.end >= q.start, { message: "End date is before start date", path: ["end"] });

/** A booking_reports_feed row — user_id never leaves the database, only is_mine. */
interface ReportRow {
  id: string;
  is_mine: boolean | null;
  reporter_name: string;
  option_key: string;
  option_name: string;
  result: ReportResult;
  quoted_cash: number | string;
  reported_cash: number | string | null;
  reported_points: number | null;
  reported_start: string | null;
  reported_end: string | null;
  created_at: string;
}

const INSERT_COLUMNS = "id, reporter_name, option_key, option_name, result, quoted_cash, reported_cash, reported_points, reported_start, reported_end, created_at";
const FEED_COLUMNS = `${INSERT_COLUMNS}, is_mine`;

const num = (v: number | string | null): number | null => (v === null ? null : Number(v));

function toReport(row: ReportRow): BookingReport {
  return {
    id: row.id,
    optionKey: row.option_key,
    optionName: row.option_name,
    reporterName: row.reporter_name,
    result: row.result,
    quotedCash: Number(row.quoted_cash),
    reportedCash: num(row.reported_cash),
    reportedPoints: row.reported_points,
    reportedStart: row.reported_start,
    reportedEnd: row.reported_end,
    createdAt: row.created_at,
    isMine: row.is_mine === true,
  };
}

export const reportsRouter = router({
  /**
   * Every report for one itinerary / room, newest first. Flat on purpose: the
   * client assigns reports to rows (transfer partners match by program
   * identity, which an exact key can't express).
   */
  list: flaggedProcedure("api:reports")
    .input(z.object({ subjectType, subjectKey: z.string().min(1).max(500) }))
    .query(async ({ input }): Promise<BookingReport[]> => {
      const supabase = await createClient();
      const { data, error } = await supabase
        .from("booking_reports_feed")
        .select(FEED_COLUMNS)
        .eq("subject_type", input.subjectType)
        .eq("subject_key", input.subjectKey)
        .order("created_at", { ascending: false })
        // Whole subject, every option — sized so a quiet option's reports
        // aren't crowded out by a busy one on the same trip.
        .limit(500);

      if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });

      return ((data ?? []) as unknown as ReportRow[]).map(toReport);
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
      const now = Date.now();
      // Travel dates must be today or later. The server can't see the
      // traveller's timezone, so allow a day of slack behind UTC.
      const earliest = new Date(now - 24 * HOUR_MS).toISOString().slice(0, 10);
      if (input.entered && input.entered.start < earliest) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Dates must be today or later." });
      }
      const result = classifyReport(input.quote, input.entered);

      const { data: recent, error: recentError } = await supabase
        .from("booking_reports_feed")
        .select("subject_key, option_key, created_at")
        .eq("is_mine", true)
        .gte("created_at", new Date(now - REPORT_COOLDOWN_MS).toISOString())
        .order("created_at", { ascending: false })
        .limit(MAX_ROWS_IN_COOLDOWN);
      if (recentError) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: recentError.message });
      const recentRows = (recent ?? []) as { subject_key: string; option_key: string; created_at: string }[];
      const dupe = recentRows.some(r =>
        r.subject_key === input.subjectKey && r.option_key === input.optionKey,
      );
      const lastHour = recentRows.filter(r => now - new Date(r.created_at).getTime() < HOUR_MS);
      // Best-effort: two parallel submits can both pass this read. Good enough
      // to stop casual repeats; not a security boundary.
      if (dupe) {
        throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "You've already reported this option — you can report it again in 24 hours." });
      }
      if (lastHour.length >= REPORTS_PER_HOUR) {
        throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Report limit reached — try again in an hour." });
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

      // Service role: clients hold no INSERT grant on booking_reports, so this
      // procedure's checks can't be skipped by writing through PostgREST.
      const { data, error } = await getSupabaseAdmin()
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
        .select(INSERT_COLUMNS)
        .single();

      if (error || !data) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error?.message ?? "Insert failed" });
      }
      return toReport({ ...(data as unknown as Omit<ReportRow, "is_mine">), is_mine: true });
    }),
});
