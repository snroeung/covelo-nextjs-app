import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, flaggedProcedure, adminProcedure } from "@/server/trpc";
import { isEnabled } from "@/lib/feature-flags";
import { CACHE, cacheKeys } from "@/lib/cache-config";
import { redis } from "@/lib/redis";
import { createClient } from "@/lib/supabase/server";
import type {
  TransferBonus,
  SpendingBonus,
  SponsoredAd,
  PublicSponsoredAd,
} from "@/lib/types/offers";

async function cacheGet<T>(key: string): Promise<T | null> {
  if (!isEnabled("integration:redis:offers")) return null;
  return redis.get<T>(key).catch(() => null);
}

async function cacheSet(key: string, value: unknown, ttl: number): Promise<void> {
  if (!isEnabled("integration:redis:offers")) return;
  await redis.set(key, value, { ex: ttl }).catch(() => {});
}

export const offersRouter = router({
  listTransferBonuses: flaggedProcedure("api:offers")
    .query(async (): Promise<TransferBonus[]> => {
      const key = cacheKeys.transferBonuses();
      const cached = await cacheGet<TransferBonus[]>(key);
      if (cached) return cached;

      const supabase = await createClient();
      const { data, error } = await supabase
        .from("transfer_bonuses")
        .select("*")
        .in("status", ["approved", "admin"])
        .order("bonus_pct", { ascending: false });

      if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
      const result = (data ?? []) as TransferBonus[];
      await cacheSet(key, result, CACHE.transferBonuses.ttl);
      return result;
    }),

  listSpendingBonuses: flaggedProcedure("api:offers")
    .query(async (): Promise<SpendingBonus[]> => {
      const key = cacheKeys.spendingBonuses();
      const cached = await cacheGet<SpendingBonus[]>(key);
      if (cached) return cached;

      const supabase = await createClient();
      const { data, error } = await supabase
        .from("spending_bonuses")
        .select("*")
        .in("status", ["approved", "admin"])
        .order("bonus_multiplier", { ascending: false });

      if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
      const result = (data ?? []) as SpendingBonus[];
      await cacheSet(key, result, CACHE.spendingBonuses.ttl);
      return result;
    }),

  // Public read works via "sponsored_ads_public_read" RLS policy (005_offers_rls_update.sql)
  getFeaturedAd: flaggedProcedure("api:offers")
    .input(z.object({ slot: z.enum(["hero", "grid_inline", "below_grid", "sidebar", "flights_inline", "hotels_inline", "trip_strip"]) }))
    .query(async ({ input }): Promise<PublicSponsoredAd[]> => {
      const supabase = await createClient();
      const now = new Date().toISOString().split("T")[0];
      const { data, error } = await supabase
        .from("sponsored_ads")
        .select("*")
        .eq("slot", input.slot)
        .eq("active", true)
        .or(`start_date.is.null,start_date.lte.${now}`)
        .or(`end_date.is.null,end_date.gte.${now}`)
        .order("created_at", { ascending: false })
        .limit(10);

      if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
      if (!data || data.length === 0) return [];

      return (data as SponsoredAd[]).map((ad) => {
        const ctaUrl = ad.cta_url.includes("?")
          ? `${ad.cta_url}&ref=${ad.tracking_id}`
          : `${ad.cta_url}?ref=${ad.tracking_id}`;
        return {
          id:          ad.id,
          partner:     ad.partner,
          product:     ad.product,
          slot:        ad.slot,
          headline:    ad.headline,
          subheadline: ad.subheadline,
          bullets:     ad.bullets,
          cta_label:   ad.cta_label,
          cta_url:     ctaUrl,
          disclosure:  ad.disclosure,
          tone:        ad.tone,
          image_url:   ad.image_url,
          country:     ad.country,
        };
      });
    }),

  // trackImpression, trackClick, and upvote removed — will be replaced with
  // PostHog events in a future ticket (see plan file for event taxonomy).

  admin: router({
    listAll: adminProcedure("api:offers")
      .query(async () => {
        const supabase = await createClient();
        const [transferResult, spendingResult] = await Promise.allSettled([
          supabase.from("transfer_bonuses").select("*").order("created_at", { ascending: false }),
          supabase.from("spending_bonuses").select("*").order("created_at", { ascending: false }),
        ]);

        const transferBonuses = transferResult.status === "fulfilled" && !transferResult.value.error
          ? (transferResult.value.data as TransferBonus[])
          : [];
        const spendingBonuses = spendingResult.status === "fulfilled" && !spendingResult.value.error
          ? (spendingResult.value.data as SpendingBonus[])
          : [];

        return { transferBonuses, spendingBonuses };
      }),

    updateTransferBonus: adminProcedure("api:offers")
      .input(z.object({
        id:               z.string().uuid(),
        issuer:           z.enum(['chase', 'amex', 'c1', 'bilt', 'citi']).optional(),
        transfer_partner: z.string().min(1).optional(),
        bonus_pct:        z.number().positive().optional(),
        description:      z.string().nullable().optional(),
        tags:             z.array(z.string()).optional(),
        start_date:       z.string().nullable().optional(),
        end_date:         z.string().min(1).optional(),
        is_targeted:      z.boolean().optional(),
        source_url:       z.string().nullable().optional(),
        country:          z.string().min(1).optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...fields } = input;
        const supabase = await createClient();
        const { data, error } = await supabase
          .from("transfer_bonuses")
          .update(fields)
          .eq("id", id)
          .select()
          .single();

        if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
        await redis.del(cacheKeys.transferBonuses()).catch(() => {});
        return data as TransferBonus;
      }),

    updateSpendingBonus: adminProcedure("api:offers")
      .input(z.object({
        id:               z.string().uuid(),
        issuer:           z.enum(['chase', 'amex', 'c1', 'bilt', 'citi']).optional(),
        merchant_name:    z.string().min(1).optional(),
        bonus_multiplier: z.number().positive().optional(),
        bonus_type:       z.enum(['points_multiplier', 'cash_back_pct', 'dollar_amount']).optional(),
        spending_minimum: z.number().positive().nullable().optional(),
        minimum_nights:   z.number().int().positive().nullable().optional(),
        description:      z.string().nullable().optional(),
        tags:             z.array(z.string()).optional(),
        card_ids:         z.array(z.string()).optional(),
        start_date:       z.string().nullable().optional(),
        end_date:         z.string().min(1).optional(),
        is_targeted:      z.boolean().optional(),
        source_url:       z.string().nullable().optional(),
        country:          z.string().min(1).optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...fields } = input;
        const supabase = await createClient();
        const { data, error } = await supabase
          .from("spending_bonuses")
          .update(fields)
          .eq("id", id)
          .select()
          .single();

        if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
        await redis.del(cacheKeys.spendingBonuses()).catch(() => {});
        return data as SpendingBonus;
      }),

    updateStatus: adminProcedure("api:offers")
      .input(z.object({
        id:     z.string().uuid(),
        table:  z.enum(["transfer_bonuses", "spending_bonuses"]),
        status: z.enum(["admin", "pending", "approved", "rejected"]),
      }))
      .mutation(async ({ input }) => {
        const supabase = await createClient();
        const { error } = await supabase
          .from(input.table)
          .update({ status: input.status })
          .eq("id", input.id);

        if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });

        await redis.del(cacheKeys.transferBonuses()).catch(() => {});
        await redis.del(cacheKeys.spendingBonuses()).catch(() => {});
      }),

    createTransferBonus: adminProcedure("api:offers")
      .input(z.object({
        issuer:           z.enum(['chase', 'amex', 'c1', 'bilt', 'citi']),
        transfer_partner: z.string().min(1),
        bonus_pct:        z.number().positive(),
        start_date:       z.string().nullable().optional(),
        description:      z.string().nullable().optional(),
        tags:             z.array(z.string()).default([]),
        end_date:         z.string().min(1),
        is_targeted:      z.boolean().default(false),
        source_url:       z.string().nullable().optional(),
        country:          z.string().min(1).default('US'),
      }))
      .mutation(async ({ input }) => {
        const supabase = await createClient();
        const { data, error } = await supabase
          .from("transfer_bonuses")
          .insert({ ...input, status: "admin", active: true })
          .select()
          .single();

        if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
        await redis.del(cacheKeys.transferBonuses()).catch(() => {});
        return data as TransferBonus;
      }),

    createSpendingBonus: adminProcedure("api:offers")
      .input(z.object({
        issuer:           z.enum(['chase', 'amex', 'c1', 'bilt', 'citi']),
        merchant_name:    z.string().min(1),
        bonus_multiplier: z.number().positive(),
        bonus_type:       z.enum(['points_multiplier', 'cash_back_pct', 'dollar_amount']),
        spending_minimum: z.number().positive().nullable().optional(),
        minimum_nights:   z.number().int().positive().nullable().optional(),
        description:      z.string().nullable().optional(),
        tags:             z.array(z.string()).default([]),
        card_ids:         z.array(z.string()),
        start_date:       z.string().nullable().optional(),
        end_date:         z.string().min(1),
        is_targeted:      z.boolean().default(false),
        source_url:       z.string().nullable().optional(),
        country:          z.string().min(1).default('US'),
      }))
      .mutation(async ({ input }) => {
        const supabase = await createClient();
        const { data, error } = await supabase
          .from("spending_bonuses")
          .insert({ ...input, status: "admin", active: true })
          .select()
          .single();

        if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
        await redis.del(cacheKeys.spendingBonuses()).catch(() => {});
        return data as SpendingBonus;
      }),

    listAds: adminProcedure("api:offers")
      .query(async (): Promise<SponsoredAd[]> => {
        const supabase = await createClient();
        const { data, error } = await supabase
          .from("sponsored_ads")
          .select("*")
          .order("created_at", { ascending: false });

        if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
        return (data ?? []) as SponsoredAd[];
      }),

    createAd: adminProcedure("api:offers")
      .input(z.object({
        partner:     z.string().min(1),
        product:     z.string().min(1),
        slot:        z.enum(["hero", "grid_inline", "below_grid", "sidebar", "flights_inline", "hotels_inline", "trip_strip"]),
        headline:    z.string().min(1),
        subheadline: z.string().nullable().optional(),
        bullets:     z.array(z.string()).default([]),
        cta_label:   z.string().min(1),
        cta_url:     z.string().url(),
        tracking_id: z.string().min(1),
        disclosure:  z.string().min(1),
        tone:        z.string().default("neutral"),
        image_url:   z.string().url().nullable().optional(),
        active:      z.boolean().default(true),
        country:     z.string().min(1).default("US"),
        start_date:  z.string().nullable().optional(),
        end_date:    z.string().nullable().optional(),
      }))
      .mutation(async ({ input }) => {
        const supabase = await createClient();
        const { data, error } = await supabase
          .from("sponsored_ads")
          .insert(input)
          .select()
          .single();

        if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
        return data as SponsoredAd;
      }),

    updateAd: adminProcedure("api:offers")
      .input(z.object({
        id:          z.string().uuid(),
        partner:     z.string().min(1).optional(),
        product:     z.string().min(1).optional(),
        slot:        z.enum(["hero", "grid_inline", "below_grid", "sidebar", "flights_inline", "hotels_inline", "trip_strip"]).optional(),
        headline:    z.string().min(1).optional(),
        subheadline: z.string().nullable().optional(),
        bullets:     z.array(z.string()).optional(),
        cta_label:   z.string().min(1).optional(),
        cta_url:     z.string().url().optional(),
        tracking_id: z.string().min(1).optional(),
        disclosure:  z.string().min(1).optional(),
        tone:        z.string().optional(),
        image_url:   z.string().url().nullable().optional(),
        active:      z.boolean().optional(),
        country:     z.string().min(1).optional(),
        start_date:  z.string().nullable().optional(),
        end_date:    z.string().nullable().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...fields } = input;
        const supabase = await createClient();
        const { data, error } = await supabase
          .from("sponsored_ads")
          .update(fields)
          .eq("id", id)
          .select()
          .single();

        if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
        return data as SponsoredAd;
      }),

    deleteAd: adminProcedure("api:offers")
      .input(z.object({ id: z.string().uuid() }))
      .mutation(async ({ input }) => {
        const supabase = await createClient();
        const { data: ad } = await supabase
          .from("sponsored_ads")
          .select("slot")
          .eq("id", input.id)
          .single();

        const { error } = await supabase
          .from("sponsored_ads")
          .update({ active: false })
          .eq("id", input.id);

        if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
      }),
  }),
});
