import { z } from "zod";

export const TransferPartnerRecordSchema = z.object({
  portal_id: z.enum(["chase", "amex", "capital_one", "bilt", "citi"]),
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
  bonus_pct: z.number().positive(),
  description: z.string().nullable().optional(),
  start_date: z.string().nullable().optional(),
  end_date: z.string().min(1),
  is_targeted: z.boolean().optional(),
});
export type TransferBonusRecord = z.infer<typeof TransferBonusRecordSchema>;

export const SpendingBonusRecordSchema = z.object({
  issuer: z.enum(["chase", "amex", "c1", "bilt", "citi"]),
  merchant_name: z.string().min(1),
  bonus_multiplier: z.number().positive(),
  bonus_type: z.enum(["points_multiplier", "cash_back_pct"]),
  description: z.string().nullable().optional(),
  spending_minimum: z.number().nullable().optional(),
  minimum_nights: z.number().nullable().optional(),
  start_date: z.string().nullable().optional(),
  end_date: z.string().min(1),
  is_targeted: z.boolean().optional(),
});
export type SpendingBonusRecord = z.infer<typeof SpendingBonusRecordSchema>;

export const HotelCollectionRecordSchema = z.object({
  issuer: z.enum(["chase", "amex", "c1", "bilt", "citi"]),
  collection_name: z.string().min(1),
  property_name: z.string().nullable().optional(),
  perk_summary: z.string().min(1),
  original_amount: z.number().positive().nullable().optional(),
  original_unit: z.enum(["points", "usd"]).nullable().optional(),
  discount_amount: z.number().positive().nullable().optional(),
  discount_unit: z.enum(["points", "usd"]).nullable().optional(),
  start_date: z.string().nullable().optional(),
  end_date: z.string().nullable().optional(),
});
export type HotelCollectionRecord = z.infer<typeof HotelCollectionRecordSchema>;

export type RecordType =
  | "transfer_partner"
  | "transfer_bonus"
  | "spending_bonus"
  | "hotel_collection";

export const RECORD_SCHEMAS = {
  transfer_partner: TransferPartnerRecordSchema,
  transfer_bonus: TransferBonusRecordSchema,
  spending_bonus: SpendingBonusRecordSchema,
  hotel_collection: HotelCollectionRecordSchema,
} as const;

export type AnyRecord =
  | TransferPartnerRecord
  | TransferBonusRecord
  | SpendingBonusRecord
  | HotelCollectionRecord;
