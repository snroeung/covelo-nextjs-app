import type { RecordType } from "./schemas";

// Hand-curated, promoted manually from portal_sync_corrections over time
// (plan section 3a). Keep 2-3 examples per record type — enough to anchor
// the LLM's output shape without bloating every prompt.
export const FEW_SHOT_EXAMPLES: Partial<Record<RecordType, unknown[]>> = {
  transfer_partner: [
    {
      portal_id: "chase",
      program: "World of Hyatt",
      type: "hotel",
      ratio: "1:1",
      chain_key: "hyatt",
    },
    {
      portal_id: "amex",
      program: "Delta SkyMiles",
      type: "airline",
      ratio: "1:1",
      iata_codes: ["DL"],
    },
  ],
  transfer_bonus: [
    {
      issuer: "chase",
      transfer_partner: "World of Hyatt",
      bonus_pct: 30,
      description: "30% transfer bonus to World of Hyatt",
      end_date: "2026-08-31",
    },
  ],
  spending_bonus: [
    {
      issuer: "amex",
      merchant_name: "Amazon.com",
      bonus_multiplier: 1,
      bonus_type: "cash_back_pct",
      description: "Spend $75 or more, get $15 back",
      spending_minimum: 75,
      end_date: "2026-12-31",
    },
  ],
  hotel_collection: [
    {
      issuer: "amex",
      collection_name: "Fine Hotels + Resorts",
      perk_summary: "Room upgrade upon arrival, $100 property credit, guaranteed late checkout",
    },
    {
      issuer: "chase",
      collection_name: "Points Boost",
      property_name: "The Ritz-Carlton, Naples",
      perk_summary: "Reduced points price to book through Chase Travel",
      original_amount: 50000,
      original_unit: "points",
      discount_amount: 40000,
      discount_unit: "points",
    },
  ],
};
