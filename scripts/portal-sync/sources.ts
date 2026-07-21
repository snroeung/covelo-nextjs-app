import type { PortalId } from "@/lib/points/types";
import type { RecordType } from "./schemas";

export interface SourceConfig {
  key: string;
  portalId: PortalId;
  url: string;
  recordType: RecordType;
  needsBrowser: boolean;
  isTpgFallback: boolean;
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
  // dead — url 404s, no working replacement found yet
  // {
  //   key: "amex_hotel_collection",
  //   portalId: "amex",
  //   url: "https://www.americanexpress.com/en-us/benefits/fine-hotels-resorts/",
  //   recordType: "hotel_collection",
  //   needsBrowser: true,
  //   isTpgFallback: false,
  // },
  // dead — url 404s, no working replacement found yet
  // {
  //   key: "amex_gold_transfer",
  //   portalId: "amex",
  //   url: "https://www.americanexpress.com/en-us/credit-cards/gold-card/",
  //   recordType: "transfer_partner",
  //   needsBrowser: true,
  //   isTpgFallback: false,
  // },
  // dead — tpg article 404s, no working replacement found yet
  // {
  //   key: "amex_offers_tpg_fallback",
  //   portalId: "amex",
  //   url: "https://thepointsguy.com/news/amex-offers-guide/",
  //   recordType: "spending_bonus",
  //   needsBrowser: false,
  //   isTpgFallback: true,
  // },
  // {
  //   key: "bilt_rewards_transfer",
  //   portalId: "bilt",
  //   url: "https://www.biltrewards.com/rewards",
  //   recordType: "transfer_partner",
  //   needsBrowser: true,
  //   isTpgFallback: false,
  // },
  {
    key: "c1_venture_transfer",
    portalId: "capital_one",
    url: "https://thepointsguy.com/loyalty-programs/capital-one-transfer-partners/",
    recordType: "transfer_partner",
    needsBrowser: true,
    isTpgFallback: false,
  },
  // {
  //   key: "c1_travel_portal",
  //   portalId: "capital_one",
  //   url: "https://capitalonetravel.com/",
  //   recordType: "spending_bonus",
  //   needsBrowser: true,
  //   isTpgFallback: false,
  // },
  // TODO: needs more research
  // {
  //   key: "citi_strata_premier_transfer",
  //   portalId: "citi",
  //   url: "https://www.citi.com/credit-cards/citi-strata-premier-credit-card",
  //   recordType: "transfer_partner",
  //   needsBrowser: true,
  //   isTpgFallback: false,
  // },
  // {
  //   key: "citi_thankyou_transfer",
  //   portalId: "citi",
  //   url: "https://www.thankyou.com/",
  //   recordType: "transfer_partner",
  //   needsBrowser: true,
  //   isTpgFallback: false,
  // },
];
