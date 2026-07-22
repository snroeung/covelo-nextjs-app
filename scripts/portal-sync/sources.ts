import type { PortalId } from "@/lib/points/types";
import type { RecordType } from "./schemas";
import type { SectionSpec } from "./fetch";

export interface SourceConfig {
  key: string;
  portalId: PortalId;
  url: string;
  recordType: RecordType;
  needsBrowser: boolean;
  isTpgFallback: boolean;
  // SPA tab widgets: pull each panel's text separately (see
  // fetchRenderedSections) instead of one flattened page-text blob, so the
  // extraction prompt can tell which tab/category each record came from.
  sections?: SectionSpec[];
  // True single-open accordions where content only renders on click (see
  // fetchClickThroughPanels) — unlike `sections`, these panels aren't in the
  // DOM until clicked, so each one requires a real click + read cycle. A
  // single CSS selector matching every tile's trigger element (not a
  // hardcoded per-tile list), so tiles the source site adds or removes are
  // picked up automatically on the next run.
  clickTriggerSelector?: string;
  // Shared result container all clickTriggerSelector triggers render into.
  // Required when clickTriggerSelector is set.
  clickResultSelector?: string;
  // Extra guidance appended to the extraction prompt for this source only —
  // for pages whose structure/semantics the generic per-recordType prompt
  // can't infer (e.g. how to read a tabbed layout, or that no pricing is
  // shown so price fields must be left out rather than guessed).
  extraInstructions?: string;
}

// robots.txt checked 2026-07-19 — see plan section "robots.txt check" for the
// per-domain results. Sources marked isTpgFallback replace a direct scrape
// that was disallowed, unconfirmed, or blocked at the network layer.
export const SOURCES: SourceConfig[] = [
  {
    key: "chase_points_boost",
    portalId: "chase",
    url: "https://www.chase.com/travel/guide/travel-benefits/points-boost-offers",
    recordType: "hotel_collection",
    needsBrowser: true,
    isTpgFallback: false,
  },
  {
    key: "chase_sapphire_preferred_transfer",
    portalId: "chase",
    url: "https://upgradedpoints.com/credit-cards/chase-ultimate-rewards-transfer-partners/",
    recordType: "transfer_partner",
    needsBrowser: true,
    isTpgFallback: false,
  },
  // robots.txt checked 2026-07-21 — upgradedpoints.com disallow list has no
  // rule matching /news/best-chase-offers/. Static HTML has offer text.
  {
    key: "chase_spending_offers",
    portalId: "chase",
    url: "https://upgradedpoints.com/news/best-chase-offers/",
    recordType: "spending_bonus",
    needsBrowser: false,
    isTpgFallback: true,
  },
  // robots.txt checked 2026-07-20 — wildcard group only disallows
  // /us/rwd/, /*/apply/, business/tls/partnerships, /*/logout. AhrefsBot
  // group disallows /*/travel/the-hotel-collection/ but that rule is scoped
  // to AhrefsBot, not our user-agent. All three paths below are allowed.
  {
    key: "amex_hotel_collection_featured",
    portalId: "amex",
    url: "https://www.americanexpress.com/en-us/travel/offers/hotels/the-hotel-collection-offers/featured",
    recordType: "hotel_collection",
    needsBrowser: true,
    isTpgFallback: false,
  },
  {
    key: "amex_hotel_collection_us",
    portalId: "amex",
    url: "https://www.americanexpress.com/en-us/travel/offers/hotels/the-hotel-collection-offers/us",
    recordType: "hotel_collection",
    needsBrowser: true,
    isTpgFallback: false,
  },
  {
    key: "amex_hotel_collection_international",
    portalId: "amex",
    url: "https://www.americanexpress.com/en-us/travel/offers/hotels/the-hotel-collection-offers/international",
    recordType: "hotel_collection",
    needsBrowser: true,
    isTpgFallback: false,
  },
  // robots.txt checked 2026-07-21 — global.americanexpress.com has no
  // robots.txt (404), fails open per isAllowed(). Full partner list present
  // in static HTML (server-rendered), no browser needed.
  {
    key: "amex_membership_rewards_transfer",
    portalId: "amex",
    url: "https://global.americanexpress.com/rewards/transfer",
    recordType: "transfer_partner",
    needsBrowser: false,
    isTpgFallback: false,
  },
  // robots.txt checked 2026-07-21 — upgradedpoints.com allows /news/. Static
  // HTML has offer text.
  {
    key: "amex_spending_offers",
    portalId: "amex",
    url: "https://upgradedpoints.com/news/best-amex-offers/",
    recordType: "spending_bonus",
    needsBrowser: false,
    isTpgFallback: true,
  },
  {
    key: "bilt_transfer_partners",
    portalId: "bilt",
    url: "https://roame.travel/guides/bilt-transfer",
    recordType: "transfer_partner",
    needsBrowser: false,
    isTpgFallback: true,
  },
  // robots.txt checked 2026-07-21 — wildcard group is "Allow: /", no
  // disallowed paths. Tab panels are all present in the rendered DOM
  // (hidden="" on inactive ones) — no click interaction needed, just read
  // each panel's textContent. See fetchRenderedSections in fetch.ts.
  {
    key: "c1_lifestyle_collection",
    portalId: "c1",
    url: "https://capitalonetravel.com/lifestyle-collection",
    recordType: "hotel_collection",
    needsBrowser: true,
    isTpgFallback: false,
    sections: [
      { label: "Urban retreats", selector: "#Urban-retreats" },
      { label: "Chic interiors", selector: "#Chic-interiors" },
      { label: "Local gems", selector: "#Local-gems" },
      { label: "Weekend getaways", selector: "#Weekend-getaways" },
      { label: "Culinary hotspots", selector: "#Culinary-hotspots" },
    ],
    extraInstructions:
      'Page text is split into "== <tab label> ==" sections, one per Lifestyle Collection theme tab. Each section lists properties as "Property Name | City, Region". For every property found in every section: issuer is "c1", collection_name is "Capital One Lifestyle Collection — <tab label>" using that section\'s tab label, property_name is the property name (drop the "| City, Region" part), perk_summary is the general Lifestyle Collection benefit copy found elsewhere in the page text (e.g. room upgrade when available, free Wi-Fi, 4th night free) since it applies page-wide, not per property. The page does not list a points or dollar price for any property — do not invent one; omit original_amount, original_unit, discount_amount, and discount_unit entirely rather than guessing.',
  },
  {
    key: "c1_venture_transfer",
    portalId: "c1",
    url: "https://thepointsguy.com/loyalty-programs/capital-one-transfer-partners/",
    recordType: "transfer_partner",
    needsBrowser: true,
    isTpgFallback: false,
  },
  // robots.txt checked 2026-07-21 — upgradedpoints.com allows /news/. Static
  // HTML has offer text.
  {
    key: "c1_spending_offers",
    portalId: "c1",
    url: "https://upgradedpoints.com/news/best-capital-one-offers/",
    recordType: "spending_bonus",
    needsBrowser: false,
    isTpgFallback: true,
  },
  // robots.txt checked 2026-07-21 — upgradedpoints.com allows /news/. Static
  // HTML has offer text.
  {
    key: "citi_spending_offers",
    portalId: "citi",
    url: "https://upgradedpoints.com/news/best-current-citi-merchant-offers/",
    recordType: "spending_bonus",
    needsBrowser: false,
    isTpgFallback: true,
  },
  // TODO: needs more research
  // {
  //   key: "citi_strata_premier_transfer",
  //   portalId: "citi",
  //   url: "https://www.citi.com/credit-cards/citi-strata-premier-credit-card",
  //   recordType: "transfer_partner",
  //   needsBrowser: true,
  //   isTpgFallback: false,
  // },
  // robots.txt checked 2026-07-21 — thankyou.com/robots.txt returns HTTP 500,
  // fails open per isAllowed(). partnerProgramsListing.htm needs no login
  // despite the "Sign On" nav label — verified directly. Single-open
  // accordion, content only renders on click — see fetchClickThroughPanels.
  {
    key: "citi_thankyou_transfer_partners",
    portalId: "citi",
    url: "https://www.thankyou.com/partnerProgramsListing.htm?cmp=nav&lid=sub-nav|do-more-mod|points-transfer",
    recordType: "transfer_partner",
    needsBrowser: true,
    isTpgFallback: false,
    clickTriggerSelector: '[data-analytics-value$="|expand"]',
    clickResultSelector: "#card-expanded",
    extraInstructions:
      'Page text is split into "== <partner name> ==" sections, one per points-transfer partner. Each section states two conversion tiers depending on which Citi card the holder has (a premium tier — Strata Elite/Strata Premier/Prestige — and a standard tier — Strata, ThankYou Preferred, Double Cash, Custom Cash). For every partner found, set ratio to a single string combining both tiers, e.g. "1,000:1,000 (Strata Elite/Premier/Prestige) or 1,000:700 (other Citi ThankYou cards)" — use the exact numbers from that section, do not assume they match this example. Ignore any "Limited Time Offer"/bonus/promo language in a section — that belongs to a separate source, not this one.',
  }
];
