// Runs the moderation pipeline for one submission (plan §8.1): blocklist →
// links → lexicon → Claude classifier → decide(). Orchestration only; each
// stage is a pure module under lib/board/moderation.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Standing } from "@/lib/board/limits";
import { scanBlocklist, type BlockedTerm } from "@/lib/board/moderation/blocklist";
import { scanLinks, isReferralLink } from "@/lib/board/moderation/links";
import { lexiconScore } from "@/lib/board/moderation/lexicon";
import { classifyContent, type ClassifyInput, type ClassifierVerdict } from "@/lib/board/moderation/classify";
import { decideModeration, type ModerationDecision } from "@/lib/board/moderation/decide";
import { contentHash } from "./audit";

export interface ModerationInput {
  kind: "tip" | "offer" | "comment";
  title?: string;
  body?: string;
  /** Member-entered new-offer fields */
  offer?: Record<string, string | undefined>;
  chosenTopics?: string[];
  /** Brand-new topic names this submission would create */
  newTopics?: string[];
  availableTopics?: string[];
  standing: Standing;
  /** Posts only: check the title against the author's last 24 h */
  duplicateOf?: { userId: string; title: string; now: Date };
}

export interface ModerationOutcome {
  decision: ModerationDecision;
  verdict: ClassifierVerdict | null;
  model: string | null;
  /** sha256 of the submitted text — what rejected content is audited by */
  hash: string;
}

export async function loadBlockedTerms(admin: SupabaseClient): Promise<BlockedTerm[]> {
  const { data } = await admin.from("board_blocked_terms").select("term, tier");
  return ((data ?? []) as BlockedTerm[]).filter((t) => t.tier === "hard" || t.tier === "soft");
}

export async function moderateSubmission(
  admin: SupabaseClient,
  input: ModerationInput,
  deps: { terms?: BlockedTerm[]; classify?: typeof classifyContent } = {},
): Promise<ModerationOutcome> {
  const offerText = Object.values(input.offer ?? {}).filter((v): v is string => !!v);
  const topicText = input.newTopics ?? [];
  const text = [input.title, input.body, ...offerText, ...topicText].filter(Boolean).join("\n");
  const hash = contentHash(text);

  const [terms, duplicateSimilarity] = await Promise.all([
    deps.terms ? Promise.resolve(deps.terms) : loadBlockedTerms(admin),
    input.duplicateOf
      ? admin
          .rpc("board_max_title_similarity", {
            p_author: input.duplicateOf.userId,
            p_title: input.duplicateOf.title,
            p_since: new Date(input.duplicateOf.now.getTime() - 24 * 60 * 60 * 1000).toISOString(),
          })
          .then((r) => (typeof r.data === "number" ? r.data : 0))
      : Promise.resolve(0),
  ]);

  const blocklist = scanBlocklist(text, terms);
  const links = scanLinks(text);
  // The source link is a field, not prose — a referral URL there counts too
  const sourceUrl = input.offer?.url;
  if (sourceUrl && isReferralLink(sourceUrl) && !links.referral.includes(sourceUrl)) links.referral.push(sourceUrl);
  const lexicon = lexiconScore(text);

  // No point paying for a verdict on content that is rejected regardless
  const doomed = input.standing === "banned" || blocklist.tier === "hard" || links.referral.length > 0 || links.tooMany;
  let verdict: ClassifierVerdict | null = null;
  let model: string | null = null;
  if (!doomed) {
    const classifyInput: ClassifyInput = {
      kind: input.kind,
      title: input.title,
      body: input.body,
      offer: input.offer,
      chosenTopics: input.chosenTopics,
      newTopics: input.newTopics,
      availableTopics: input.availableTopics ?? [],
    };
    const result = await (deps.classify ?? classifyContent)(classifyInput);
    if (result.ok) {
      verdict = result.verdict;
      model = result.model;
    }
  }

  const decision = decideModeration({
    blocklist,
    links,
    lexicon,
    classifier: verdict,
    standing: input.standing,
    duplicateSimilarity,
    chosenTopics: input.chosenTopics,
  });
  return { decision, verdict, model, hash };
}

