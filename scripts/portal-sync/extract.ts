import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { RECORD_SCHEMAS, type RecordType } from "./schemas";
import { FEW_SHOT_EXAMPLES } from "./few-shot-examples";

const MODEL = "claude-sonnet-5";
const MAX_PAGE_TEXT_CHARS = 20_000;

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!client) client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return client;
}

const RECORD_TYPE_LABEL: Record<RecordType, string> = {
  transfer_partner: "credit card point transfer partner",
  transfer_bonus: "limited-time transfer bonus promotion",
  spending_bonus: "spending or category bonus promotion",
  travel_collection: "hotel or flight collection / points boost program",
};

export interface ExtractResult<T> {
  records: T[];
  notes: string | null;
  tokensUsed: number;
}

// Field that carries the portal/issuer identifier differs by schema
// (transfer_partner uses "portal_id", every other record type uses "issuer").
const PORTAL_FIELD_NAME: Record<RecordType, string> = {
  transfer_partner: "portal_id",
  transfer_bonus: "issuer",
  spending_bonus: "issuer",
  travel_collection: "issuer",
};

export async function extractRecords<T extends RecordType>(
  recordType: T,
  pageText: string,
  sourceUrl: string,
  extraInstructions?: string,
  portalId?: string,
): Promise<ExtractResult<z.infer<(typeof RECORD_SCHEMAS)[T]>>> {
  const schema = RECORD_SCHEMAS[recordType];
  const examples = FEW_SHOT_EXAMPLES[recordType] ?? [];
  const label = RECORD_TYPE_LABEL[recordType];

  const promptParts = [
    examples.length > 0
      ? `Examples of correctly-extracted ${label} records:\n${JSON.stringify(examples, null, 2)}`
      : null,
    `Source URL: ${sourceUrl}`,
    `Extract every ${label} mentioned in the page text below. If the page is TPG (thepointsguy.com) prose rather than an issuer's own page, note that in "notes" and extract from context — TPG confidence is lower than a direct issuer statement. If none are found, return an empty records array.`,
    // The page's own wording for the card issuer (e.g. "Capital One") does
    // not match the schema's short enum value (e.g. "c1") — spell out the
    // exact value to use so validation doesn't silently reject every record.
    portalId
      ? `Set "${PORTAL_FIELD_NAME[recordType]}" to exactly "${portalId}" on every record from this source, regardless of how the issuer is named in the page text.`
      : null,
    extraInstructions ? `Source-specific instructions: ${extraInstructions}` : null,
    `Page text:\n${pageText.slice(0, MAX_PAGE_TEXT_CHARS)}`,
  ].filter((part): part is string => part !== null);

  const response = await getClient().messages.create({
    model: MODEL,
    // pages with 20-30+ records (upgradedpoints.com spending_bonus listings)
    // need more room than 4096 — a truncated tool call hits stop_reason
    // "max_tokens" mid-JSON and the SDK silently returns input: {}, which
    // looked identical to "the LLM found zero records" until traced.
    max_tokens: 16384,
    tools: [
      {
        name: "emit_records",
        description: `Emit every ${label} found in the page text.`,
        input_schema: {
          type: "object",
          properties: {
            records: { type: "array", items: {} },
            notes: { type: ["string", "null"] },
          },
          required: ["records"],
        },
      },
    ],
    tool_choice: { type: "tool", name: "emit_records" },
    messages: [{ role: "user", content: promptParts.join("\n\n") }],
  });

  if (response.stop_reason === "max_tokens") {
    console.warn(`[extract] ${sourceUrl} hit max_tokens — tool input JSON likely truncated, records may be lost`);
  }

  const tokensUsed = response.usage.input_tokens + response.usage.output_tokens;
  const toolUse = response.content.find((block) => block.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    return { records: [], notes: null, tokensUsed };
  }

  const raw = toolUse.input as { records?: unknown[]; notes?: string | null };
  const parsed = z.array(schema).safeParse(raw.records ?? []);

  if (process.env.DEBUG_EXTRACT) {
    console.error(`[extract debug] ${sourceUrl} raw count:`, raw.records?.length ?? 0);
    if (!parsed.success) {
      console.error(`[extract debug] zod issues:`, JSON.stringify(parsed.error.issues, null, 2));
    }
  }

  return {
    records: parsed.success ? parsed.data : [],
    notes: raw.notes ?? null,
    tokensUsed,
  };
}
