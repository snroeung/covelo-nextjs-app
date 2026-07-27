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
      bonus_multiplier: 15,
      bonus_type: "dollar_amount",
      description: "Spend $75 or more, get $15 back",
      spending_minimum: 75,
      end_date: "2026-12-31",
      limited_time_offer: false,
    },
    {
      issuer: "chase",
      merchant_name: "Turo",
      bonus_multiplier: 10,
      bonus_type: "cash_back_pct",
      description: "Earn 10% cash-back on your Turo purchase when you spend $150 or more, with a $25 cash-back maximum",
      spending_minimum: 150,
      end_date: "2026-12-31",
      limited_time_offer: true,
    },
    {
      issuer: "c1",
      merchant_name: "Whole Foods Market",
      bonus_multiplier: 5,
      bonus_type: "points_multiplier",
      description: "Earn 5x miles on Whole Foods purchases for a limited time",
      end_date: "2026-12-31",
      limited_time_offer: true,
    },
  ],
  travel_collection: [
    {
      issuer: "amex",
      type: "hotel",
      collection_name: "The Hotel Collection",
      property_name: "Hotel El Convento",
      perk_summary: "$100 credit towards eligible charges, 4pm late check-out when available, room upgrade upon arrival when available",
      limited_time_offer: false,
    },
    {
      issuer: "chase",
      type: "hotel",
      collection_name: "Points Boost",
      property_name: "The Ritz-Carlton, Naples",
      perk_summary: "Reduced points price to book through Chase Travel",
      original_amount: 50000,
      original_unit: "points",
      discount_amount: 40000,
      discount_unit: "points",
      limited_time_offer: true,
    },
    {
      issuer: "chase",
      type: "flight",
      collection_name: "Points Boost",
      airline_name: "United Airlines",
      airline_iata_code: "UA",
      cabin_class: "business",
      perk_summary: "Reduced points price on business class fares through Chase Travel",
      original_amount: 120000,
      original_unit: "points",
      discount_amount: 95000,
      discount_unit: "points",
      limited_time_offer: false,
    },
  ],
};
