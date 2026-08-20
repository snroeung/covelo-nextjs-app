import type { SupabaseClient } from "@supabase/supabase-js";
import type { RecordType } from "./schemas";
import type {
  TransferPartnerRecord,
  TransferBonusRecord,
  SpendingBonusRecord,
  TravelCollectionRecord,
  PointsValuationRecord,
} from "./schemas";
import { normalizeProgramName, sameProgram } from "@/lib/points/programNames";
import { ISSUER_CARDS, type CardId, type PortalId } from "@/lib/points/types";

// Defends against hallucinated/mismatched ids before they hit the DB —
// e.g. the model returning an Amex card id for a Chase-issuer record.
function validCardIds(issuer: string, cardIds: string[] | undefined): string[] {
  const allowed = ISSUER_CARDS[issuer as PortalId] ?? [];
  return (cardIds ?? []).filter((id) => allowed.includes(id as CardId));
}

type TableName = "transfer_partners" | "transfer_bonuses" | "spending_bonuses" | "travel_collections" | "points_valuations";

export const TABLE_BY_RECORD_TYPE: Record<RecordType, TableName> = {
  transfer_partner: "transfer_partners",
  transfer_bonus: "transfer_bonuses",
  spending_bonus: "spending_bonuses",
  travel_collection: "travel_collections",
  points_valuation: "points_valuations",
};

export interface UpsertContext {
  supabase: SupabaseClient;
  sourceUrl: string;
}

// A row already approved by an admin is never overwritten by the cron —
// skip. A row already sitting pending from a prior run — same content, not
// yet reviewed — is also skipped, so a weekly re-scrape of an unchanged
// offer doesn't pile up duplicate candidates in the admin queue. `match`
// must include whatever field signals a genuine change (e.g. end_date) —
// without one, a renewed/updated offer would be indistinguishable from the
// original and get silently skipped as "already exists" forever, which is
// what buried the current Chase→IHG bonus: an unrelated, already-expired
// bonus from the same source_url matched on name alone.
async function hasMatchingRow(
  supabase: SupabaseClient,
  table: TableName,
  status: "approved" | "pending",
  match: Record<string, unknown>,
): Promise<boolean> {
  let query = supabase.from(table).select("id").eq("status", status).limit(1);
  for (const [key, value] of Object.entries(match)) {
    query = value === null ? query.is(key, null) : query.eq(key, value);
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
async function hasTransferPartnerMatch(
  supabase: SupabaseClient,
  status: "approved" | "pending",
  portal_id: string,
  type: string,
  program: string,
): Promise<boolean> {
  const target = normalizeProgramName(program);
  if (!target) return false;

  const { data } = await supabase
    .from("transfer_partners")
    .select("program")
    .eq("status", status)
    .eq("portal_id", portal_id)
    .eq("type", type);
  return ((data as { program: string }[] | null) ?? []).some(
    (row) => sameProgram(row.program, program),
  );
}

// TPG's aggregator spells partner names slightly differently than the
// issuer's own transfer-partner page (e.g. "Air France KLM" vs
// "Air France-KLM"). Look up the canonical name already approved for this
// issuer's own transfer_partners rows (Issuer and PortalId share the same
// string values — chase/amex/c1/bilt/citi) and rewrite the bonus's
// transfer_partner to match it, so RedemptionTable.tsx's exact-match bonusFor()
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
    (row) => sameProgram(row.program, transferPartner),
  );
  return match?.program ?? transferPartner;
}

// Same normalized-name comparison as hasTransferPartnerMatch, scoped to this
// issuer+source+end_date. end_date is the signal that this is genuinely the
// same promo, not just the same partner: TPG reuses the same issuer+partner
// pairing across unrelated, non-overlapping promos over time (e.g. Chase ran
// a 100% Chase→IHG bonus that expired, then a later, separate 70% Chase→IHG
// bonus) — matching on name alone treats the new promo as "already handled"
// and it never gets written at all, approved or pending.
async function hasTransferBonusMatch(
  supabase: SupabaseClient,
  status: "approved" | "pending",
  issuer: string,
  sourceUrl: string,
  transferPartner: string,
  endDate: string,
): Promise<boolean> {
  const target = normalizeProgramName(transferPartner);
  if (!target) return false;

  const { data } = await supabase
    .from("transfer_bonuses")
    .select("transfer_partner")
    .eq("status", status)
    .eq("issuer", issuer)
    .eq("source_url", sourceUrl)
    .eq("end_date", endDate);
  return ((data as { transfer_partner: string }[] | null) ?? []).some(
    (row) => sameProgram(row.transfer_partner, transferPartner),
  );
}

export async function upsertTransferPartner(
  ctx: UpsertContext,
  record: TransferPartnerRecord,
): Promise<boolean> {
  if (await hasTransferPartnerMatch(ctx.supabase, "approved", record.portal_id, record.type, record.program)) {
    return false;
  }
  if (await hasTransferPartnerMatch(ctx.supabase, "pending", record.portal_id, record.type, record.program)) {
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
  if (error) {
    console.error(`[upsert:transfer_partner] insert failed for "${record.program}" (${ctx.sourceUrl}): ${error.message}`);
  }
  return !error;
}

export async function upsertTransferBonus(
  ctx: UpsertContext,
  record: TransferBonusRecord,
): Promise<boolean> {
  if (
    await hasTransferBonusMatch(ctx.supabase, "approved", record.issuer, ctx.sourceUrl, record.transfer_partner, record.end_date)
  ) {
    return false;
  }
  if (
    await hasTransferBonusMatch(ctx.supabase, "pending", record.issuer, ctx.sourceUrl, record.transfer_partner, record.end_date)
  ) {
    return false;
  }
  const transferPartner = await resolveCanonicalPartnerName(ctx.supabase, record.issuer, record.transfer_partner);

  const { error } = await ctx.supabase.from("transfer_bonuses").insert({
    issuer: record.issuer,
    transfer_partner: transferPartner,
    bonus_pct: record.bonus_pct ?? null,
    min_transfer_points: record.min_transfer_points ?? null,
    description: record.description ?? null,
    start_date: record.start_date ?? null,
    end_date: record.end_date,
    is_targeted: record.is_targeted ?? false,
    for_status_transfer: record.for_status_transfer ?? false,
    card_ids: validCardIds(record.issuer, record.card_ids),
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
  if (error) {
    console.error(`[upsert:transfer_bonus] insert failed for "${transferPartner}" (${ctx.sourceUrl}): ${error.message}`);
  }
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
    end_date: record.end_date ?? null,
  };
  if (await hasMatchingRow(ctx.supabase, "spending_bonuses", "approved", match)) return false;
  if (await hasMatchingRow(ctx.supabase, "spending_bonuses", "pending", match)) return false;

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
    card_ids: validCardIds(record.issuer, record.card_ids),
    source_url: ctx.sourceUrl,
    source: "cron",
    status: "pending",
    active: false,
  });
  if (error) {
    console.error(`[upsert:spending_bonus] insert failed for "${record.merchant_name}" (${ctx.sourceUrl}): ${error.message}`);
  }
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
          origin_iata_code: record.origin_iata_code ?? null,
          destination_iata_code: record.destination_iata_code ?? null,
          cabin_class: record.cabin_class ?? null,
          end_date: record.end_date ?? null,
        }
      : {
          issuer: record.issuer,
          collection_name: record.collection_name,
          property_name: record.property_name ?? null,
          end_date: record.end_date ?? null,
        };
  if (await hasMatchingRow(ctx.supabase, "travel_collections", "approved", match)) return false;
  if (await hasMatchingRow(ctx.supabase, "travel_collections", "pending", match)) return false;

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
    limited_time_offer: record.limited_time_offer,
    source: "cron",
    status: "pending",
    active: false,
    source_url: ctx.sourceUrl,
  });
  if (error) {
    const label = record.property_name ? `${record.collection_name} / ${record.property_name}` : record.collection_name;
    console.error(`[upsert:travel_collection] insert failed for "${label}" (${ctx.sourceUrl}): ${error.message}`);
  }
  return !error;
}

// Dedup keyed on (program, source_month) — not on program alone. A key
// scoped to program alone would silently drop every subsequent month's real
// update; the same failure mode fixed once already for the Amex/transfer-bonus
// sources (commit e1999c0) by adding end_date to their match.
export async function upsertPointsValuation(
  ctx: UpsertContext,
  record: PointsValuationRecord,
): Promise<boolean> {
  const match = { program: record.program, source_month: record.source_month };
  if (await hasMatchingRow(ctx.supabase, "points_valuations", "approved", match)) return false;
  if (await hasMatchingRow(ctx.supabase, "points_valuations", "pending", match)) return false;

  const { error } = await ctx.supabase.from("points_valuations").insert({
    ...match,
    cpp: record.cpp,
    source: "cron",
    status: "pending",
    active: false,
    source_url: ctx.sourceUrl,
  });
  if (error) {
    console.error(`[upsert:points_valuation] insert failed for "${record.program}" (${ctx.sourceUrl}): ${error.message}`);
  }
  return !error;
}

export async function upsertRecord(
  ctx: UpsertContext,
  recordType: RecordType,
  record: TransferPartnerRecord | TransferBonusRecord | SpendingBonusRecord | TravelCollectionRecord | PointsValuationRecord,
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
    case "points_valuation":
      return upsertPointsValuation(ctx, record as PointsValuationRecord);
    default:
      return false;
  }
}
