// Catalog / member offers → the shape the board renders and the portal-sync
// cron writes post copy from. Pure; shared by the feed (server) and
// scripts/portal-sync/genPost.ts.

import { ISSUER_LABELS, formatDateShort, daysUntil } from "@/lib/discover/offerCopy";

export interface BoardOfferView {
  /** "TRANSFER BONUS", "STATEMENT CREDIT", "SIGN-UP BONUS", … */
  type: string;
  /** "+30%", "5×", "$75" */
  value: string;
  title: string;
  /** "1,000 pts → 1,300 pts", "min. spend $300" */
  detail?: string | null;
  from: string;
  to?: string | null;
  /** "May 31" */
  ends?: string | null;
  terms?: string | null;
}

/** An offer on a board post, as the API returns it. */
export interface BoardOffer extends Omit<BoardOfferView, "detail" | "to" | "ends" | "terms"> {
  /** catalog: a covelo offer row · member: created in the composer, not in the catalog yet */
  source: "catalog" | "member";
  table: "transfer_bonuses" | "spending_bonuses" | null;
  id: string;
  detail: string | null;
  to: string | null;
  ends: string | null;
  /** "7 days left", "ongoing", "expired" — catalog offers only */
  endsIn: string | null;
  terms: string | null;
  url: string | null;
}

// ─── Catalog rows → view ─────────────────────────────────────────────────────

/** The transfer_bonuses columns the view needs. */
export interface TransferBonusFields {
  issuer: string;
  transfer_partner: string;
  bonus_pct?: number | null;
  min_transfer_points?: number | null;
  end_date?: string | null;
  description?: string | null;
}

/** The spending_bonuses columns the view needs. */
export interface SpendingBonusFields {
  issuer: string;
  merchant_name: string;
  bonus_multiplier: number;
  bonus_type: "points_multiplier" | "cash_back_pct" | "dollar_amount";
  spending_minimum?: number | null;
  minimum_nights?: number | null;
  end_date?: string | null;
  description?: string | null;
}

function issuerLabel(issuer: string): string {
  return ISSUER_LABELS[issuer] ?? issuer;
}

function endsLabel(endDate: string | null | undefined): string | null {
  return endDate ? formatDateShort(endDate) : null;
}

function cleanTerms(description: string | null | undefined): string | null {
  const t = description?.trim();
  return t ? t : null;
}

export function transferBonusToBoardOffer(o: TransferBonusFields): BoardOfferView {
  const from = issuerLabel(o.issuer);
  const base = { from, to: o.transfer_partner, ends: endsLabel(o.end_date), terms: cleanTerms(o.description) };

  if (o.bonus_pct != null) {
    const pct = Number(o.bonus_pct);
    return {
      ...base,
      type: "TRANSFER BONUS",
      value: `+${pct}%`,
      title: `${pct}% transfer bonus · ${from} → ${o.transfer_partner}`,
      detail: `1,000 pts → ${Math.round(1000 * (1 + pct / 100)).toLocaleString("en-US")} pts`,
    };
  }

  // Status-match tiers have no percentage, just a minimum transfer
  const pts = Number(o.min_transfer_points ?? 0).toLocaleString("en-US");
  return {
    ...base,
    type: "STATUS MATCH",
    value: `${pts}+ pts`,
    title: `${o.transfer_partner} status match via ${from}`,
    detail: `transfer at least ${pts} pts`,
  };
}

export function spendingBonusToBoardOffer(o: SpendingBonusFields): BoardOfferView {
  const m = Number(o.bonus_multiplier);
  const byType = {
    dollar_amount:     { type: "STATEMENT CREDIT", value: `$${m}`, title: `$${m} credit at ${o.merchant_name}` },
    cash_back_pct:     { type: "CASH BACK",        value: `${m}%`, title: `${m}% cash back · ${o.merchant_name}` },
    points_multiplier: { type: "POINTS BONUS",     value: `${m}×`, title: `${m}× points · ${o.merchant_name}` },
  }[o.bonus_type];
  const detail = [
    o.spending_minimum ? `min. spend $${Number(o.spending_minimum).toLocaleString("en-US")}` : null,
    o.minimum_nights ? `${o.minimum_nights} nights minimum` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  return {
    ...byType,
    detail: detail || null,
    from: issuerLabel(o.issuer),
    to: o.merchant_name,
    ends: endsLabel(o.end_date),
    terms: cleanTerms(o.description),
  };
}

// ─── View → API offer ────────────────────────────────────────────────────────

/** "7 days left", "ends today", "expired", or "ongoing" with no end date. */
export function endsInLabel(endDate: string | null | undefined): string {
  if (!endDate) return "ongoing";
  const days = daysUntil(endDate);
  if (days < 0) return "expired";
  if (days === 0) return "ends today";
  return days === 1 ? "1 day left" : `${days} days left`;
}

export interface CatalogOfferRow {
  id: string;
  source_url?: string | null;
}

export function catalogTransferOffer(row: TransferBonusFields & CatalogOfferRow): BoardOffer {
  const v = transferBonusToBoardOffer(row);
  return {
    ...v,
    source: "catalog", table: "transfer_bonuses", id: row.id,
    detail: v.detail ?? null, to: v.to ?? null, ends: v.ends ?? null, terms: v.terms ?? null,
    endsIn: endsInLabel(row.end_date), url: row.source_url ?? null,
  };
}

export function catalogSpendingOffer(row: SpendingBonusFields & CatalogOfferRow): BoardOffer {
  const v = spendingBonusToBoardOffer(row);
  return {
    ...v,
    source: "catalog", table: "spending_bonuses", id: row.id,
    detail: v.detail ?? null, to: v.to ?? null, ends: v.ends ?? null, terms: v.terms ?? null,
    endsIn: endsInLabel(row.end_date), url: row.source_url ?? null,
  };
}

/** A board_member_offers row. */
export interface MemberOfferRow {
  id: string;
  type: string;
  value: string;
  name: string;
  from_program: string;
  to_program: string | null;
  conditions: string | null;
  ends_label: string | null;
  source_url: string | null;
}

export function memberOffer(row: MemberOfferRow): BoardOffer {
  return {
    source: "member", table: null, id: row.id,
    type: row.type, value: row.value, title: row.name,
    from: row.from_program, to: row.to_program,
    detail: row.conditions, ends: row.ends_label, endsIn: null,
    terms: null, url: row.source_url,
  };
}
