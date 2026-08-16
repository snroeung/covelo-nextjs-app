import type { PortalId } from "@/lib/points/types";
import type { RecordType } from "./schemas";
import type { SectionSpec } from "./fetch";

export interface SourceConfig {
  key: string;
  // Omit for sources whose records aren't scoped to one issuer (e.g.
  // points_valuation, which spans every program on one TPG page) — setting
  // it forces every extracted record's portal/issuer field to that one
  // value, which would be actively wrong for a multi-program page.
  portalId?: PortalId;
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
  // Flat repeated-item lists (e.g. a partner grid) where every item shares
  // one utility class already present in the DOM — see fetchRenderedItems.
  itemSelector?: string;
  // Extra guidance appended to the extraction prompt for this source only —
  // for pages whose structure/semantics the generic per-recordType prompt
  // can't infer (e.g. how to read a tabbed layout, or that no pricing is
  // shown so price fields must be left out rather than guessed).
  extraInstructions?: string;
}

// Appended verbatim to every travel_collection/spending_bonus source's
// extraInstructions — no source is assumed evergreen, the LLM judges
// limited-time framing from actual page text every run.
const LIMITED_TIME_INSTRUCTION =
  'Set `limited_time_offer` to true if the page\'s language for that record is limited-time framed ("limited time", "ends soon", "for a limited time", a specific expiring window, a seasonal/promo framing); false if it reads as a standing, ongoing program or benefit with no expiry framing.';

// Bilt Rent Day transfers happen on Rent Day itself — the 1st of whatever
// month is promoted — not across the whole month. Default an unstated
// transfer date to that single day so upsert doesn't get a null/invalid
// end_date, but let an explicit date in the page text override it.
const BILT_RENT_DAY_SINGLE_DAY_INSTRUCTION =
  'Unless the page states an explicit transfer date for an offer, assume start_date and end_date both fall on the 1st of the calendar month named on the page (e.g. "August Rent Day" → both YYYY-MM-DD dates are August 1st, using the nearest FUTURE occurrence of that month relative to today). If the page names no month at all, use the current calendar month.';

// Rent Day spending/rent-payment bonuses (unlike the transfer bonus above)
// run for the whole calendar month the article covers, without always
// restating explicit start/end dates per offer — default to that whole
// month so upsert doesn't get a null/invalid end_date, but let an explicit
// date in the page text override it.
const BILT_RENT_DAY_WHOLE_MONTH_INSTRUCTION =
  'Unless the page states explicit start/end dates for an offer, assume that offer runs the entire calendar month named on the page (e.g. "August Rent Day" → start_date is the 1st and end_date is the last day of that month, in YYYY-MM-DD form, using the nearest FUTURE occurrence of that month relative to today). If the page names no month at all, use the current calendar month.';

// robots.txt checked 2026-07-19 — see plan section "robots.txt check" for the
// per-domain results. Sources marked isTpgFallback replace a direct scrape
// that was disallowed, unconfirmed, or blocked at the network layer.
export const SOURCES: SourceConfig[] = [
  {
    key: "chase_points_boost",
    portalId: "chase",
    url: "https://www.chase.com/travel/guide/travel-benefits/points-boost-offers",
    recordType: "travel_collection",
    needsBrowser: true,
    isTpgFallback: false,
    extraInstructions:
      `Page lists both hotel and flight Points Boost entries — hotel entries reference a property name, flight entries reference an airline + route/cabin. Set type accordingly; fill property_name only for hotel rows, airline_name/airline_iata_code/cabin_class only for flight rows; use the boosted vs. standard points shown for original_amount/discount_amount (unit "points") — omit both entirely if the page doesn't show a concrete number for that entry. ${LIMITED_TIME_INSTRUCTION}`,
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
    extraInstructions: LIMITED_TIME_INSTRUCTION,
  },
  // robots.txt checked 2026-07-20 — wildcard group only disallows
  // /us/rwd/, /*/apply/, business/tls/partnerships, /*/logout. AhrefsBot
  // group disallows /*/travel/the-hotel-collection/ but that rule is scoped
  // to AhrefsBot, not our user-agent. All three paths below are allowed.
  {
    key: "amex_hotel_collection_featured",
    portalId: "amex",
    url: "https://www.americanexpress.com/en-us/travel/offers/hotels/the-hotel-collection-offers/featured",
    recordType: "travel_collection",
    needsBrowser: true,
    isTpgFallback: false,
    extraInstructions:
      `Page is a carousel of individually hyperlinked hotel names (e.g. "JW Marriott Los Cabos Beach Resort & Spa", "Hotel El Convento", "Lyle Washington DC") — each linked name is a distinct property. Emit one record per property found: collection_name is always "The Hotel Collection", property_name is that property's exact linked name, perk_summary is the shared program-level benefit copy found elsewhere on the page (a $100 credit towards eligible charges, 4pm late check-out when available, room upgrade upon arrival when available) since it applies to every property on this page, not per-property. The page does not show a per-property points or dollar price — do not invent one; omit original_amount, original_unit, discount_amount, and discount_unit entirely rather than guessing. Every record from this page has type "hotel". ${LIMITED_TIME_INSTRUCTION}`,
  },
  {
    key: "amex_hotel_collection_us",
    portalId: "amex",
    url: "https://www.americanexpress.com/en-us/travel/offers/hotels/the-hotel-collection-offers/us",
    recordType: "travel_collection",
    needsBrowser: true,
    isTpgFallback: false,
    extraInstructions:
      `Page is a carousel of individually hyperlinked hotel names (e.g. "JW Marriott Los Cabos Beach Resort & Spa", "Hotel El Convento", "Lyle Washington DC") — each linked name is a distinct property. Emit one record per property found: collection_name is always "The Hotel Collection", property_name is that property's exact linked name, perk_summary is the shared program-level benefit copy found elsewhere on the page (a $100 credit towards eligible charges, 4pm late check-out when available, room upgrade upon arrival when available) since it applies to every property on this page, not per-property. The page does not show a per-property points or dollar price — do not invent one; omit original_amount, original_unit, discount_amount, and discount_unit entirely rather than guessing. Every record from this page has type "hotel". ${LIMITED_TIME_INSTRUCTION}`,
  },
  {
    key: "amex_hotel_collection_international",
    portalId: "amex",
    url: "https://www.americanexpress.com/en-us/travel/offers/hotels/the-hotel-collection-offers/international",
    recordType: "travel_collection",
    needsBrowser: true,
    isTpgFallback: false,
    extraInstructions:
      `Page is a carousel of individually hyperlinked hotel names — each linked name is a distinct property. Emit one record per property found: collection_name is always "The Hotel Collection", property_name is that property's exact linked name, perk_summary is the shared program-level benefit copy found elsewhere on the page (a $100 credit towards eligible charges, 4pm late check-out when available, room upgrade upon arrival when available) since it applies to every property on this page, not per-property. The page does not show a per-property points or dollar price — do not invent one; omit original_amount, original_unit, discount_amount, and discount_unit entirely rather than guessing. Every record from this page has type "hotel". ${LIMITED_TIME_INSTRUCTION}`,
  },
  // robots.txt checked 2026-07-21 — global.americanexpress.com has no
  // robots.txt (404), fails open per isAllowed(). Confirmed 2026-08-11: page
  // is client-rendered (static fetch returns ~124 chars of nav chrome, no
  // partner data) — needs a browser. Each partner card is a
  // ".flex.flex-justify-between.flex-align-center" element; see
  // fetchRenderedItems in fetch.ts.
  {
    key: "amex_membership_rewards_transfer",
    portalId: "amex",
    url: "https://global.americanexpress.com/rewards/transfer",
    recordType: "transfer_partner",
    needsBrowser: true,
    isTpgFallback: false,
    itemSelector: ".flex.flex-justify-between.flex-align-center",
    extraInstructions:
      'Each line is one partner card with its text run together with no separators, e.g. "Aer Lingus AerClub1,000 Points =1,000 AviosShow Details" or "Cathay Pacific1,000 Points =800 Asia MilesTMShow Details". Strip the trailing "Show Details" boilerplate from every line. The partner name (program) is everything before the ratio, which always starts at the digit run before "Points =" (e.g. program "Aer Lingus AerClub", ratio "1,000 Points = 1,000 Avios"; program "Cathay Pacific", ratio "1,000 Points = 800 Asia Miles"). portal_id is always "amex". Set type to "airline" for frequent-flyer programs and "hotel" for hotel loyalty programs, based on the program name.',
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
    extraInstructions:
      `Page has a "Company | Amex Offer | Expiration Date" table, one row per merchant offer. merchant_name is the Company column. end_date is the Expiration Date column in YYYY-MM-DD form. The Amex Offer column follows one of three patterns: "Spend $X or more, earn $Y back" → bonus_type "dollar_amount", bonus_multiplier Y, spending_minimum X; "Earn N% back on purchases, up to a total of $Y" → bonus_type "cash_back_pct", bonus_multiplier N, note the $Y cap in description (the schema has no separate cap field); "Spend $X or more, earn N Membership Rewards points" (a flat point bonus at that spend level, not a per-dollar rate) → bonus_type "points_multiplier", bonus_multiplier N, spending_minimum X, and say in description this is a flat bonus rather than a per-dollar earn rate. When an offer repeats ("up to 3 times for a total of $300"), use the per-occurrence amount ($100) as bonus_multiplier, not the multi-use total — note the repeat cap in description. ${LIMITED_TIME_INSTRUCTION}`,
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
    recordType: "travel_collection",
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
      `Page text is split into "== <tab label> ==" sections, one per Lifestyle Collection theme tab. Each section lists properties as "Property Name | City, Region". For every property found in every section: issuer is "c1", collection_name is "Capital One Lifestyle Collection — <tab label>" using that section's tab label, property_name is the property name (drop the "| City, Region" part), perk_summary is the general Lifestyle Collection benefit copy found elsewhere in the page text (e.g. room upgrade when available, free Wi-Fi, 4th night free) since it applies page-wide, not per property. The page does not list a points or dollar price for any property — do not invent one; omit original_amount, original_unit, discount_amount, and discount_unit entirely rather than guessing. Every record from this page has type "hotel". ${LIMITED_TIME_INSTRUCTION}`,
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
    extraInstructions:
      `Rows show a dual reward like "2% cash-back or 2x miles" — Capital One lets the cardholder choose either. Emit one record per merchant using the cash-back branch: bonus_type "cash_back_pct", bonus_multiplier the percent number (e.g. 2 for "2% cash-back"). For rows with a flat-dollar cash-back option (e.g. "$2 cash-back or 200 miles") use bonus_type "dollar_amount" with that dollar number instead. This page states outright that Capital One Offers have no published expiration date — omit end_date entirely rather than inventing one. ${LIMITED_TIME_INSTRUCTION}`,
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
    extraInstructions: LIMITED_TIME_INSTRUCTION,
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
  },
  // robots.txt checked 2026-07-30 — thepointsguy.com wildcard group only
  // disallows /wp-admin/, /wp-json/, search/tag/author archives — /news/
  // articles are allowed. Bilt doesn't publish Rent Day terms on its own
  // site in scrapable form, so TPG's recap article is the primary source
  // (isTpgFallback: true), same pattern as bilt_transfer_partners above.
  // Rent Day is Bilt-specific and excluded from tpg_current_transfer_bonuses
  // below by name — this source covers it instead.
  {
    key: "bilt_rent_day_transfer_bonus",
    portalId: "bilt",
    url: "https://thepointsguy.com/news/bilt-rent-day-promo/",
    recordType: "transfer_bonus",
    needsBrowser: true,
    isTpgFallback: true,
    extraInstructions:
      `issuer is always "bilt". transfer_partner is the destination loyalty program named for that Rent Day transfer bonus (e.g. "World of Hyatt", "United MileagePlus", "Accor Live Limitless"). bonus_pct is the stated transfer bonus percentage when one exists. Some promos are pure status-match tiers with NO percentage bonus at all — instead the page lists a table/list like "[Bilt tier] status with Bilt: Match to [Program] [Tier] status if you transfer at least N Bilt points to [Program] on [date]" under a heading such as "[Program] status match when you transfer points". For each such tier, emit a separate row: transfer_partner is the Program, leave bonus_pct unset, set min_transfer_points to N, set for_status_transfer to true, and set description to which Bilt status tier is required and which partner status it unlocks (e.g. "Blue or Silver Bilt status unlocks Accor Silver status"). end_date is the stated transfer date (e.g. "Aug. 1" of the current promo period). Some Rent Day promos additionally let a percentage-bonus transfer ALSO count toward the destination program's elite/award status (e.g. qualifying nights/segments, tier credit) — when the page says this explicitly for a bonus_pct row, set for_status_transfer to true and mention the status benefit in description; otherwise set for_status_transfer to false. The page may phrase either case as "Match to [tier] status" or "Match to [Program] status" — treat that wording as a for_status_transfer: true signal. Do NOT scrape anything from a "History of Rent Day promotions" section (or similarly named past/archive section) — only extract the current/upcoming promo(s). ${BILT_RENT_DAY_SINGLE_DAY_INSTRUCTION} If neither a bonus_pct nor a min_transfer_points threshold can be determined for a row, skip that row rather than guessing. ${LIMITED_TIME_INSTRUCTION}`,
  },
  {
    key: "bilt_rent_day_spending_bonus",
    portalId: "bilt",
    url: "https://thepointsguy.com/news/bilt-rent-day-promo/",
    recordType: "spending_bonus",
    needsBrowser: true,
    isTpgFallback: true,
    extraInstructions:
      `issuer is always "bilt". Only emit a record here for a spending/rent-payment bonus (e.g. bonus points per dollar of rent paid, or a bonus for paying rent on Rent Day) — do NOT duplicate pure transfer-bonus rows, those belong to bilt_rent_day_transfer_bonus. merchant_name is "Rent Payment" unless the page names a more specific merchant/category. The page may phrase a status-tie-in as "Match to [tier] status" — that's a transfer_bonus concern, not a spending_bonus, so ignore that wording here. Do NOT scrape anything from a "History of Rent Day promotions" section (or similarly named past/archive section) — only extract the current/upcoming promo(s). ${BILT_RENT_DAY_WHOLE_MONTH_INSTRUCTION} ${LIMITED_TIME_INSTRUCTION}`,
  },
  {
    key: "tpg_current_transfer_bonuses",
    portalId: "chase", // placeholder; transfer_bonus records key off issuer, set per-row below
    url: "https://thepointsguy.com/loyalty-programs/current-transfer-bonuses/",
    recordType: "transfer_bonus",
    needsBrowser: true,
    isTpgFallback: false,
    extraInstructions:
      'This page lists live transfer bonuses across multiple issuers (Chase, Amex, Capital One, Citi — ignore Bilt if present, we source Bilt separately). Each entry states which issuer program the bonus transfers FROM (e.g. "Chase Ultimate Rewards", "Amex Membership Rewards", "Citi ThankYou Points", "Capital One Miles") — map that to issuer: "Chase Ultimate Rewards"→chase, "Amex Membership Rewards"→amex, "Citi ThankYou"→citi, "Capital One"→c1. Skip any row whose source program is not one of these four, or whose source program is Bilt. transfer_partner is the destination loyalty program name (e.g. "World of Hyatt", "Flying Blue"). bonus_pct is the stated bonus percentage. The page usually omits start_date — omit it (do not guess). end_date is REQUIRED by the schema — the page often states only a month/day (e.g. "Ends 8/31") with no year; infer the year as the nearest FUTURE occurrence of that month/day relative to today, in YYYY-MM-DD form. If a row states a bonus but you cannot resolve a plausible end_date, SKIP that row entirely rather than guessing — one invalid record drops the entire extracted batch (schema requires end_date non-empty). If a bonus is described as tiered (e.g. different pct at different transfer amounts), use the highest tier\'s pct and note the tiering in description. Set limited_time_offer to true on every emitted record — everything on this page is by definition limited-time.',
  },
  {
    key: "tpg_monthly_valuations",
    // no portalId — this page covers every program across all issuers, not
    // one issuer's own data
    url: "https://thepointsguy.com/loyalty-programs/monthly-valuations/",
    recordType: "points_valuation",
    needsBrowser: true,
    isTpgFallback: false,
    extraInstructions:
      'The valuations are a table, flattened in the page text to one "cell | cell" line per row. The header row is "Program | <Month> <Year> valuation (cents)" — read the month and year directly from that header text (e.g. "August 2026") and use it verbatim as source_month on every emitted record; do not use today\'s date or guess a month. Every row below the header is "<Program Name> | <value>": program is the program name exactly as listed (e.g. "Chase Ultimate Rewards", "World of Hyatt", "United MileagePlus") — do not abbreviate or rename it. The header already states the value is in cents, so cpp is that number as-is (e.g. a row of "World of Hyatt | 1.7" → cpp: 1.7, not 0.017 and not 170). If a row states a range instead of a single value, use the midpoint. Skip any row with no numeric value.',
  }
];
