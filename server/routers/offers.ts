import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, flaggedProcedure, adminProcedure, authedProcedure } from "@/server/trpc";
import { SAVED_OFFERS_LIMIT, isLiveOffer, liveOffers, widestLiveOfferFilter } from "@/lib/offers/live";
import { isEnabled } from "@/lib/feature-flags";
import { CACHE, cacheKeys } from "@/lib/cache-config";
import { redis } from "@/lib/redis";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { assertBoardPostReady, syncSystemPost, type OfferTable } from "@/lib/board/server/systemPost";
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

// ─── Board post fields (plan §6) ─────────────────────────────────────────────
// The editor's "Post to board" section. Title and body are stored as written —
// the portal-sync cron fills them in, an admin may edit them.

const boardTextFields = {
  board_topic:      z.string().nullable().optional(),
  board_post_title: z.string().nullable().optional(),
  board_post_body:  z.string().nullable().optional(),
};
const boardFieldsForCreate = { post_to_board: z.boolean().default(false), ...boardTextFields };
const boardFieldsForUpdate = { post_to_board: z.boolean().optional(), ...boardTextFields };

export const createTransferBonusInput = z.object({
  issuer:           z.enum(['chase', 'amex', 'c1', 'bilt', 'citi']),
  transfer_partner: z.string().min(1),
  bonus_pct:        z.number().positive().nullable().optional(),
  min_transfer_points: z.number().positive().nullable().optional(),
  start_date:       z.string().min(1),
  description:      z.string().nullable().optional(),
  tags:             z.array(z.string()).default([]),
  end_date:         z.string().min(1),
  is_targeted:      z.boolean().default(false),
  for_status_transfer: z.boolean().default(false),
  card_ids:         z.array(z.string()).default([]),
  source_url:       z.string().nullable().optional(),
  country:          z.string().min(1).default('US'),
  active:           z.boolean().default(true),
  ...boardFieldsForCreate,
});

export const createSpendingBonusInput = z.object({
  issuer:           z.enum(['chase', 'amex', 'c1', 'bilt', 'citi']),
  merchant_name:    z.string().min(1),
  bonus_multiplier: z.number().positive(),
  bonus_type:       z.enum(['points_multiplier', 'cash_back_pct', 'dollar_amount']),
  spending_minimum: z.number().positive().nullable().optional(),
  minimum_nights:   z.number().int().positive().nullable().optional(),
  description:      z.string().nullable().optional(),
  tags:             z.array(z.string()).default([]),
  card_ids:         z.array(z.string()),
  start_date:       z.string().min(1),
  end_date:         z.string().min(1),
  is_targeted:      z.boolean().default(false),
  source_url:       z.string().nullable().optional(),
  country:          z.string().min(1).default('US'),
  active:           z.boolean().default(true),
  ...boardFieldsForCreate,
});

/**
 * Keep the covelo board post in step with a saved offer. Runs after the offer
 * is stored; it is skipped when the offer is not on the board and the request
 * did not touch the toggle (nothing to create or hide). An inactive offer is
 * never on the board: its post is hidden whatever the toggle says.
 */
async function syncBoardPost(
  table: OfferTable,
  row: { id: string; active?: boolean; post_to_board?: boolean; board_topic?: string | null; board_post_title?: string | null; board_post_body?: string | null },
  adminUserId: string,
  touchedToggle: boolean,
): Promise<void> {
  const onBoard = row.post_to_board === true && row.active !== false;
  if (!onBoard && !touchedToggle && row.active !== false) return;
  try {
    await syncSystemPost(getSupabaseAdmin(), table, row.id, {
      post_to_board: onBoard,
      board_topic: row.board_topic ?? null,
      board_post_title: row.board_post_title ?? null,
      board_post_body: row.board_post_body ?? null,
    }, adminUserId);
  } catch (err) {
    // The offer itself is saved; say so, so the admin only has to fix the board fields
    const message = err instanceof Error ? err.message : "board post sync failed";
    throw new TRPCError({ code: err instanceof TRPCError ? err.code : "INTERNAL_SERVER_ERROR", message: `Offer saved, but not posted to the board: ${message}` });
  }
}

export const offersRouter = router({
  listTransferBonuses: flaggedProcedure("api:offers")
    .query(async ({ ctx }): Promise<TransferBonus[]> => {
      const key = cacheKeys.transferBonuses();
      // The cache is shared by every viewer, so it holds what is live anywhere on Earth; each
      // viewer gets the offers still live in their own time zone. A cached list can also outlive
      // an offer by up to its TTL, so the dates are re-checked on the way out.
      const cached = await cacheGet<TransferBonus[]>(key);
      if (cached) return liveOffers(cached, new Date(), ctx.timeZone);

      // Row-level security hides ended offers from members, but not from an admin
      // session — and this list is cached for everyone, so filter explicitly.
      const supabase = await createClient();
      const { data, error } = await supabase
        .from("transfer_bonuses")
        .select("*")
        .eq("active", true)
        .or(widestLiveOfferFilter())
        .order("bonus_pct", { ascending: false });

      if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
      const result = (data ?? []) as TransferBonus[];
      await cacheSet(key, result, CACHE.transferBonuses.ttl);
      return liveOffers(result, new Date(), ctx.timeZone);
    }),

  listSpendingBonuses: flaggedProcedure("api:offers")
    .query(async ({ ctx }): Promise<SpendingBonus[]> => {
      const key = cacheKeys.spendingBonuses();
      const cached = await cacheGet<SpendingBonus[]>(key);
      if (cached) return liveOffers(cached, new Date(), ctx.timeZone);

      const supabase = await createClient();
      const { data, error } = await supabase
        .from("spending_bonuses")
        .select("*")
        .eq("active", true)
        .or(widestLiveOfferFilter())
        .order("bonus_multiplier", { ascending: false });

      if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
      const result = (data ?? []) as SpendingBonus[];
      await cacheSet(key, result, CACHE.spendingBonuses.ttl);
      return liveOffers(result, new Date(), ctx.timeZone);
    }),

  // ── Saved offers (members only) ──

  /** The member's saved offers that are still live, most recently saved first. */
  saved: authedProcedure("api:offers").query(async ({ ctx }): Promise<Array<TransferBonus | SpendingBonus>> => {
    const { data: saves, error } = await ctx.supabase
      .from("saved_offers")
      .select("offer_table, offer_id")
      .eq("user_id", ctx.user.id)
      .order("created_at", { ascending: false })
      .limit(SAVED_OFFERS_LIMIT);
    if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
    const rows = (saves ?? []) as Array<{ offer_table: OfferTable; offer_id: string }>;
    if (rows.length === 0) return [];

    const idsFor = (table: OfferTable) => rows.filter((r) => r.offer_table === table).map((r) => r.offer_id);
    const fetchLive = async (table: OfferTable) => {
      const ids = idsFor(table);
      if (ids.length === 0) return [];
      const res = await ctx.supabase.from(table).select("*").in("id", ids).eq("active", true).or(widestLiveOfferFilter());
      if (res.error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: res.error.message });
      return liveOffers((res.data ?? []) as Array<TransferBonus | SpendingBonus>, new Date(), ctx.timeZone);
    };
    const [transfers, spendings] = await Promise.all([fetchLive("transfer_bonuses"), fetchLive("spending_bonuses")]);
    const byKey = new Map<string, TransferBonus | SpendingBonus>([
      ...transfers.map((o) => [`transfer_bonuses:${o.id}`, o] as const),
      ...spendings.map((o) => [`spending_bonuses:${o.id}`, o] as const),
    ]);
    // Offers that ended, were switched off or were deleted are not there to return
    return rows.map((r) => byKey.get(`${r.offer_table}:${r.offer_id}`)).filter((o): o is TransferBonus | SpendingBonus => !!o);
  }),

  save: authedProcedure("api:offers")
    .input(z.object({ table: z.enum(["transfer_bonuses", "spending_bonuses"]), id: z.guid(), saved: z.boolean() }))
    .mutation(async ({ input, ctx }): Promise<{ saved: boolean }> => {
      const own = { user_id: ctx.user.id, offer_table: input.table, offer_id: input.id };
      if (!input.saved) {
        const { error } = await ctx.supabase.from("saved_offers").delete().match(own);
        if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
        return { saved: false };
      }

      const { data: offer, error: lookupError } = await ctx.supabase.from(input.table).select("id, active, end_date").eq("id", input.id).maybeSingle();
      if (lookupError) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: lookupError.message });
      if (!offer || !isLiveOffer(offer as { active: boolean; end_date: string | null }, new Date(), ctx.timeZone)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "That offer isn't available to save." });
      }

      const { count, error: countError } = await ctx.supabase.from("saved_offers").select("offer_id", { count: "exact", head: true }).eq("user_id", ctx.user.id);
      if (countError) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: countError.message });
      const { data: already } = await ctx.supabase.from("saved_offers").select("offer_id").match(own).maybeSingle();
      if (!already && (count ?? 0) >= SAVED_OFFERS_LIMIT) {
        throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: `You can save up to ${SAVED_OFFERS_LIMIT} offers. Remove one to save another.` });
      }

      const { error } = await ctx.supabase.from("saved_offers").upsert(own, { onConflict: "user_id,offer_table,offer_id", ignoreDuplicates: true });
      if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
      return { saved: true };
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
        bonus_pct:        z.number().positive().nullable().optional(),
        min_transfer_points: z.number().positive().nullable().optional(),
        description:      z.string().nullable().optional(),
        tags:             z.array(z.string()).optional(),
        start_date:       z.string().nullable().optional(),
        end_date:         z.string().min(1).optional(),
        is_targeted:      z.boolean().optional(),
        for_status_transfer: z.boolean().optional(),
        card_ids:         z.array(z.string()).optional(),
        source_url:       z.string().nullable().optional(),
        country:          z.string().min(1).optional(),
        active:           z.boolean().optional(),
        ...boardFieldsForUpdate,
      }))
      .mutation(async ({ input, ctx }) => {
        const { id, ...fields } = input;
        // An explicit "post it" needs its title + topic in the same request, so a bad toggle never half-saves
        if (input.post_to_board === true) assertBoardPostReady({ board_post_title: input.board_post_title ?? null, board_topic: input.board_topic ?? null });
        const supabase = await createClient();
        const { data, error } = await supabase
          .from("transfer_bonuses")
          .update(fields)
          .eq("id", id)
          .select()
          .single();

        if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
        await redis.del(cacheKeys.transferBonuses()).catch(() => {});
        await syncBoardPost("transfer_bonuses", data, ctx.user.id, input.post_to_board !== undefined);
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
        active:           z.boolean().optional(),
        ...boardFieldsForUpdate,
      }))
      .mutation(async ({ input, ctx }) => {
        const { id, ...fields } = input;
        if (input.post_to_board === true) assertBoardPostReady({ board_post_title: input.board_post_title ?? null, board_topic: input.board_topic ?? null });
        const supabase = await createClient();
        const { data, error } = await supabase
          .from("spending_bonuses")
          .update(fields)
          .eq("id", id)
          .select()
          .single();

        if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
        await redis.del(cacheKeys.spendingBonuses()).catch(() => {});
        await syncBoardPost("spending_bonuses", data, ctx.user.id, input.post_to_board !== undefined);
        return data as SpendingBonus;
      }),

    updateActive: adminProcedure("api:offers")
      .input(z.object({
        id:     z.string().uuid(),
        table:  z.enum(["transfer_bonuses", "spending_bonuses"]),
        active: z.boolean(),
      }))
      .mutation(async ({ input, ctx }) => {
        const supabase = await createClient();
        const { data, error } = await supabase
          .from(input.table)
          .update({ active: input.active })
          .eq("id", input.id)
          .select()
          .single();

        if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });

        await redis.del(cacheKeys.transferBonuses()).catch(() => {});
        await redis.del(cacheKeys.spendingBonuses()).catch(() => {});
        // Deactivating hides the offer's board post; reactivating restores it if the toggle is still on
        await syncBoardPost(input.table, data, ctx.user.id, true);
      }),

    createTransferBonus: adminProcedure("api:offers")
      .input(createTransferBonusInput)
      .mutation(async ({ input, ctx }) => {
        if (input.post_to_board) assertBoardPostReady({ board_post_title: input.board_post_title ?? null, board_topic: input.board_topic ?? null });
        const supabase = await createClient();
        const { data, error } = await supabase
          .from("transfer_bonuses")
          .insert(input)
          .select()
          .single();

        if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
        await redis.del(cacheKeys.transferBonuses()).catch(() => {});
        await syncBoardPost("transfer_bonuses", data, ctx.user.id, false);
        return data as TransferBonus;
      }),

    createSpendingBonus: adminProcedure("api:offers")
      .input(createSpendingBonusInput)
      .mutation(async ({ input, ctx }) => {
        if (input.post_to_board) assertBoardPostReady({ board_post_title: input.board_post_title ?? null, board_topic: input.board_topic ?? null });
        const supabase = await createClient();
        const { data, error } = await supabase
          .from("spending_bonuses")
          .insert(input)
          .select()
          .single();

        if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
        await redis.del(cacheKeys.spendingBonuses()).catch(() => {});
        await syncBoardPost("spending_bonuses", data, ctx.user.id, false);
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
        const { error } = await supabase
          .from("sponsored_ads")
          .update({ active: false })
          .eq("id", input.id);

        if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
      }),
  }),
});
