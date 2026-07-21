import type { SupabaseClient } from "@supabase/supabase-js";
import type { RecordType } from "./schemas";
import type {
  TransferPartnerRecord,
  TransferBonusRecord,
  SpendingBonusRecord,
  HotelCollectionRecord,
} from "./schemas";

type TableName = "transfer_partners" | "transfer_bonuses" | "spending_bonuses" | "hotel_collections";

export const TABLE_BY_RECORD_TYPE: Record<RecordType, TableName> = {
  transfer_partner: "transfer_partners",
  transfer_bonus: "transfer_bonuses",
  spending_bonus: "spending_bonuses",
  hotel_collection: "hotel_collections",
};

export interface UpsertContext {
  supabase: SupabaseClient;
  sourceUrl: string;
}

// A row already approved by an admin is never overwritten by the cron —
// skip. Anything else (no match, or only pending duplicates) gets a fresh
// pending candidate so admins can diff old vs new before approving.
async function hasApprovedMatch(
  supabase: SupabaseClient,
  table: TableName,
  match: Record<string, unknown>,
): Promise<boolean> {
  let query = supabase.from(table).select("id").eq("status", "approved").limit(1);
  for (const [key, value] of Object.entries(match)) {
    query = query.eq(key, value);
  }
  const { data } = await query;
  return (data?.length ?? 0) > 0;
}

export async function upsertTransferPartner(
  ctx: UpsertContext,
  record: TransferPartnerRecord,
): Promise<boolean> {
  const match = { portal_id: record.portal_id, program: record.program, type: record.type };
  if (await hasApprovedMatch(ctx.supabase, "transfer_partners", match)) return false;

  const { error } = await ctx.supabase.from("transfer_partners").insert({
    ...match,
    ratio: record.ratio,
    chain_key: record.chain_key ?? null,
    iata_codes: record.iata_codes ?? [],
    source: "cron",
    status: "pending",
    active: false,
    source_url: ctx.sourceUrl,
  });
  return !error;
}

export async function upsertTransferBonus(
  ctx: UpsertContext,
  record: TransferBonusRecord,
): Promise<boolean> {
  const match = {
    issuer: record.issuer,
    transfer_partner: record.transfer_partner,
    source_url: ctx.sourceUrl,
  };
  if (await hasApprovedMatch(ctx.supabase, "transfer_bonuses", match)) return false;

  const { error } = await ctx.supabase.from("transfer_bonuses").insert({
    issuer: record.issuer,
    transfer_partner: record.transfer_partner,
    bonus_pct: record.bonus_pct,
    description: record.description ?? null,
    start_date: record.start_date ?? null,
    end_date: record.end_date,
    is_targeted: record.is_targeted ?? false,
    source_url: ctx.sourceUrl,
    source: "cron",
    status: "pending",
    active: false,
  });
  return !error;
}

export async function upsertSpendingBonus(
  ctx: UpsertContext,
  record: SpendingBonusRecord,
): Promise<boolean> {
  const match = {
    issuer: record.issuer,
    merchant_name: record.merchant_name,
    source_url: ctx.sourceUrl,
  };
  if (await hasApprovedMatch(ctx.supabase, "spending_bonuses", match)) return false;

  const { error } = await ctx.supabase.from("spending_bonuses").insert({
    issuer: record.issuer,
    merchant_name: record.merchant_name,
    bonus_multiplier: record.bonus_multiplier,
    bonus_type: record.bonus_type,
    spending_minimum: record.spending_minimum ?? null,
    minimum_nights: record.minimum_nights ?? null,
    description: record.description ?? null,
    start_date: record.start_date ?? null,
    end_date: record.end_date,
    is_targeted: record.is_targeted ?? false,
    source_url: ctx.sourceUrl,
    source: "cron",
    status: "pending",
    active: false,
  });
  return !error;
}

export async function upsertHotelCollection(
  ctx: UpsertContext,
  record: HotelCollectionRecord,
): Promise<boolean> {
  const match = {
    issuer: record.issuer,
    collection_name: record.collection_name,
    property_name: record.property_name ?? null,
  };
  if (await hasApprovedMatch(ctx.supabase, "hotel_collections", match)) return false;

  const { error } = await ctx.supabase.from("hotel_collections").insert({
    ...match,
    perk_summary: record.perk_summary,
    start_date: record.start_date ?? null,
    end_date: record.end_date ?? null,
    source: "cron",
    status: "pending",
    active: false,
    source_url: ctx.sourceUrl,
  });
  return !error;
}

export async function upsertRecord(
  ctx: UpsertContext,
  recordType: RecordType,
  record: TransferPartnerRecord | TransferBonusRecord | SpendingBonusRecord | HotelCollectionRecord,
): Promise<boolean> {
  switch (recordType) {
    case "transfer_partner":
      return upsertTransferPartner(ctx, record as TransferPartnerRecord);
    case "transfer_bonus":
      return upsertTransferBonus(ctx, record as TransferBonusRecord);
    case "spending_bonus":
      return upsertSpendingBonus(ctx, record as SpendingBonusRecord);
    case "hotel_collection":
      return upsertHotelCollection(ctx, record as HotelCollectionRecord);
    default:
      return false;
  }
}
