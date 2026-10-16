// Auto-generated board post copy for scraped offers. Ported from bdGenPost
// in the design prototype.
//
// Cron-only: upsert.ts writes the result into board_post_title /
// board_post_body on every scraped transfer/spending bonus, so the admin
// review queue has post copy ready. After that the stored text is the text —
// the admin offer editor shows and saves it as-is, and offers created by hand
// start with empty post fields.

import { ISSUER_LABELS, formatDateShort } from "@/lib/discover/offerCopy";

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

export interface GeneratedPost {
  title: string;
  body: string;
}

export function genBoardPost(o: BoardOfferView): GeneratedPost {
  const route = o.from + (o.to ? ` → ${o.to}` : "");
  const ends = o.ends ? ` — ends ${o.ends}` : "";
  const title =
    o.type === "TRANSFER BONUS" ? `${route} ${o.value} transfer bonus is live${ends}`
    : o.type === "SIGN-UP BONUS" ? `${o.title}: ${o.value} after ${o.detail || "minimum spend"}${ends}`
    : `${o.title}${o.detail ? ` (${o.detail})` : ""}${ends}`;
  const body = [
    `${o.value} · ${route}.`,
    o.detail && `${o.detail.charAt(0).toUpperCase()}${o.detail.slice(1)}.`,
    o.ends && `Ends ${o.ends}.`,
    o.terms,
  ]
    .filter(Boolean)
    .join(" ");
  return { title, body };
}

// ─── Catalog rows → board offer view ─────────────────────────────────────────

/** The transfer_bonuses columns the post copy needs. */
export interface TransferBonusFields {
  issuer: string;
  transfer_partner: string;
  bonus_pct?: number | null;
  min_transfer_points?: number | null;
  end_date?: string | null;
  description?: string | null;
}

/** The spending_bonuses columns the post copy needs. */
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

/** Columns the cron writes onto a scraped catalog row. */
export interface BoardPostColumns {
  board_post_title: string;
  board_post_body: string;
}

export function boardPostColumns(offer: BoardOfferView): BoardPostColumns {
  const { title, body } = genBoardPost(offer);
  return { board_post_title: title, board_post_body: body };
}
