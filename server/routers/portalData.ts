import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, flaggedProcedure, adminProcedure } from "@/server/trpc";
import { isEnabled } from "@/lib/feature-flags";
import { CACHE, cacheKeys } from "@/lib/cache-config";
import { redis } from "@/lib/redis";
import { createClient } from "@/lib/supabase/server";
import type { PortalId } from "@/lib/points/types";
import type { TransferPartnerConfig } from "@/lib/points/transferPartners";
import type {
  TransferPartnerRow,
  HotelCollection,
  PortalSyncRun,
  PendingReviewRow,
  PendingReviewTable,
} from "@/lib/types/portalData";

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
    chase: [], amex: [], capital_one: [], bilt: [], citi: [],
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

const PENDING_REVIEW_TABLES: PendingReviewTable[] = [
  "transfer_partners",
  "hotel_collections",
  "transfer_bonuses",
  "spending_bonuses",
];

async function invalidatePortalDataCache(): Promise<void> {
  await redis.del(cacheKeys.transferPartners()).catch(() => {});
  await redis.del(cacheKeys.hotelCollections()).catch(() => {});
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
        .order("program", { ascending: true });

      if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
      const result = groupTransferPartners((data ?? []) as TransferPartnerRow[]);
      await cacheSet(key, result, CACHE.transferPartners.ttl);
      return result;
    }),

  listHotelCollections: flaggedProcedure("api:portal-data")
    .query(async (): Promise<HotelCollection[]> => {
      const key = cacheKeys.hotelCollections();
      const cached = await cacheGet<HotelCollection[]>(key);
      if (cached) return cached;

      const supabase = await createClient();
      const { data, error } = await supabase
        .from("hotel_collections")
        .select("*")
        .order("collection_name", { ascending: true });

      if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
      const result = (data ?? []) as HotelCollection[];
      await cacheSet(key, result, CACHE.hotelCollections.ttl);
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
        table: z.enum(["transfer_partners", "hotel_collections", "transfer_bonuses", "spending_bonuses"]),
        id:    z.string().uuid(),
        runId: z.string().uuid().optional(),
        edits: z.record(z.string(), z.string()).optional(),
      }))
      .mutation(async ({ input }) => {
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
                              : input.table === "hotel_collections" ? "hotel_collection"
                              : input.table === "transfer_bonuses" ? "transfer_bonus"
                              : "spending_bonus",
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
        await invalidatePortalDataCache();
        return data;
      }),

    reject: adminProcedure("api:portal-data")
      .input(z.object({
        table: z.enum(["transfer_partners", "hotel_collections", "transfer_bonuses", "spending_bonuses"]),
        id:    z.string().uuid(),
      }))
      .mutation(async ({ input }) => {
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
        portal_id:  z.enum(["chase", "amex", "capital_one", "bilt", "citi"]),
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
        portal_id:  z.enum(["chase", "amex", "capital_one", "bilt", "citi"]).optional(),
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

    createHotelCollection: adminProcedure("api:portal-data")
      .input(z.object({
        issuer:          z.enum(["chase", "amex", "c1", "bilt", "citi"]),
        collection_name: z.string().min(1),
        property_name:   z.string().nullable().optional(),
        perk_summary:    z.string().min(1),
        start_date:      z.string().nullable().optional(),
        end_date:        z.string().nullable().optional(),
        source_url:      z.string().nullable().optional(),
        active:          z.boolean().default(true),
      }))
      .mutation(async ({ input }) => {
        const supabase = await createClient();
        const { data, error } = await supabase
          .from("hotel_collections")
          .insert({ ...input, source: "admin", status: "admin" })
          .select()
          .single();

        if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
        await invalidatePortalDataCache();
        return data as HotelCollection;
      }),

    updateHotelCollection: adminProcedure("api:portal-data")
      .input(z.object({
        id:              z.string().uuid(),
        issuer:          z.enum(["chase", "amex", "c1", "bilt", "citi"]).optional(),
        collection_name: z.string().min(1).optional(),
        property_name:   z.string().nullable().optional(),
        perk_summary:    z.string().min(1).optional(),
        start_date:      z.string().nullable().optional(),
        end_date:        z.string().nullable().optional(),
        source_url:      z.string().nullable().optional(),
        active:          z.boolean().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...fields } = input;
        const supabase = await createClient();
        const { data, error } = await supabase
          .from("hotel_collections")
          .update(fields)
          .eq("id", id)
          .select()
          .single();

        if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
        await invalidatePortalDataCache();
        return data as HotelCollection;
      }),
  }),
});
