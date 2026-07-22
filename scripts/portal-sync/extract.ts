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
  hotel_collection: "hotel collection / prestige property program",
};

export interface ExtractResult<T> {
  records: T[];
  notes: string | null;
  tokensUsed: number;
}

export async function extractRecords<T extends RecordType>(
  recordType: T,
  pageText: string,
  sourceUrl: string,
  extraInstructions?: string,
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
    extraInstructions ? `Source-specific instructions: ${extraInstructions}` : null,
    `Page text:\n${pageText.slice(0, MAX_PAGE_TEXT_CHARS)}`,
  ].filter((part): part is string => part !== null);

  const response = await getClient().messages.create({
    model: MODEL,
    max_tokens: 4096,
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

  const tokensUsed = response.usage.input_tokens + response.usage.output_tokens;
  const toolUse = response.content.find((block) => block.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    return { records: [], notes: null, tokensUsed };
  }

  const raw = toolUse.input as { records?: unknown[]; notes?: string | null };
  const parsed = z.array(schema).safeParse(raw.records ?? []);

  return {
    records: parsed.success ? parsed.data : [],
    notes: raw.notes ?? null,
    tokensUsed,
  };
}
