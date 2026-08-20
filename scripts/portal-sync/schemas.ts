import { z } from "zod";

export const TransferPartnerRecordSchema = z.object({
  portal_id: z.enum(["chase", "amex", "c1", "bilt", "citi"]),
  program: z.string().min(1),
  type: z.enum(["hotel", "airline"]),
  ratio: z.string().min(1),
  chain_key: z.string().nullable().optional(),
  iata_codes: z.array(z.string()).optional(),
});
export type TransferPartnerRecord = z.infer<typeof TransferPartnerRecordSchema>;

export const TransferBonusRecordSchema = z.object({
  issuer: z.enum(["chase", "amex", "c1", "bilt", "citi"]),
  transfer_partner: z.string().min(1),
  bonus_pct: z.number().positive().nullable().optional(),
  // Minimum points that must be transferred to unlock the promo, for
  // status-match tiers that have no percentage bonus at all (e.g. Bilt ->
  // Accor: "transfer at least 5,000 Bilt points to match Accor Silver").
  min_transfer_points: z.number().positive().nullable().optional(),
  description: z.string().nullable().optional(),
  start_date: z.string().nullable().optional(),
  end_date: z.string().min(1),
  is_targeted: z.boolean().optional(),
  limited_time_offer: z.boolean().default(false),
  // True when the promo lets the transfer count toward the destination
  // program's elite/award status (e.g. Bilt Rent Day → World of Hyatt
  // night credits), not just a points bonus.
  for_status_transfer: z.boolean().default(false),
  // Set only when the offer explicitly requires one specific card product
  // from the issuer, not just any card — omitted/empty means all cards.
  card_ids: z.array(z.string()).optional(),
}).refine((r) => r.bonus_pct != null || r.min_transfer_points != null, {
  message: "either bonus_pct or min_transfer_points is required",
});
export type TransferBonusRecord = z.infer<typeof TransferBonusRecordSchema>;

export const SpendingBonusRecordSchema = z.object({
  issuer: z.enum(["chase", "amex", "c1", "bilt", "citi"]),
  merchant_name: z.string().min(1),
  bonus_multiplier: z.number().positive(),
  bonus_type: z.enum(["points_multiplier", "cash_back_pct", "dollar_amount"]),
  description: z.string().nullable().optional(),
  spending_minimum: z.number().nullable().optional(),
  minimum_nights: z.number().nullable().optional(),
  start_date: z.string().nullable().optional(),
  // c1 shopping-portal offers (upgradedpoints.com) explicitly publish no
  // expiration date — page text says so outright. Required would zod-reject
  // the entire batch for that source alone.
  end_date: z.string().nullable().optional(),
  is_targeted: z.boolean().optional(),
  limited_time_offer: z.boolean().default(false),
  // Set only when the offer explicitly requires one specific card product
  // from the issuer, not just any card — omitted/empty means all cards.
  card_ids: z.array(z.string()).optional(),
});
export type SpendingBonusRecord = z.infer<typeof SpendingBonusRecordSchema>;

export const TravelCollectionRecordSchema = z.object({
  issuer: z.enum(["chase", "amex", "c1", "bilt", "citi"]),
  type: z.enum(["hotel", "flight"]),
  collection_name: z.string().min(1),
  property_name: z.string().nullable().optional(),
  airline_name: z.string().nullable().optional(),
  airline_iata_code: z.string().nullable().optional(),
  origin_iata_code: z.string().nullable().optional(),
  destination_iata_code: z.string().nullable().optional(),
  cabin_class: z.enum(["economy", "premium_economy", "business", "first"]).nullable().optional(),
  perk_summary: z.string().min(1),
  original_amount: z.number().positive().nullable().optional(),
  original_unit: z.enum(["points", "usd"]).nullable().optional(),
  discount_amount: z.number().positive().nullable().optional(),
  discount_unit: z.enum(["points", "usd"]).nullable().optional(),
  end_date: z.string().nullable().optional(),
  limited_time_offer: z.boolean().default(false),
});
export type TravelCollectionRecord = z.infer<typeof TravelCollectionRecordSchema>;

export const PointsValuationRecordSchema = z.object({
  program: z.string().min(1),
  cpp: z.number().positive(),
  // TPG's stated valuation month, e.g. "August 2026" — not the fetch date.
  source_month: z.string().min(1),
});
export type PointsValuationRecord = z.infer<typeof PointsValuationRecordSchema>;

export type RecordType =
  | "transfer_partner"
  | "transfer_bonus"
  | "spending_bonus"
  | "travel_collection"
  | "points_valuation";

export const RECORD_SCHEMAS = {
  transfer_partner: TransferPartnerRecordSchema,
  transfer_bonus: TransferBonusRecordSchema,
  spending_bonus: SpendingBonusRecordSchema,
  travel_collection: TravelCollectionRecordSchema,
  points_valuation: PointsValuationRecordSchema,
} as const;

export type AnyRecord =
  | TransferPartnerRecord
  | TransferBonusRecord
  | SpendingBonusRecord
  | TravelCollectionRecord
  | PointsValuationRecord;
