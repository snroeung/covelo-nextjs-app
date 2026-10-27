// A member-created offer, in the same shape the admin offer editor saves
// (server/routers/offers.ts createTransferBonusInput / createSpendingBonusInput)
// so publishing one is a prefill, not a re-type. Client-safe: the composer
// validates with it, the router re-validates, and the flat text columns the
// feed reads are derived from it.

import { z } from "zod";
import { spendingBonusToBoardOffer, transferBonusToBoardOffer } from "./offerView";

export const OFFER_ISSUERS = ["chase", "amex", "c1", "bilt", "citi"] as const;
export type OfferIssuer = (typeof OFFER_ISSUERS)[number];
export const BONUS_TYPES = ["points_multiplier", "cash_back_pct", "dollar_amount"] as const;

/** Same tag list as the admin offer editor. */
export const OFFER_TAGS = [
  "Statement credit", "Free night", "Sign on bonus", "Points bonus", "Transfer bonus", "Cash back",
  "Hotel credit", "Flight credit", "Dining credit", "Travel credit", "Annual benefit", "Limited time",
] as const;

export const OFFER_COUNTRIES = [
  { value: "US", label: "United States" },
  { value: "Global", label: "Global" },
  { value: "CA", label: "Canada" },
  { value: "GB", label: "United Kingdom" },
  { value: "AU", label: "Australia" },
] as const;

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a date like 2026-06-30.");
const httpLink = z
  .string()
  .trim()
  .max(2000)
  .refine((v) => v === "" || /^https?:\/\/\S+$/i.test(v), "Source link must start with http:// or https://");

const shared = {
  issuer: z.enum(OFFER_ISSUERS),
  /** Empty = every card the issuer has, same meaning as the admin editor */
  card_ids: z.array(z.string().min(1).max(40)).max(40).default([]),
  tags: z.array(z.enum(OFFER_TAGS)).max(OFFER_TAGS.length).default([]),
  start_date: isoDate,
  end_date: isoDate,
  country: z.enum(OFFER_COUNTRIES.map((c) => c.value) as [string, ...string[]]).default("US"),
  is_targeted: z.boolean().default(false),
  description: z.string().trim().max(300).optional(),
  source_url: httpLink.optional(),
};

const transfer = z.object({
  kind: z.literal("transfer"),
  ...shared,
  transfer_partner: z.string().trim().min(1).max(80),
  /** Optional with a minimum transfer: a status-match offer has no percentage */
  bonus_pct: z.number().positive().max(1000).optional(),
  min_transfer_points: z.number().positive().optional(),
  for_status_transfer: z.boolean().default(false),
});

const spending = z.object({
  kind: z.literal("spending"),
  ...shared,
  merchant_name: z.string().trim().min(1).max(80),
  bonus_type: z.enum(BONUS_TYPES),
  bonus_multiplier: z.number().positive().max(100000),
  spending_minimum: z.number().positive().optional(),
  minimum_nights: z.number().int().positive().max(365).optional(),
});

export const memberOfferDetails = z
  .discriminatedUnion("kind", [transfer, spending])
  .superRefine((v, ctx) => {
    if (v.kind === "transfer" && v.bonus_pct === undefined && v.min_transfer_points === undefined) {
      ctx.addIssue({ code: "custom", message: "Add a bonus percentage or a minimum transfer.", path: ["bonus_pct"] });
    }
    if (v.end_date < v.start_date) {
      ctx.addIssue({ code: "custom", message: "The end date can't be before the start date.", path: ["end_date"] });
    }
  });

export type MemberOfferDetails = z.infer<typeof memberOfferDetails>;
export type MemberOfferDetailsInput = z.input<typeof memberOfferDetails>;

/** The flat columns on board_member_offers (and what moderation scans), derived from the details. */
export interface MemberOfferColumns {
  type: string;
  value: string;
  name: string;
  from: string;
  to: string | undefined;
  conditions: string | undefined;
  ends: string | undefined;
  url: string | undefined;
}

export function deriveMemberOfferColumns(d: MemberOfferDetails): MemberOfferColumns {
  const view = d.kind === "transfer"
    ? transferBonusToBoardOffer({ issuer: d.issuer, transfer_partner: d.transfer_partner, bonus_pct: d.bonus_pct, min_transfer_points: d.min_transfer_points, end_date: d.end_date, description: d.description })
    : spendingBonusToBoardOffer({ issuer: d.issuer, merchant_name: d.merchant_name, bonus_multiplier: d.bonus_multiplier, bonus_type: d.bonus_type, spending_minimum: d.spending_minimum, minimum_nights: d.minimum_nights, end_date: d.end_date, description: d.description });
  return {
    type: view.type,
    value: view.value.slice(0, 24),
    name: view.title.slice(0, 120),
    from: view.from.slice(0, 80),
    to: view.to?.slice(0, 80) || undefined,
    conditions: view.detail?.slice(0, 300) || undefined,
    ends: view.ends?.slice(0, 40) || undefined,
    url: d.source_url || undefined,
  };
}

// ─── Composer draft (form strings) ───────────────────────────────────────────

export interface MemberOfferDraft {
  kind: "transfer" | "spending";
  issuer: OfferIssuer | "";
  card_ids: string[];
  transfer_partner: string;
  bonus_pct: string;
  min_transfer_points: string;
  merchant_name: string;
  bonus_type: (typeof BONUS_TYPES)[number];
  bonus_multiplier: string;
  spending_minimum: string;
  minimum_nights: string;
  tags: string[];
  start_date: string;
  end_date: string;
  country: string;
  for_status_transfer: boolean;
  description: string;
  source_url: string;
}

export const EMPTY_MEMBER_OFFER: MemberOfferDraft = {
  kind: "transfer", issuer: "", card_ids: [], transfer_partner: "", bonus_pct: "", min_transfer_points: "",
  merchant_name: "", bonus_type: "points_multiplier", bonus_multiplier: "", spending_minimum: "", minimum_nights: "",
  tags: [], start_date: "", end_date: "", country: "US", for_status_transfer: false, description: "", source_url: "",
};

const num = (s: string) => (s.trim() === "" ? undefined : Number(s));
const str = (s: string) => s.trim() || undefined;

export function draftToDetails(d: MemberOfferDraft): unknown {
  const base = {
    issuer: d.issuer, card_ids: d.card_ids, tags: d.tags, start_date: str(d.start_date), end_date: str(d.end_date),
    country: d.country,
    // Targeted = limited to specific cards, the same thing the "Specific cards" choice says
    is_targeted: d.card_ids.length > 0, description: str(d.description), source_url: str(d.source_url),
  };
  return d.kind === "transfer"
    ? { kind: "transfer", ...base, transfer_partner: d.transfer_partner, bonus_pct: num(d.bonus_pct), min_transfer_points: num(d.min_transfer_points), for_status_transfer: d.for_status_transfer }
    : { kind: "spending", ...base, merchant_name: d.merchant_name, bonus_type: d.bonus_type, bonus_multiplier: num(d.bonus_multiplier), spending_minimum: num(d.spending_minimum), minimum_nights: num(d.minimum_nights) };
}

export interface DraftCheck {
  label: string;
  ok: boolean;
  /** What to tell the member when it fails */
  message: string;
}

const positive = (v: string) => Number(v) > 0;

/** The editor's validation checklist, kept in step with the schema. */
export function draftChecks(d: MemberOfferDraft): DraftCheck[] {
  const link = !d.source_url.trim() || /^https?:\/\/\S+$/i.test(d.source_url.trim());
  const dates: DraftCheck[] = [
    { label: "Start date set", ok: !!d.start_date, message: "Add the start date." },
    { label: "End date set", ok: !!d.end_date, message: "Add the end date." },
    { label: "End date is after the start", ok: !d.start_date || !d.end_date || d.end_date >= d.start_date, message: "The end date can't be before the start date." },
    { label: "Source URL valid (if set)", ok: link, message: "The source link must start with http:// or https://." },
  ];
  return d.kind === "transfer"
    ? [
        { label: "Issuer selected", ok: !!d.issuer, message: "Pick the issuer." },
        { label: "Transfer partner selected", ok: !!d.transfer_partner.trim(), message: "Pick the transfer partner." },
        { label: "Bonus % or min points set", ok: positive(d.bonus_pct) || positive(d.min_transfer_points), message: "Add a bonus percentage or a minimum transfer." },
        ...dates,
      ]
    : [
        { label: "Issuer selected", ok: !!d.issuer, message: "Pick the issuer." },
        { label: "Merchant name filled", ok: !!d.merchant_name.trim(), message: "Add the merchant or program." },
        { label: "Bonus value is positive", ok: positive(d.bonus_multiplier), message: "Add the bonus amount." },
        ...dates,
      ];
}

/** First problem with the draft in plain words, or null. Mirrors the router's schema. */
export function draftError(d: MemberOfferDraft): string | null {
  const failed = draftChecks(d).find((c) => !c.ok);
  if (failed) return failed.message;
  const parsed = memberOfferDetails.safeParse(draftToDetails(d));
  return parsed.success ? null : (parsed.error.issues[0]?.message ?? "Check the offer details.");
}

/** Bonus % → the multiple a transfer yields, "1.3000". "—" until there is a percentage. */
export function effectiveRatio(bonusPct: string): string {
  const n = parseFloat(bonusPct);
  return !isNaN(n) && n > 0 ? (1 + n / 100).toFixed(4) : "—";
}
