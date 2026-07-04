export type Issuer = 'chase' | 'amex' | 'c1' | 'bilt' | 'citi';
export type OfferStatus = 'admin' | 'pending' | 'approved' | 'rejected';
export type BonusType = 'points_multiplier' | 'cash_back_pct' | 'dollar_amount';
export type AdSlot = 'hero' | 'grid_inline' | 'below_grid' | 'sidebar'
  | 'flights_inline' | 'hotels_inline' | 'trip_strip';

export interface TransferBonus {
  id: string;
  issuer: Issuer;
  transfer_partner: string;
  bonus_pct: number;
  effective_ratio: number;
  description: string | null;
  tags: string[];
  start_date: string | null;
  end_date: string;
  is_targeted: boolean;
  source_url: string | null;
  country: string;
  status: OfferStatus;
  submitted_by: string | null;
  upvotes: number;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface SpendingBonus {
  id: string;
  issuer: Issuer;
  merchant_name: string;
  bonus_multiplier: number;
  bonus_type: BonusType;
  spending_minimum: number | null;
  minimum_nights: number | null;
  description: string | null;
  tags: string[];
  card_ids: string[];
  start_date: string | null;
  end_date: string;
  is_targeted: boolean;
  source_url: string | null;
  country: string;
  status: OfferStatus;
  submitted_by: string | null;
  upvotes: number;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface SponsoredAd {
  id: string;
  partner: string;
  product: string;
  slot: AdSlot;
  headline: string;
  subheadline: string | null;
  bullets: string[];
  cta_label: string;
  cta_url: string;
  tracking_id: string;
  disclosure: string;
  tone: string;
  image_url: string | null;
  active: boolean;
  country: string;
  start_date: string | null;
  end_date: string | null;
  impressions: number;
  clicks: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

// Served to public — no tracking_id, impressions, clicks, created_by
export interface PublicSponsoredAd {
  id: string;
  partner: string;
  product: string;
  slot: AdSlot;
  headline: string;
  subheadline: string | null;
  bullets: string[];
  cta_label: string;
  cta_url: string;
  disclosure: string;
  tone: string;
  image_url: string | null;
  country: string;
}
