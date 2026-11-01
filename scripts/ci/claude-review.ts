// Reviews each commit sha passed as an argument, writes markdown to the job summary and
// posts one PR comment per commit (skipping commits that already have one).
// Auth: the Anthropic SDK resolves workload identity federation from ANTHROPIC_* env vars.
import Anthropic from "@anthropic-ai/sdk";
import { execFileSync } from "node:child_process";
import { appendFileSync } from "node:fs";

const MODEL = "claude-sonnet-5-5";
const MAX_DIFF_CHARS = 120_000;

const SYSTEM = `You review a single git commit for a Next.js + tRPC + Supabase app (Covelo).
Report only real problems: correctness bugs, security issues (secrets, client-side service keys, missing RLS), missing feature flags or cache config, broken light/dark contrast, missing tests for changed lib/server/hooks code.
Format: a short bullet list, each with file:line and a one-line fix. If nothing is wrong, reply exactly "No issues found." Do not praise or summarize the diff.`;

const git = (...args: string[]) =>
  execFileSync("git", args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });

const gh = (args: string[], input?: string) =>
  execFileSync("gh", args, { encoding: "utf8", input, maxBuffer: 64 * 1024 * 1024 });

async function main() {
  const shas = process.argv.slice(2);
  const client = new Anthropic();
  const summary = process.env.GITHUB_STEP_SUMMARY;
  const pr = process.env.PR_NUMBER;
  const existing = pr
    ? gh(["api", "--paginate", `repos/${process.env.GITHUB_REPOSITORY}/issues/${pr}/comments`, "--jq", ".[].body"])
    : "";
  let out = "";

  for (const sha of shas) {
    const marker = `<!-- claude-review:${sha} -->`;
    if (existing.includes(marker)) continue;
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
    const text = res.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("\n");
    out += `## ${subject}\n\n${text}\n\n`;
    if (pr) gh(["pr", "comment", pr, "--body-file", "-"], `${marker}\n### Claude review — \`${subject}\`\n\n${text}\n`);
  }

  if (!out) out = "No new commits to review.\n";
  console.log(out);
  if (summary) appendFileSync(summary, out);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
