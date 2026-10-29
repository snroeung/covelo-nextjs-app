import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, flaggedProcedure, adminProcedure } from "@/server/trpc";
import { isEnabled } from "@/lib/feature-flags";
import { CACHE, cacheKeys } from "@/lib/cache-config";
import { redis } from "@/lib/redis";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { approveBoardItem, rejectBoardItem } from "@/lib/board/server/review";
import { FEED_COLUMNS } from "@/lib/board/server/feed";
import type { PortalId } from "@/lib/points/types";
import type { TransferPartnerConfig, PointsValuationConfig } from "@/lib/points/transferPartners";
import { sameProgram } from "@/lib/points/programNames";
import type {
  TransferPartnerRow,
  TravelCollection,
  PointsValuation,
  PortalSyncRun,
  PendingReviewRow,
  PendingReviewTable,
} from "@/lib/types/portalData";
import { isBoardPendingTable, type BoardQueueReason } from "@/lib/types/portalData";
import type { SupabaseClient } from "@supabase/supabase-js";

async function cacheGet<T>(key: string): Promise<T | null> {
  if (!isEnabled("integration:redis:portal-data")) return null;
  return redis.get<T>(key).catch(() => null);
}

async function cacheSet(key: string, value: unknown, ttl: number): Promise<void> {
  if (!isEnabled("integration:redis:portal-data")) return;
  await redis.set(key, value, { ex: ttl }).catch(() => {});
}

function groupTransferPartners(rows: TransferPartnerRow[]): Record<PortalId, TransferPartnerConfig[]> {
  const grouped = {
    chase: [], amex: [], c1: [], bilt: [], citi: [],
  } as Record<PortalId, TransferPartnerConfig[]>;

  for (const row of rows) {
    grouped[row.portal_id].push({
      program: row.program,
      type: row.type,
      ratio: row.ratio,
      chainKey: row.chain_key ?? undefined,
      iataCodes: row.iata_codes.length > 0 ? row.iata_codes : undefined,
    });
  }
  return grouped;
}

/** The catalog tables whose rows wait for review by `status` / `source`. */
const PENDING_REVIEW_TABLES: PendingReviewTable[] = [
  "transfer_partners",
  "travel_collections",
  "transfer_bonuses",
  "spending_bonuses",
  "points_valuations",
];

const BOARD_QUEUE_LIMIT = 200;

/**
 * The board's share of the queue: offer posts to verify, held posts and
 * comments, and public content with open member reports. Read with the admin's
 * own session — migration 031 lets exactly an admin JWT select these tables —
 * so the board gets no special access path. A row is listed once; when several
 * apply the reason is held, then offer_review, then reported, and every row
 * carries its open-report tally.
 */
async function boardPendingRows(supabase: SupabaseClient): Promise<PendingReviewRow[]> {
  const reportsRes = await supabase.from("board_reports").select("target_kind, target_id, reason").is("resolved_at", null).limit(1000);
  if (reportsRes.error) console.warn("[portalData.listAll] board reports:", reportsRes.error.message);
  const tally = new Map<string, { count: number; reasons: string[] }>();
  for (const r of (reportsRes.error ? [] : reportsRes.data ?? []) as Array<{ target_kind: string; target_id: string; reason: string }>) {
    const t = tally.get(r.target_id) ?? { count: 0, reasons: [] };
    t.count++;
    if (!t.reasons.includes(r.reason)) t.reasons.push(r.reason);
    tally.set(r.target_id, t);
  }
  const reportedPostIds = [...new Set((reportsRes.data ?? []).filter((r) => r.target_kind === "post").map((r) => r.target_id as string))];
  const reportedCommentIds = [...new Set((reportsRes.data ?? []).filter((r) => r.target_kind === "comment").map((r) => r.target_id as string))];

  const [posts, comments, reportedPosts, reportedComments] = await Promise.all([
    supabase
      .from("board_posts_feed")
      .select(FEED_COLUMNS)
      .is("deleted_at", null)
      // held (any kind) — or an offer waiting for verification that is still public
      .or("mod_status.eq.held,and(kind.eq.offer,review.eq.pending,mod_status.in.(clean,unscanned))")
      .order("created_at", { ascending: false })
      .limit(BOARD_QUEUE_LIMIT),
    supabase
      .from("board_comments")
      .select("*")
      .is("deleted_at", null)
      .eq("mod_status", "held")
      .order("created_at", { ascending: false })
      .limit(BOARD_QUEUE_LIMIT),
    reportedPostIds.length
      ? supabase.from("board_posts_feed").select(FEED_COLUMNS).in("id", reportedPostIds).is("deleted_at", null).in("mod_status", ["clean", "unscanned"])
      : Promise.resolve({ data: [], error: null }),
    reportedCommentIds.length
      ? supabase.from("board_comments").select("*").in("id", reportedCommentIds).is("deleted_at", null).in("mod_status", ["clean", "unscanned"])
      : Promise.resolve({ data: [], error: null }),
  ]);
  for (const [what, res] of [["posts", posts], ["comments", comments], ["reported posts", reportedPosts], ["reported comments", reportedComments]] as const) {
    if (res.error) console.warn(`[portalData.listAll] board ${what}:`, res.error.message);
  }

  type Row = Record<string, unknown>;
  const rows = (res: { data: unknown; error: unknown }): Row[] => (res.error ? [] : ((res.data ?? []) as unknown as Row[]));
  const seenPosts = new Set(rows(posts).map((r) => r.id as string));
  const seenComments = new Set(rows(comments).map((r) => r.id as string));
  const postRows = [...rows(posts), ...rows(reportedPosts).filter((r) => !seenPosts.has(r.id as string))];
  const commentRows = [...rows(comments), ...rows(reportedComments).filter((r) => !seenComments.has(r.id as string))];

  // Comment authors' names, and the member-created offers behind offer posts
  const authorIds = [...new Set(commentRows.map((c) => c.author_id as string))];
  const memberOfferIds = [...new Set(postRows.map((p) => p.member_offer_id as string | null).filter((x): x is string => !!x))];
  const topicIds = [...new Set(postRows.flatMap((p) => (p.topic_ids as string[] | null) ?? []))];
  const [profiles, memberOffers, topicRows] = await Promise.all([
    authorIds.length ? supabase.from("profiles").select("id, display_name").in("id", authorIds) : Promise.resolve({ data: [] }),
    memberOfferIds.length ? supabase.from("board_member_offers").select("*").in("id", memberOfferIds) : Promise.resolve({ data: [] }),
    topicIds.length ? supabase.from("board_topics").select("id, name").in("id", topicIds) : Promise.resolve({ data: [] }),
  ]);
  const topicName = new Map(((topicRows.data ?? []) as Array<{ id: string; name: string }>).map((t) => [t.id, t.name]));
  const names = new Map<string, string>();
  for (const p of (profiles.data ?? []) as Array<{ id: string; display_name: string | null }>) names.set(p.id, p.display_name?.trim() || "Traveler");
  const offerById = new Map(((memberOffers.data ?? []) as Array<{ id: string }>).map((o) => [o.id, o]));

  const reportFields = (id: string) => ({ report_count: tally.get(id)?.count ?? 0, report_reasons: tally.get(id)?.reasons ?? [] });
  const out: PendingReviewRow[] = [];
  for (const row of postRows) {
    const reason: BoardQueueReason = row.mod_status === "held" ? "held" : row.kind === "offer" && row.review === "pending" ? "offer_review" : "reported";
    out.push({
      table: "board_posts",
      row: {
        ...row,
        queue_reason: reason,
        ...reportFields(row.id as string),
        // Primary topic first, with names, so Review & publish can show the member's own topics
        topics: [...((row.topic_ids as string[] | null) ?? [])]
          .sort((a, b) => Number(b === row.topic_id) - Number(a === row.topic_id))
          .map((id) => ({ id, name: topicName.get(id) ?? 'Unknown topic' })),
        member_offer: row.member_offer_id ? offerById.get(row.member_offer_id as string) ?? null : null },
    });
  }
  for (const row of commentRows) {
    out.push({
      table: "board_comments",
      row: { ...row, author_name: names.get(row.author_id as string) ?? "Traveler", queue_reason: row.mod_status === "held" ? "held" : "reported", ...reportFields(row.id as string) },
    });
  }
  return out;
}

/** Board rows need the board API on; off, the queue is exactly what it was. */
function assertBoardEnabled(): void {
  if (!isEnabled("api:board")) {
    throw new TRPCError({ code: "NOT_FOUND", message: 'Feature "api:board" is not available in this environment.' });
  }
}

async function invalidatePortalDataCache(): Promise<void> {
  await redis.del(cacheKeys.transferPartners()).catch(() => {});
  await redis.del(cacheKeys.travelCollections("hotel")).catch(() => {});
  await redis.del(cacheKeys.travelCollections("flight")).catch(() => {});
  await redis.del(cacheKeys.pointsValuations()).catch(() => {});
}

export const portalDataRouter = router({
  listTransferPartners: flaggedProcedure("api:portal-data")
    .query(async (): Promise<Record<PortalId, TransferPartnerConfig[]>> => {
      const key = cacheKeys.transferPartners();
      const cached = await cacheGet<Record<PortalId, TransferPartnerConfig[]>>(key);
      if (cached) return cached;

      const supabase = await createClient();
      const { data, error } = await supabase
        .from("transfer_partners")
        .select("*")
        .in("status", ["admin", "approved"])
        .eq("active", true)
        .order("program", { ascending: true });

      if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
      const result = groupTransferPartners((data ?? []) as TransferPartnerRow[]);
      await cacheSet(key, result, CACHE.transferPartners.ttl);
      return result;
    }),

  listTravelCollections: flaggedProcedure("api:portal-data")
    .query(async (): Promise<TravelCollection[]> => {
      const key = cacheKeys.travelCollections("hotel");
      const cached = await cacheGet<TravelCollection[]>(key);
      if (cached) return cached;

      const supabase = await createClient();
      const { data, error } = await supabase
        .from("travel_collections")
        .select("*")
        .in("status", ["admin", "approved"])
        .eq("active", true)
        .order("collection_name", { ascending: true });

      if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
      const result = (data ?? []) as TravelCollection[];
      await cacheSet(key, result, CACHE.travelCollections.ttl);
      return result;
    }),

  listPointsValuations: flaggedProcedure("api:portal-data")
    .query(async (): Promise<PointsValuationConfig[]> => {
      const key = cacheKeys.pointsValuations();
      const cached = await cacheGet<PointsValuationConfig[]>(key);
      if (cached) return cached;

      const supabase = await createClient();
      const { data, error } = await supabase
        .from("points_valuations")
        .select("program, cpp")
        .in("status", ["admin", "approved"])
        .eq("active", true)
        // Defensive backstop for rows that predate approve-time supersede, or
        // any future direct-insert path that bypasses admin.approve — the
        // caller (lookupPartnerValuationCpp) takes the first sameProgram()
        // match, so newest-first ordering here is what makes that correct.
        .order("created_at", { ascending: false });

      if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
      const result = (data ?? []) as PointsValuationConfig[];
      await cacheSet(key, result, CACHE.pointsValuations.ttl);
      return result;
    }),

  admin: router({
    listTransferPartners: adminProcedure("api:portal-data")
      .query(async (): Promise<TransferPartnerRow[]> => {
        const supabase = await createClient();
        const { data, error } = await supabase
          .from("transfer_partners")
          .select("*")
          .order("program", { ascending: true });

        if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
        return (data ?? []) as TransferPartnerRow[];
      }),

    listTravelCollections: adminProcedure("api:portal-data")
      .query(async (): Promise<TravelCollection[]> => {
        const supabase = await createClient();
        const { data, error } = await supabase
          .from("travel_collections")
          .select("*")
          .order("collection_name", { ascending: true });

        if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
        return (data ?? []) as TravelCollection[];
      }),

    listPointsValuations: adminProcedure("api:portal-data")
      .query(async (): Promise<PointsValuation[]> => {
        const supabase = await createClient();
        const { data, error } = await supabase
          .from("points_valuations")
          .select("*")
          .order("program", { ascending: true });

        if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
        return (data ?? []) as PointsValuation[];
      }),

    listAll: adminProcedure("api:portal-data")
      .query(async (): Promise<PendingReviewRow[]> => {
        const supabase = await createClient();
        const results = await Promise.allSettled(
          PENDING_REVIEW_TABLES.map((table) =>
            supabase
              .from(table)
              .select("*")
              .or("status.eq.pending,source.eq.cron")
              .order("created_at", { ascending: false }),
          ),
        );

        const rows: PendingReviewRow[] = [];
        results.forEach((result, i) => {
          if (result.status === "fulfilled" && !result.value.error) {
            for (const row of result.value.data ?? []) {
              rows.push({ table: PENDING_REVIEW_TABLES[i], row });
            }
          }
        });
        if (isEnabled("api:board")) rows.push(...(await boardPendingRows(supabase)));
        return rows;
      }),

    listSyncRuns: adminProcedure("api:portal-data")
      .query(async (): Promise<PortalSyncRun[]> => {
        const supabase = await createClient();
        const { data, error } = await supabase
          .from("portal_sync_runs")
          .select("*")
          .order("started_at", { ascending: false })
          .limit(100);

        if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
        return (data ?? []) as PortalSyncRun[];
      }),

    approve: adminProcedure("api:portal-data")
      .input(z.object({
        table: z.enum(["transfer_partners", "travel_collections", "transfer_bonuses", "spending_bonuses", "points_valuations", "board_posts", "board_comments"]),
        id:    z.string().uuid(),
        runId: z.string().uuid().optional(),
        edits: z.record(z.string(), z.string()).optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        // Board rows: verify an offer post, or release held content. Their own actions, not a status flip.
        if (isBoardPendingTable(input.table)) {
          assertBoardEnabled();
          await approveBoardItem(getSupabaseAdmin(), ctx.user.id, input.table, input.id);
          return { id: input.id };
        }

        const supabase = await createClient();
        const { data: original, error: fetchError } = await supabase
          .from(input.table)
          .select("*")
          .eq("id", input.id)
          .single();

        if (fetchError) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: fetchError.message });

        if (input.edits) {
          const corrections = Object.entries(input.edits)
            .filter(([field, value]) => String(original[field] ?? "") !== value)
            .map(([field, value]) => ({
              run_id:          input.runId ?? null,
              record_type:     input.table === "transfer_partners" ? "transfer_partner"
                              : input.table === "travel_collections" ? "travel_collection"
                              : input.table === "transfer_bonuses" ? "transfer_bonus"
                              : input.table === "spending_bonuses" ? "spending_bonus"
                              : "points_valuation",
              field,
              extracted_value: original[field] != null ? String(original[field]) : null,
              corrected_value: value,
              source_url:      original.source_url ?? "",
            }));

          if (corrections.length > 0) {
            await supabase.from("portal_sync_corrections").insert(corrections);
          }
        }

        const { data, error } = await supabase
          .from(input.table)
          .update({ ...input.edits, active: true, status: "approved" })
          .eq("id", input.id)
          .select()
          .single();

        if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });

        // A program can accumulate several approved points_valuations rows
        // over time (dedup key is program+source_month, so a new month
        // inserts rather than overwrites) — deactivate every other
        // approved+active row for the same program so exactly one stays live
        // for lookupPartnerValuationCpp to find. Matched via sameProgram(),
        // same comparator transfer_partners matching already uses, not an
        // exact string (issuers/scrapes spell one program several ways).
        if (input.table === "points_valuations") {
          const { data: others } = await supabase
            .from("points_valuations")
            .select("id, program")
            .eq("status", "approved")
            .eq("active", true);

          const staleIds = ((others as { id: string; program: string }[] | null) ?? [])
            .filter((row) => row.id !== data.id && sameProgram(row.program, data.program))
            .map((row) => row.id);

          if (staleIds.length > 0) {
            await supabase.from("points_valuations").update({ active: false }).in("id", staleIds);
          }
        }

        await invalidatePortalDataCache();
        return data;
      }),

    reject: adminProcedure("api:portal-data")
      .input(z.object({
        table: z.enum(["transfer_partners", "travel_collections", "transfer_bonuses", "spending_bonuses", "points_valuations", "board_posts", "board_comments"]),
        id:    z.string().uuid(),
        /** Board rows only: shown to the member. Offer posts take a rejection reason, held content a removal reason. */
        reason: z.string().max(100).optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        if (isBoardPendingTable(input.table)) {
          assertBoardEnabled();
          await rejectBoardItem(getSupabaseAdmin(), ctx.user.id, input.table, input.id, input.reason);
          return;
        }

        const supabase = await createClient();
        const { error } = await supabase
          .from(input.table)
          .update({ status: "rejected" })
          .eq("id", input.id);

        if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
        await invalidatePortalDataCache();
      }),

    createTransferPartner: adminProcedure("api:portal-data")
      .input(z.object({
        portal_id:  z.enum(["chase", "amex", "c1", "bilt", "citi"]),
        program:    z.string().min(1),
        type:       z.enum(["hotel", "airline"]),
        ratio:      z.string().min(1).default("1:1"),
        chain_key:  z.string().nullable().optional(),
        iata_codes: z.array(z.string()).default([]),
        source_url: z.string().nullable().optional(),
        active:     z.boolean().default(true),
      }))
      .mutation(async ({ input }) => {
        const supabase = await createClient();
        const { data, error } = await supabase
          .from("transfer_partners")
          .insert({ ...input, source: "admin", status: "admin" })
          .select()
          .single();

        if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
        await invalidatePortalDataCache();
        return data as TransferPartnerRow;
      }),

    updateTransferPartner: adminProcedure("api:portal-data")
      .input(z.object({
        id:         z.string().uuid(),
        portal_id:  z.enum(["chase", "amex", "c1", "bilt", "citi"]).optional(),
        program:    z.string().min(1).optional(),
        type:       z.enum(["hotel", "airline"]).optional(),
        ratio:      z.string().min(1).optional(),
        chain_key:  z.string().nullable().optional(),
        iata_codes: z.array(z.string()).optional(),
        source_url: z.string().nullable().optional(),
        active:     z.boolean().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...fields } = input;
        const supabase = await createClient();
        const { data, error } = await supabase
          .from("transfer_partners")
          .update(fields)
          .eq("id", id)
          .select()
          .single();

        if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
        await invalidatePortalDataCache();
        return data as TransferPartnerRow;
      }),

    createTravelCollection: adminProcedure("api:portal-data")
      .input(z.object({
        issuer:          z.enum(["chase", "amex", "c1", "bilt", "citi"]),
        type:            z.enum(["hotel", "flight"]).default("hotel"),
        collection_name: z.string().min(1),
        property_name:   z.string().nullable().optional(),
        airline_name:      z.string().nullable().optional(),
        airline_iata_code: z.string().nullable().optional(),
        origin_iata_code:      z.string().nullable().optional(),
        destination_iata_code: z.string().nullable().optional(),
        cabin_class:       z.enum(["economy", "premium_economy", "business", "first"]).nullable().optional(),
        perk_summary:    z.string().min(1),
        original_amount: z.number().nullable().optional(),
        original_unit:   z.enum(["points", "usd"]).nullable().optional(),
        discount_amount: z.number().nullable().optional(),
        discount_unit:   z.enum(["points", "usd"]).nullable().optional(),
        end_date:        z.string().nullable().optional(),
        limited_time_offer: z.boolean().default(false),
        source_url:      z.string().nullable().optional(),
        active:          z.boolean().default(true),
      }))
      .mutation(async ({ input }) => {
        const supabase = await createClient();
        const { data, error } = await supabase
          .from("travel_collections")
          .insert({ ...input, source: "admin", status: "admin" })
          .select()
          .single();

        if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
        await invalidatePortalDataCache();
        return data as TravelCollection;
      }),

    updateTravelCollection: adminProcedure("api:portal-data")
      .input(z.object({
        id:              z.string().uuid(),
        issuer:          z.enum(["chase", "amex", "c1", "bilt", "citi"]).optional(),
        type:            z.enum(["hotel", "flight"]).optional(),
        collection_name: z.string().min(1).optional(),
        property_name:   z.string().nullable().optional(),
        airline_name:      z.string().nullable().optional(),
        airline_iata_code: z.string().nullable().optional(),
        origin_iata_code:      z.string().nullable().optional(),
        destination_iata_code: z.string().nullable().optional(),
        cabin_class:       z.enum(["economy", "premium_economy", "business", "first"]).nullable().optional(),
        perk_summary:    z.string().min(1).optional(),
        original_amount: z.number().nullable().optional(),
        original_unit:   z.enum(["points", "usd"]).nullable().optional(),
        discount_amount: z.number().nullable().optional(),
        discount_unit:   z.enum(["points", "usd"]).nullable().optional(),
        end_date:        z.string().nullable().optional(),
        limited_time_offer: z.boolean().optional(),
        source_url:      z.string().nullable().optional(),
        active:          z.boolean().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...fields } = input;
        const supabase = await createClient();
        const { data, error } = await supabase
          .from("travel_collections")
          .update(fields)
          .eq("id", id)
          .select()
          .single();

        if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
        await invalidatePortalDataCache();
        return data as TravelCollection;
      }),

    createPointsValuation: adminProcedure("api:portal-data")
      .input(z.object({
        program:      z.string().min(1),
        cpp:          z.number().positive(),
        source_month: z.string().min(1),
        source_url:   z.string().nullable().optional(),
        active:       z.boolean().default(true),
      }))
      .mutation(async ({ input }) => {
        const supabase = await createClient();
        const { data, error } = await supabase
          .from("points_valuations")
          .insert({ ...input, source: "admin", status: "admin" })
          .select()
          .single();

        if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
        await invalidatePortalDataCache();
        return data as PointsValuation;
      }),

    updatePointsValuation: adminProcedure("api:portal-data")
      .input(z.object({
        id:           z.string().uuid(),
        program:      z.string().min(1).optional(),
        cpp:          z.number().positive().optional(),
        source_month: z.string().min(1).optional(),
        source_url:   z.string().nullable().optional(),
        active:       z.boolean().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...fields } = input;
        const supabase = await createClient();
        const { data, error } = await supabase
          .from("points_valuations")
          .update(fields)
          .eq("id", id)
          .select()
          .single();

        if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
        await invalidatePortalDataCache();
        return data as PointsValuation;
      }),
  }),
});
