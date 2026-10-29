// Stage 2 (plan §8.1). Board rule 02: no referral or affiliate links. Short
// links are rejected too — they hide where they go.

import { MOD_THRESHOLDS } from "@/lib/board/constants";

const URL_RE =
  /\b(?:(?:https?:\/\/|www\.)[^\s<>()"']+|[a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:com|net|org|io|co|ly|me|app|link|to|gl|gd|at|us|page|travel|info|biz)\b(?:\/[^\s<>()"']*)?)/gi;

/** Query params that carry referral/affiliate attribution. */
const REFERRAL_PARAMS = new Set([
  "ref", "referral", "referrer", "referralcode", "refid", "ref_id", "refcode", "invite", "invitecode",
  "aff", "affid", "aff_id", "affiliate", "affiliateid", "affiliate_id",
  "irclickid", "clickid", "click_id", "subid", "sub_id", "afftrack", "tag",
]);
/** utm_source / utm_medium values that mean the link is paid attribution. */
const REFERRAL_UTM = /^(?:affiliate|aff|partner|referral|refer|invite)/i;
/** Path segments used by card referral programs ("/refer", "/referral/…", "/r/…"). */
const REFERRAL_PATH = /\/(?:refer|referral|referrals|refer-a-friend|referafriend|invite|r)(?:\/|$)/i;

/** Hosts that are URL shorteners or affiliate/referral networks. Suffix match. */
const BLOCKED_HOSTS = [
  // shorteners
  "bit.ly", "tinyurl.com", "goo.gl", "ow.ly", "is.gd", "buff.ly", "rebrand.ly", "cutt.ly",
  "shorturl.at", "tiny.cc", "rb.gy", "t.ly", "lnkd.in", "amzn.to", "linktr.ee",
  // affiliate networks
  "go.skimresources.com", "click.linksynergy.com", "linksynergy.com", "anrdoezrs.net",
  "jdoqocy.com", "tkqlhce.com", "dpbolvw.net", "kqzyfj.com", "awin1.com", "shareasale.com",
  "sjv.io", "pxf.io", "7eer.net", "ojrq.net", "prf.hn", "avantlink.com", "refersion.com",
  // card referral programs
  "referyourchasecard.com", "capital.one", "refer.amex.us",
];

export interface LinkScan {
  links: string[];
  /** Links that broke the referral rule */
  referral: string[];
  tooMany: boolean;
}

export function extractLinks(text: string): string[] {
  return [...new Set(text.match(URL_RE) ?? [])];
}

function toUrl(raw: string): URL | null {
  try {
    return new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
  } catch {
    return null;
  }
}

export function isReferralLink(raw: string): boolean {
  const url = toUrl(raw.replace(/[.,;:!?]+$/, ""));
  if (!url) return false;
  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  if (BLOCKED_HOSTS.some((h) => host === h || host.endsWith(`.${h}`))) return true;
  if (REFERRAL_PATH.test(url.pathname)) return true;
  for (const [key, value] of url.searchParams) {
    const k = key.toLowerCase();
    if (REFERRAL_PARAMS.has(k)) return true;
    if ((k === "utm_source" || k === "utm_medium") && REFERRAL_UTM.test(value)) return true;
  }
  return false;
}

export function scanLinks(text: string): LinkScan {
  const links = extractLinks(text);
  return {
    links,
    referral: links.filter(isReferralLink),
    tooMany: links.length > MOD_THRESHOLDS.maxLinks,
  };
}
