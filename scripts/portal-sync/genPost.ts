// Auto-generated board post copy for scraped offers. Ported from bdGenPost
// in the design prototype.
//
// Cron-only: upsert.ts writes the result into board_post_title /
// board_post_body on every scraped transfer/spending bonus, so the admin
// review queue has post copy ready. After that the stored text is the text —
// the admin offer editor shows and saves it as-is, and offers created by hand
// start with empty post fields.

import { type BoardOfferView } from "@/lib/board/offerView";

export type { BoardOfferView };

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

/** Columns the cron writes onto a scraped catalog row. */
export interface BoardPostColumns {
  board_post_title: string;
  board_post_body: string;
}

export function boardPostColumns(offer: BoardOfferView): BoardPostColumns {
  const { title, body } = genBoardPost(offer);
  return { board_post_title: title, board_post_body: body };
}
