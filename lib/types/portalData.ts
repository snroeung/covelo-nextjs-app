import type { PortalId } from "@/lib/points/types";

export type SyncSource = 'admin' | 'cron';
export type SyncStatus = 'admin' | 'pending' | 'approved' | 'rejected';

export interface TransferPartnerRow {
  id: string;
  portal_id: PortalId;
  program: string;
  type: 'hotel' | 'airline';
  ratio: string;
  chain_key: string | null;
  iata_codes: string[];
  source: SyncSource;
  status: SyncStatus;
  source_url: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface TravelCollection {
  id: string;
  issuer: 'chase' | 'amex' | 'c1' | 'bilt' | 'citi';
  type: 'hotel' | 'flight';
  collection_name: string;
  property_name: string | null;
  airline_name: string | null;
  airline_iata_code: string | null;
  origin_iata_code: string | null;
  destination_iata_code: string | null;
  cabin_class: 'economy' | 'premium_economy' | 'business' | 'first' | null;
  perk_summary: string;
  original_amount: number | null;
  original_unit: 'points' | 'usd' | null;
  discount_amount: number | null;
  discount_unit: 'points' | 'usd' | null;
  end_date: string | null;
  limited_time_offer: boolean;
  source: SyncSource;
  status: SyncStatus;
  source_url: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PointsValuation {
  id: string;
  program: string;
  cpp: number;
  source_month: string;
  source: SyncSource;
  status: SyncStatus;
  source_url: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PortalSyncRun {
  id: string;
  source_key: string;
  source_url: string;
  status: 'success' | 'partial' | 'failed';
  records_found: number;
  records_written: number;
  error_message: string | null;
  llm_model: string | null;
  llm_tokens_used: number | null;
  raw_text_excerpt: string | null;
  started_at: string;
  finished_at: string;
}

export type PendingReviewTable =
  | 'transfer_partners'
  | 'travel_collections'
  | 'transfer_bonuses'
  | 'spending_bonuses'
  | 'points_valuations';

export interface PendingReviewRow {
  table: PendingReviewTable;
  row: Record<string, unknown>;
}
