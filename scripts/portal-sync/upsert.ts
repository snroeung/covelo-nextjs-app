import type { SupabaseClient } from "@supabase/supabase-js";
import type { RecordType } from "./schemas";
import type {
  TransferPartnerRecord,
  TransferBonusRecord,
  SpendingBonusRecord,
  TravelCollectionRecord,
} from "./schemas";
import { normalizeProgramName } from "@/lib/points/programNames";

type TableName = "transfer_partners" | "transfer_bonuses" | "spending_bonuses" | "travel_collections";

export const TABLE_BY_RECORD_TYPE: Record<RecordType, TableName> = {
  transfer_partner: "transfer_partners",
  transfer_bonus: "transfer_bonuses",
  spending_bonus: "spending_bonuses",
  travel_collection: "travel_collections",
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

// Scraped program names vary vs. what's already in the DB: punctuation
// ("Air France-KLM" vs "Air France/KLM"), optional "Airlines"/"Airline"
// filler ("United Airlines MileagePlus" vs "United MileagePlus",
// "Southwest Rapid Rewards" vs "Southwest Airlines Rapid Rewards"), and
// outright alternate names for the same program (British Airways brands
// its program "Executive Club" but the currency/scraped name is "Avios").
// An exact eq() match misses all of these and the cron re-inserts them as
// new pending rows. Normalize separators/filler, then run known aliases,
// before comparing. Shared with lib/points/transferPartners.ts, which uses
// the same normalization to merge cross-portal rows for the same program
// (e.g. Capital One's "TAP Air Portugal Miles&Go" and Bilt's "TAP Miles&Go")
// into one UI row.
async function hasApprovedTransferPartnerMatch(
  supabase: SupabaseClient,
  portal_id: string,
  type: string,
  program: string,
): Promise<boolean> {
  const target = normalizeProgramName(program);
  if (!target) return false;

  const { data } = await supabase
    .from("transfer_partners")
    .select("program")
    .eq("status", "approved")
    .eq("portal_id", portal_id)
    .eq("type", type);
  return ((data as { program: string }[] | null) ?? []).some(
    (row) => normalizeProgramName(row.program) === target,
  );
}

// TPG's aggregator spells partner names slightly differently than the
// issuer's own transfer-partner page (e.g. "Air France KLM" vs
// "Air France-KLM"). Look up the canonical name already approved for this
// issuer's own transfer_partners rows (Issuer and PortalId share the same
// string values — chase/amex/c1/bilt/citi) and rewrite the bonus's
// transfer_partner to match it, so PointsGrid.tsx's exact-match bonusFor()
// can find it. Falls through to the raw scraped name when no match exists —
// no fabricated partner rows.
async function resolveCanonicalPartnerName(
  supabase: SupabaseClient,
  issuer: string,
  transferPartner: string,
): Promise<string> {
  const target = normalizeProgramName(transferPartner);
  if (!target) return transferPartner;

  const { data } = await supabase
    .from("transfer_partners")
    .select("program")
    .eq("status", "approved")
    .eq("portal_id", issuer);
  const match = ((data as { program: string }[] | null) ?? []).find(
    (row) => normalizeProgramName(row.program) === target,
  );
  return match?.program ?? transferPartner;
}

// Same normalized-name comparison as hasApprovedTransferPartnerMatch, scoped
// to this issuer+source so a re-run doesn't create a duplicate pending row
// for a bonus whose partner name only differs by spelling from an
// already-approved one.
async function hasApprovedTransferBonusMatch(
  supabase: SupabaseClient,
  issuer: string,
  sourceUrl: string,
  transferPartner: string,
): Promise<boolean> {
  const target = normalizeProgramName(transferPartner);
  if (!target) return false;

  const { data } = await supabase
    .from("transfer_bonuses")
    .select("transfer_partner")
    .eq("status", "approved")
    .eq("issuer", issuer)
    .eq("source_url", sourceUrl);
  return ((data as { transfer_partner: string }[] | null) ?? []).some(
    (row) => normalizeProgramName(row.transfer_partner) === target,
  );
}

export async function upsertTransferPartner(
  ctx: UpsertContext,
  record: TransferPartnerRecord,
): Promise<boolean> {
  if (await hasApprovedTransferPartnerMatch(ctx.supabase, record.portal_id, record.type, record.program)) {
    return false;
  }
  const match = { portal_id: record.portal_id, program: record.program, type: record.type };

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
  if (await hasApprovedTransferBonusMatch(ctx.supabase, record.issuer, ctx.sourceUrl, record.transfer_partner)) {
    return false;
  }
  const transferPartner = await resolveCanonicalPartnerName(ctx.supabase, record.issuer, record.transfer_partner);

  const { error } = await ctx.supabase.from("transfer_bonuses").insert({
    issuer: record.issuer,
    transfer_partner: transferPartner,
    bonus_pct: record.bonus_pct,
    description: record.description ?? null,
    start_date: record.start_date ?? null,
    end_date: record.end_date,
    is_targeted: record.is_targeted ?? false,
    // Every transfer_bonus record comes from the TPG aggregator, which by
    // definition only lists live, time-boxed offers — the extraction LLM
    // unreliably fills this field (zod defaults it false when omitted), so
    // force it rather than trust the prompt.
    limited_time_offer: true,
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
    limited_time_offer: record.limited_time_offer,
    source_url: ctx.sourceUrl,
    source: "cron",
    status: "pending",
    active: false,
  });
  return !error;
}

export async function upsertTravelCollection(
  ctx: UpsertContext,
  record: TravelCollectionRecord,
): Promise<boolean> {
  const match =
    record.type === "flight"
      ? {
          issuer: record.issuer,
          collection_name: record.collection_name,
          airline_iata_code: record.airline_iata_code ?? null,
          cabin_class: record.cabin_class ?? null,
        }
      : {
          issuer: record.issuer,
          collection_name: record.collection_name,
          property_name: record.property_name ?? null,
        };
  if (await hasApprovedMatch(ctx.supabase, "travel_collections", match)) return false;

  const { error } = await ctx.supabase.from("travel_collections").insert({
    ...match,
    type: record.type,
    airline_name: record.airline_name ?? null,
    airline_iata_code: record.airline_iata_code ?? null,
    cabin_class: record.cabin_class ?? null,
    perk_summary: record.perk_summary,
    original_amount: record.original_amount ?? null,
    original_unit: record.original_unit ?? null,
    discount_amount: record.discount_amount ?? null,
    discount_unit: record.discount_unit ?? null,
    end_date: record.end_date ?? null,
    limited_time_offer: record.limited_time_offer,
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
  record: TransferPartnerRecord | TransferBonusRecord | SpendingBonusRecord | TravelCollectionRecord,
): Promise<boolean> {
  switch (recordType) {
    case "transfer_partner":
      return upsertTransferPartner(ctx, record as TransferPartnerRecord);
    case "transfer_bonus":
      return upsertTransferBonus(ctx, record as TransferBonusRecord);
    case "spending_bonus":
      return upsertSpendingBonus(ctx, record as SpendingBonusRecord);
    case "travel_collection":
      return upsertTravelCollection(ctx, record as TravelCollectionRecord);
    default:
      return false;
  }
}
