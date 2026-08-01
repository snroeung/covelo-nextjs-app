// One-off backfill for transfer_bonuses/spending_bonuses rows inserted before
// card_ids existed. Default dry-run — prints matches, writes nothing. Pass
// --apply to write. Never touches status/active.
//
// Usage:
//   npx tsx scripts/portal-sync/_backfill-card-ids.ts            # dry-run
//   npx tsx scripts/portal-sync/_backfill-card-ids.ts --apply    # writes

import "dotenv/config";
import Anthropic from "@anthropic-ai/sdk";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { ISSUER_CARDS, CARD_NAMES, type CardId, type PortalId } from "@/lib/points/types";

const APPLY = process.argv.includes("--apply");
const MODEL = "claude-sonnet-5";

let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!client) client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return client;
}

type TableName = "transfer_bonuses" | "spending_bonuses";

interface Row {
  id: string;
  issuer: string;
  description: string;
}

function validCardIds(issuer: string, cardIds: string[]): string[] {
  const allowed = ISSUER_CARDS[issuer as PortalId] ?? [];
  return cardIds.filter((id) => allowed.includes(id as CardId));
}

async function matchCardIds(issuer: string, description: string): Promise<string[]> {
  const cards = ISSUER_CARDS[issuer as PortalId];
  if (!cards || cards.length === 0) return [];
  const cardList = cards.map((id) => `${id} (${CARD_NAMES[id]})`).join(", ");

  const response = await getClient().messages.create({
    model: MODEL,
    max_tokens: 256,
    tools: [
      {
        name: "emit_card_ids",
        description: "Emit the card ids this offer is restricted to, if any.",
        input_schema: {
          type: "object",
          properties: {
            card_ids: { type: "array", items: { type: "string" } },
          },
          required: ["card_ids"],
        },
      },
    ],
    tool_choice: { type: "tool", name: "emit_card_ids" },
    messages: [
      {
        role: "user",
        content: `Cards available under issuer "${issuer}": ${cardList}. Does the offer text below require one specific card from that list to be eligible (not just any card from the issuer)? If so, return matching card id(s) in "card_ids". If it applies to all cards from this issuer, or isn't card-specific, return an empty array.\n\nOffer text:\n${description}`,
      },
    ],
  });

  const toolUse = response.content.find((block) => block.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") return [];
  const raw = toolUse.input as { card_ids?: unknown };
  const ids = Array.isArray(raw.card_ids) ? raw.card_ids.filter((id): id is string => typeof id === "string") : [];
  return validCardIds(issuer, ids);
}

async function backfillTable(table: TableName): Promise<void> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from(table)
    .select("id, issuer, description")
    .eq("card_ids", "{}")
    .not("description", "is", null);

  if (error) {
    console.error(`[${table}] query failed: ${error.message}`);
    return;
  }

  const rows = (data ?? []) as Row[];
  console.log(`[${table}] ${rows.length} row(s) with empty card_ids and a description`);

  for (const row of rows) {
    const cardIds = await matchCardIds(row.issuer, row.description);
    if (cardIds.length === 0) continue;

    console.log(`[${table}] ${row.id} (${row.issuer}) -> ${cardIds.join(", ")}`);
    console.log(`  description: ${row.description}`);

    if (APPLY) {
      const { error: updateError } = await supabase.from(table).update({ card_ids: cardIds }).eq("id", row.id);
      if (updateError) console.error(`  write failed: ${updateError.message}`);
      else console.log(`  written`);
    }
  }
}

async function main(): Promise<void> {
  console.log(APPLY ? "APPLY mode — rows will be written" : "DRY RUN — no writes (pass --apply to write)");
  await backfillTable("transfer_bonuses");
  await backfillTable("spending_bonuses");
  console.log("done");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
