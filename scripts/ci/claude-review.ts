// Reviews each commit sha passed as an argument, writes markdown to the job summary and
// posts one PR comment per commit (skipping commits that already have one).
// Then it re-reads the PR's earlier Claude-review comments and asks whether the issues
// they raised are still present at HEAD; any that are unresolved get appended as a
// "Still pending" section on the newest comment (or posted on their own when there is
// no new commit to review this run).
// Auth: the Anthropic SDK resolves workload identity federation from ANTHROPIC_* env vars.
import Anthropic from "@anthropic-ai/sdk";
import { execFileSync } from "node:child_process";
import { appendFileSync } from "node:fs";

const MODEL = "claude-sonnet-5-5";
const MAX_DIFF_CHARS = 120_000;

const REVIEW_MARKER = "<!-- claude-review:";
const PENDING_MARKER_PREFIX = "<!-- claude-review-pending:";
const RESOLVED_SENTINEL = "All earlier issues resolved.";

const SYSTEM = `You review a single git commit for a Next.js + tRPC + Supabase app (Covelo).
Report only real problems: correctness bugs, security issues (secrets, client-side service keys, missing RLS), missing feature flags or cache config, broken light/dark contrast, missing tests for changed lib/server/hooks code.
Format: a short bullet list, each with file:line and a one-line fix. If nothing is wrong, reply exactly "No issues found." Do not praise or summarize the diff.`;

const RESOLUTION_SYSTEM = `You check whether issues raised in earlier automated reviews of a pull request are still unresolved in the current code.
You are given the earlier review findings and the current cumulative diff of the PR (its base..head). For each earlier issue decide whether it is STILL present in the current code; treat it as resolved if the diff shows it fixed or the relevant code changed to address it.
Output only the issues that are still UNRESOLVED, as a short bullet list, each with file:line and a one-line description. Ignore lines that said "No issues found." Do not repeat resolved issues, do not restate the diff, do not add commentary. If every earlier issue is resolved, reply exactly "${RESOLVED_SENTINEL}"`;

const git = (...args: string[]) =>
  execFileSync("git", args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });

const gh = (args: string[], input?: string) =>
  execFileSync("gh", args, { encoding: "utf8", input, maxBuffer: 64 * 1024 * 1024 });

const textOf = (res: Anthropic.Message) =>
  res.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("\n").trim();

/** One JSON object per line (gojq `@json`), robust to multi-line bodies and pagination. */
function fetchCommentBodies(repo: string, pr: string): string[] {
  const raw = gh(["api", "--paginate", `repos/${repo}/issues/${pr}/comments`, "--jq", ".[] | @json"]);
  return raw
    .split("\n")
    .filter(Boolean)
    .map((line) => (JSON.parse(line) as { body?: string }).body ?? "");
}

/** Asks the model which earlier findings are still present at HEAD; null if none/no priors. */
async function pendingFromPriorReviews(
  client: Anthropic,
  priorReviews: string[],
  diff: string,
): Promise<string | null> {
  if (priorReviews.length === 0 || !diff) return null;
  const prior = priorReviews
    .map((b) => b.replace(/<!--[\s\S]*?-->/g, "").trim())
    .filter(Boolean)
    .join("\n\n---\n\n");
  if (!prior) return null;

  const res = await client.messages.create({
    model: MODEL,
    max_tokens: 1500,
    system: RESOLUTION_SYSTEM,
    messages: [
      {
        role: "user",
        content: `Earlier review findings:\n\n${prior}\n\nCurrent cumulative PR diff (base..head):\n<diff>\n${diff}\n</diff>`,
      },
    ],
  });
  const text = textOf(res);
  if (!text || new RegExp(`^${RESOLVED_SENTINEL.replace(".", "\\.?")}$`, "i").test(text)) return null;
  return text;
}

async function main() {
  const shas = process.argv.slice(2);
  const client = new Anthropic();
  const summary = process.env.GITHUB_STEP_SUMMARY;
  const pr = process.env.PR_NUMBER;
  const repo = process.env.GITHUB_REPOSITORY ?? "";

  const bodies = pr ? fetchCommentBodies(repo, pr) : [];
  const existing = bodies.join("\n");
  const priorReviews = bodies.filter((b) => b.includes(REVIEW_MARKER));

  // Cumulative PR diff for the resolution check (base..head), with sensible fallbacks.
  const headSha = process.env.HEAD_SHA || shas[shas.length - 1];
  const baseSha = process.env.BASE_SHA || (shas[0] ? `${shas[0]}^` : "");
  let prDiff = baseSha && headSha ? git("diff", baseSha, headSha) : "";
  if (prDiff.length > MAX_DIFF_CHARS) prDiff = prDiff.slice(0, MAX_DIFF_CHARS);

  const pending = await pendingFromPriorReviews(client, priorReviews, prDiff);
  const pendingSection = pending
    ? `\n\n### ⚠️ Still pending from earlier reviews\n\n${pending}\n`
    : "";

  const toReview = shas.filter((sha) => !existing.includes(`${REVIEW_MARKER}${sha} -->`));
  let out = "";

  for (let i = 0; i < toReview.length; i++) {
    const sha = toReview[i];
    const isLast = i === toReview.length - 1;
    const subject = git("log", "-1", "--format=%h %s", sha).trim();
    let diff = git("show", "--format=", "--patch", sha);
    const truncated = diff.length > MAX_DIFF_CHARS;
    if (truncated) diff = diff.slice(0, MAX_DIFF_CHARS);

    const res = await client.messages.create({
      model: MODEL,
      max_tokens: 2000,
      system: SYSTEM,
      messages: [
        {
          role: "user",
          content: `Commit: ${subject}\n\n<diff>\n${diff}\n</diff>${truncated ? "\n\n(diff truncated)" : ""}`,
        },
      ],
    });
    const text = textOf(res);
    // The pending section rides on the newest comment so it reflects the HEAD state.
    const extra = isLast ? pendingSection : "";
    out += `## ${subject}\n\n${text}${extra}\n\n`;
    if (pr) {
      gh(
        ["pr", "comment", pr, "--body-file", "-"],
        `${REVIEW_MARKER}${sha} -->\n### Claude review — \`${subject}\`\n\n${text}${extra}\n`,
      );
    }
  }

  // No new commit this run (e.g. a re-run), but earlier issues remain unresolved —
  // post the pending section on its own, deduped by HEAD sha so re-runs don't repeat it.
  if (pending && toReview.length === 0 && pr && headSha) {
    const pendingMarker = `${PENDING_MARKER_PREFIX}${headSha} -->`;
    if (!existing.includes(pendingMarker)) {
      gh(["pr", "comment", pr, "--body-file", "-"], `${pendingMarker}\n${pendingSection.trim()}\n`);
      out += `${pendingSection.trim()}\n\n`;
    }
  }

  if (!out) out = "No new commits to review.\n";
  console.log(out);
  if (summary) appendFileSync(summary, out);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
