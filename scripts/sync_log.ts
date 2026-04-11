/**
 * 記録係: Gemini API で git diff を要約し PROJECT_LOG.md に追記し、
 * llms.txt 用のツール節ドラフトを別ファイルに出力する。
 *
 * 使い方:
 *   GEMINI_API_KEY=... npm run sync-log
 *   npm run sync-log -- --diff=working
 *   npm run sync-log -- --dry-run
 *
 * --diff: last-commit | working | staged（デフォルト last-commit）
 * --dry-run: ファイルへ書き込まず標準出力のみ
 *
 * llms.txt は自動では上書きしない（`public/llms-tools.sync-draft.md` を手動マージ）。
 */
import "dotenv/config";
import { execSync } from "node:child_process";
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { z } from "zod";

const ROOT = join(__dirname, "..");
const PROJECT_LOG = join(ROOT, "PROJECT_LOG.md");
const LLMS_DRAFT = join(ROOT, "public", "llms-tools.sync-draft.md");
const MAX_DIFF_CHARS = 120_000;

const SyncResponseSchema = z.object({
  project_log_section: z.string().min(1),
  llms_tools_section: z.string().min(1),
});

function parseArgs(): { diffMode: "last-commit" | "working" | "staged"; dryRun: boolean } {
  const argv = process.argv.slice(2);
  let diffMode: "last-commit" | "working" | "staged" = "last-commit";
  let dryRun = false;
  for (const a of argv) {
    if (a === "--dry-run") dryRun = true;
    if (a.startsWith("--diff=")) {
      const v = a.slice("--diff=".length);
      if (v === "working" || v === "staged" || v === "last-commit") {
        diffMode = v;
      }
    }
  }
  return { diffMode, dryRun };
}

function getGitDiff(mode: "last-commit" | "working" | "staged"): string {
  const opt = { encoding: "utf-8" as const, maxBuffer: 20 * 1024 * 1024, cwd: ROOT };
  try {
    if (mode === "staged") return execSync("git diff --cached", opt);
    if (mode === "working") return execSync("git diff", opt);
    let out = execSync("git diff HEAD~1 HEAD", opt);
    if (!out.trim()) out = execSync("git show --stat HEAD", opt);
    return out;
  } catch {
    return "";
  }
}

function truncateDiff(text: string): string {
  if (text.length <= MAX_DIFF_CHARS) return text;
  return (
    text.slice(0, MAX_DIFF_CHARS) +
    `\n\n[... truncated: ${text.length - MAX_DIFF_CHARS} chars omitted ...]\n`
  );
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function extractJsonObject(raw: string): unknown {
  const t = raw.trim();
  const fence = /^```(?:json)?\s*([\s\S]*?)```$/m.exec(t);
  const body = fence ? fence[1]!.trim() : t;
  return JSON.parse(body);
}

async function main(): Promise<void> {
  const apiKey = process.env["GEMINI_API_KEY"] ?? "";
  // 新規APIキーでは gemini-2.0-flash が 404 になる場合あり。未設定時は 2.5 Flash を既定に。
  const modelName = process.env["GEMINI_MODEL"] ?? "gemini-2.5-flash";

  if (!apiKey) {
    console.error(
      "[sync-log] GEMINI_API_KEY が未設定です。.env に追加するか環境変数で渡してください。",
    );
    process.exit(1);
  }

  const { diffMode, dryRun } = parseArgs();
  const diffRaw = getGitDiff(diffMode);
  if (!diffRaw.trim()) {
    console.error("[sync-log] git diff が空です。コミットするか --diff=working を試してください。");
    process.exit(1);
  }
  const diff = truncateDiff(diffRaw);

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: modelName,
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0.2,
    },
  });

  const prompt = `You are an engineering secretary for a TypeScript MCP server project (furniture / storage product hub for AI agents).

## Input: git diff
The following is a git diff (${diffMode}). Summarize it for maintainers.

## Security / privacy rules (mandatory)
- Do NOT quote or reproduce API keys, secrets, tokens, passwords, or full affiliate IDs from the diff.
- Do NOT include personal names, email addresses, phone numbers, or street addresses if they appear in the diff.
- If the diff touches .env, only say "environment configuration changed" without values.

## Output format (JSON only)
Return a single JSON object with exactly two string fields:

1. "project_log_section": Markdown body (Japanese) to append under a dated heading. Use ### for subheadings.
   Include: 概要、主要な変更ファイル、新規/変更ツール、運用上の注意（あれば）。
   Keep it concise (roughly 400–900 Japanese characters unless the diff is huge).

2. "llms_tools_section": Markdown in **English** suitable for replacing the "## Available Tools" section of public/llms.txt.
   List each MCP tool name as ### heading with one short paragraph. Match the actual tools implied by the diff; if unsure, list tools found in lib/register_tools.ts patterns from the diff.
   Do not include YAML front matter. Start directly with tool subsections.

## Git diff
${diff}
`;

  const result = await model.generateContent(prompt);
  const text = result.response.text();
  let parsed: z.infer<typeof SyncResponseSchema>;
  try {
    parsed = SyncResponseSchema.parse(extractJsonObject(text));
  } catch (e) {
    console.error("[sync-log] Gemini の JSON が不正です:", e);
    console.error("Raw:", text.slice(0, 2000));
    process.exit(1);
  }

  const logBlock =
    `\n\n---\n\n## ${todayIso()}: 変更サマリ（sync-log / Gemini・${diffMode}）\n\n` +
    parsed.project_log_section.trim() +
    "\n";

  const draftHeader =
    `<!-- auto-generated by scripts/sync_log.ts — merge into public/llms.txt "## Available Tools" if OK -->\n` +
    `<!-- generated: ${new Date().toISOString()} diff=${diffMode} -->\n\n`;

  if (dryRun) {
    console.log("=== PROJECT_LOG append preview ===");
    console.log(logBlock);
    console.log("=== llms-tools draft preview ===");
    console.log(parsed.llms_tools_section);
    return;
  }

  appendFileSync(PROJECT_LOG, logBlock, "utf-8");
  mkdirSync(dirname(LLMS_DRAFT), { recursive: true });
  writeFileSync(LLMS_DRAFT, draftHeader + parsed.llms_tools_section.trim() + "\n", "utf-8");

  console.log(`[sync-log] PROJECT_LOG.md に追記しました (${PROJECT_LOG})`);
  console.log(`[sync-log] llms ドラフト: ${LLMS_DRAFT}（内容を確認して llms.txt に手動マージ）`);
}

main().catch((e) => {
  console.error("[sync-log] 失敗:", e);
  process.exit(1);
});
