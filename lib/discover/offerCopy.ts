import type { TransferBonus, SpendingBonus } from '@/lib/types/offers';

export const ISSUER_LABELS: Record<string, string> = {
  chase: 'Chase',
  amex:  'American Express',
  c1:    'Capital One',
  bilt:  'Bilt',
  citi:  'Citi',
};

type Offer = TransferBonus | SpendingBonus;

export function isTransfer(offer: Offer): offer is TransferBonus {
  return 'transfer_partner' in offer;
}

// Parse as local calendar date, not UTC — `new Date(iso)` on a bare
// YYYY-MM-DD string parses as UTC midnight, which renders as the previous
// day in timezones behind UTC.
function localDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function formatDate(iso: string): string {
  return localDate(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

export function formatDateShort(iso: string): string {
  return localDate(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function daysUntil(iso: string): number {
  return Math.ceil((localDate(iso).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

export function relativeTime(iso: string): string {
  const hours = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60)));
  if (hours < 24) return `${hours}H AGO`;
  return `${Math.round(hours / 24)}D AGO`;
}

/** "FRI 24 APR 2026" — always today, per the brief's own correction note. */
export function todayPill(now: Date = new Date()): string {
  const weekday = now.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
  const month = now.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
  return `${weekday} ${now.getDate()} ${month} ${now.getFullYear()}`;
}

interface Narrative {
  cat: string;
  kicker: string;
  headline: string;
  dek: string;
  standfirst: string;
  value: string;
  valueDetail: string;
  time: string;
  minimum: string | null;
  terms: Array<{ label: string; value: string }>;
  howItWorks: Array<{ step: string; title: string; detail: string }>;
}

function buildNarrative(offer: Offer): Narrative {
  const issuer = ISSUER_LABELS[offer.issuer] ?? offer.issuer;
  const time = relativeTime(offer.updated_at);

  if (isTransfer(offer)) {
    const partner = offer.transfer_partner;
    const kicker = `TRANSFER BONUS · ${issuer.toUpperCase()} → ${partner.toUpperCase()}`;
    const targetedNote = offer.is_targeted ? ' — targeted, so check your own account before counting on it' : '';

    if (offer.bonus_pct != null) {
      const value = `+${offer.bonus_pct}%`;
      const valueDetail = `expires ${formatDateShort(offer.end_date)}`;
      const headline = `${issuer} opens a ${offer.bonus_pct}% premium transferring to ${partner}`;
      const ratioLine = offer.effective_ratio != null
        ? `1,000 points become ${Math.round(1000 * offer.effective_ratio).toLocaleString()}`
        : `The bonus posts automatically`;
      const dek = `${ratioLine} through ${formatDate(offer.end_date)}.`;
      const standfirst = `${ratioLine} through ${formatDate(offer.end_date)}${targetedNote}.`;
      return {
        cat: 'TRANSFER', kicker, headline, dek, standfirst, value, valueDetail, time, minimum: null,
        terms: [
          { label: 'Window', value: `${offer.start_date ? formatDateShort(offer.start_date) + ' – ' : 'through '}${formatDate(offer.end_date)}` },
          { label: 'Eligibility', value: offer.is_targeted ? 'Targeted accounts' : `${issuer} cardholders` },
          { label: 'Country', value: offer.country },
        ],
        howItWorks: [
          { step: '01', title: `Move points from ${issuer} to ${partner}`, detail: 'Transfers post within minutes and cannot be reversed.' },
          { step: '02', title: 'Confirm the bonus lands before you book', detail: `The ${offer.bonus_pct}% premium shows on your ${partner} balance, not the transfer receipt.` },
          { step: '03', title: 'Book before the window closes', detail: `This offer runs through ${formatDate(offer.end_date)}.` },
        ],
      };
    }

    const pts = (offer.min_transfer_points ?? 0).toLocaleString();
    const value = `${pts}+ pts`;
    const valueDetail = `expires ${formatDateShort(offer.end_date)}`;
    const headline = `${partner} status match opens for ${issuer} points`;
    const dek = `Move at least ${pts} points through ${formatDate(offer.end_date)}.`;
    const standfirst = `Move at least ${pts} points to ${partner} to unlock status match, through ${formatDate(offer.end_date)}${targetedNote}.`;
    return {
      cat: 'TRANSFER', kicker, headline, dek, standfirst, value, valueDetail, time, minimum: null,
      terms: [
        { label: 'Window', value: `through ${formatDate(offer.end_date)}` },
        { label: 'Eligibility', value: offer.is_targeted ? 'Targeted accounts' : `${issuer} cardholders` },
        { label: 'Country', value: offer.country },
      ],
      howItWorks: [
        { step: '01', title: `Move points from ${issuer} to ${partner}`, detail: 'Transfers post within minutes and cannot be reversed.' },
        { step: '02', title: 'Minimum transfer applies', detail: `At least ${pts} points must move in a single transfer.` },
        { step: '03', title: 'Status match applies on arrival', detail: `This offer runs through ${formatDate(offer.end_date)}.` },
      ],
    };
  }

  const cat = offer.bonus_type === 'cash_back_pct' ? 'CASH BACK'
    : offer.bonus_type === 'dollar_amount' ? 'CREDIT'
    : 'SPENDING';
  const value = offer.bonus_type === 'cash_back_pct' ? `${offer.bonus_multiplier}%`
    : offer.bonus_type === 'dollar_amount' ? `$${offer.bonus_multiplier}`
    : `${offer.bonus_multiplier}×`;
  const unit = offer.bonus_type === 'cash_back_pct' ? 'cash back'
    : offer.bonus_type === 'dollar_amount' ? 'credit'
    : 'points';
  const minimum = offer.minimum_nights
    ? `${offer.minimum_nights} night${offer.minimum_nights > 1 ? 's' : ''} minimum`
    : offer.spending_minimum
      ? `$${offer.spending_minimum} minimum spend`
      : null;
  const endLabel = offer.end_date ? `through ${formatDate(offer.end_date)}` : 'no expiration listed';
  const kicker = `${cat} · ${issuer.toUpperCase()} → ${offer.merchant_name.toUpperCase()}`;
  const headline = `${issuer} offers ${value} ${unit} at ${offer.merchant_name}`;
  const dek = [minimum, endLabel].filter(Boolean).join(' · ');
  const standfirst = `${value} ${unit} at ${offer.merchant_name}${minimum ? `, after ${minimum.toLowerCase()}` : ''} — ${endLabel}${offer.is_targeted ? ', targeted accounts only' : ''}.`;
  const valueDetail = offer.end_date ? `expires ${formatDateShort(offer.end_date)}` : 'no expiration';

  return {
    cat, kicker, headline, dek, standfirst, value, valueDetail, time, minimum,
    terms: [
      { label: 'Window', value: offer.end_date ? formatDate(offer.end_date) : 'No expiration' },
      { label: 'Eligibility', value: offer.is_targeted ? 'Targeted accounts' : `${issuer} cardholders` },
      { label: 'Country', value: offer.country },
    ],
    howItWorks: [
      { step: '01', title: `Add the offer to your ${issuer} account`, detail: 'Some issuers require manually adding a targeted offer before it tracks.' },
      { step: '02', title: minimum ? `Meet the minimum — ${minimum.toLowerCase()}` : 'Meet the offer terms', detail: `Reward posts as ${value} ${unit} at ${offer.merchant_name}.` },
      { step: '03', title: 'Reward posts to your account', detail: `This offer is ${endLabel}.` },
    ],
  };
}

export interface StoryCopy { cat: string; kicker: string; headline: string; dek: string; value: string; time: string; }
export function buildStoryCopy(offer: Offer): StoryCopy {
  const n = buildNarrative(offer);
  return { cat: n.cat, kicker: n.kicker, headline: n.headline, dek: n.dek, value: n.value, time: n.time };
}

export interface LeadCopy { kicker: string; headline: string; standfirst: string; value: string; valueDetail: string; time: string; }
export function buildLeadCopy(offer: TransferBonus): LeadCopy {
  const n = buildNarrative(offer);
  return { kicker: n.kicker, headline: n.headline, standfirst: n.standfirst, value: n.value, valueDetail: n.valueDetail, time: n.time };
}

export interface ModalCopy extends LeadCopy {
  minimum: string | null;
  terms: Array<{ label: string; value: string }>;
  howItWorks: Array<{ step: string; title: string; detail: string }>;
}
export function buildModalCopy(offer: Offer): ModalCopy {
  const n = buildNarrative(offer);
  return {
    kicker: n.kicker, headline: n.headline, standfirst: n.standfirst, value: n.value, valueDetail: n.valueDetail,
    time: n.time, minimum: n.minimum, terms: n.terms, howItWorks: n.howItWorks,
  };
}

/** Highest upvotes first, then soonest-expiring; used by /discover and /offers. */
export function sortByValueThenRecency(a: Offer, b: Offer): number {
  if (b.upvotes !== a.upvotes) return b.upvotes - a.upvotes;
  const aEnd = 'end_date' in a && a.end_date ? new Date(a.end_date).getTime() : Infinity;
  const bEnd = 'end_date' in b && b.end_date ? new Date(b.end_date).getTime() : Infinity;
  return aEnd - bEnd;
}
