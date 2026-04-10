#!/usr/bin/env ts-node
/**
 * 承認CLI: `npm run review` で起動
 *
 * 機能:
 *   1. proposals/pending/ の一覧を表示
 *   2. 各提案の詳細（需要件数・Zodスキーマ案・スクレイピングヒント）を表示
 *   3. 管理者が y/n で承認または却下
 *   4. 承認 → proposals/approved/ へ移動
 *      却下 → proposals/rejected/ へ移動（理由を記録）
 *   5. 承認済みの実装ガイドを表示
 */
import * as readline from "readline";
import { readdir, readFile, writeFile, rename, mkdir } from "fs/promises";
import { join } from "path";
import { Proposal } from "../schemas/proposal";
import { analyzeDemand } from "../utils/demand_analyzer";
import { generateProposals } from "../utils/proposal_generator";

const PENDING_DIR = "proposals/pending";
const APPROVED_DIR = "proposals/approved";
const REJECTED_DIR = "proposals/rejected";

// -----------------------------------------------------------------------
// readline ヘルパー
// -----------------------------------------------------------------------
function createRL(): readline.Interface {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
}

function question(rl: readline.Interface, prompt: string): Promise<string> {
  return new Promise((resolve) => rl.question(prompt, resolve));
}

// -----------------------------------------------------------------------
// ディレクトリ準備
// -----------------------------------------------------------------------
async function ensureDirs(): Promise<void> {
  await mkdir(PENDING_DIR, { recursive: true });
  await mkdir(APPROVED_DIR, { recursive: true });
  await mkdir(REJECTED_DIR, { recursive: true });
}

// -----------------------------------------------------------------------
// pending ファイル一覧取得
// -----------------------------------------------------------------------
async function loadPendingProposals(): Promise<Array<{ filename: string; proposal: Proposal }>> {
  const files = await readdir(PENDING_DIR).catch(() => [] as string[]);
  const jsonFiles = files.filter((f) => f.endsWith(".json"));

  const result: Array<{ filename: string; proposal: Proposal }> = [];
  for (const f of jsonFiles) {
    const content = await readFile(join(PENDING_DIR, f), "utf-8");
    const proposal = JSON.parse(content) as Proposal;
    result.push({ filename: f, proposal });
  }

  return result.sort((a, b) => b.proposal.demand_count - a.proposal.demand_count);
}

// -----------------------------------------------------------------------
// 提案の詳細表示
// -----------------------------------------------------------------------
function displayProposal(proposal: Proposal, index: number, total: number): void {
  const bar = "═".repeat(60);
  process.stdout.write(`\n${bar}\n`);
  process.stdout.write(`  提案 ${index + 1} / ${total}\n`);
  process.stdout.write(`${bar}\n`);
  process.stdout.write(`  📊 属性キー  : ${proposal.attribute_key}\n`);
  process.stdout.write(`  📝 説明      : ${proposal.description}\n`);
  process.stdout.write(`  🔥 需要件数  : ${proposal.demand_count}件（ログ記録より）\n`);
  process.stdout.write(`  📅 生成日時  : ${proposal.created_at}\n`);
  process.stdout.write(`\n  【Zodスキーマ案】\n`);
  process.stdout.write(`    ${proposal.zod_schema_suggestion}\n`);
  process.stdout.write(`\n  【データ取得ヒント】\n`);
  process.stdout.write(`    ${proposal.scraping_hint}\n`);
  process.stdout.write(`\n  【ユーザーのニーズ例】\n`);
  proposal.sample_intents.forEach((intent, i) => {
    process.stdout.write(`    ${i + 1}. "${intent}"\n`);
  });
  process.stdout.write(`${bar}\n`);
}

// -----------------------------------------------------------------------
// 承認済み実装ガイドの表示
// -----------------------------------------------------------------------
function displayImplementationGuide(approvedProposals: Proposal[]): void {
  if (approvedProposals.length === 0) return;

  process.stdout.write("\n\n");
  process.stdout.write("╔══════════════════════════════════════════════════════════╗\n");
  process.stdout.write("║  ✅ 承認済みプロポーザル - schemas/product.ts への追記案  ║\n");
  process.stdout.write("╚══════════════════════════════════════════════════════════╝\n\n");
  process.stdout.write("以下を schemas/product.ts の ProductSchema に追記してください:\n\n");
  process.stdout.write("```typescript\n");
  for (const p of approvedProposals) {
    process.stdout.write(`  // ${p.description}（需要: ${p.demand_count}件）\n`);
    process.stdout.write(`  ${p.zod_schema_suggestion},\n`);
  }
  process.stdout.write("```\n\n");
  process.stdout.write(
    "承認済みファイルは proposals/approved/ に保存されています。\n"
  );
}

// -----------------------------------------------------------------------
// メイン
// -----------------------------------------------------------------------
async function main(): Promise<void> {
  await ensureDirs();

  process.stdout.write("\n");
  process.stdout.write("╔══════════════════════════════════════════════════════════╗\n");
  process.stdout.write("║   🏗️  MCP Hub - スキーマ拡張 承認レビュー CLI (v1.4)    ║\n");
  process.stdout.write("╚══════════════════════════════════════════════════════════╝\n");

  // ── Step 0: 需要集計サマリーを表示 ──
  process.stdout.write("\n📈 現在の需要ギャップ集計:\n");
  const demands = await analyzeDemand();
  if (demands.length === 0) {
    process.stdout.write("  (需要データなし - まず検索ツールを呼び出してください)\n");
  } else {
    for (const d of demands.slice(0, 8)) {
      const bar = "█".repeat(Math.min(d.demand_count * 2, 20));
      process.stdout.write(
        `  ${bar.padEnd(20)} ${d.demand_count}件  ${d.attribute_key} (${d.description})\n`
      );
    }
  }

  // ── Step 1: 新しい提案を自動生成（THRESHOLD以上のもの）──
  process.stdout.write("\n🤖 新しい提案を自動生成中...\n");
  const genResult = await generateProposals();
  if (genResult.generated.length > 0) {
    process.stdout.write(`  ✨ ${genResult.generated.length}件の新規提案を生成しました:\n`);
    for (const p of genResult.generated) {
      process.stdout.write(`     - ${p.attribute_key} (需要: ${p.demand_count}件)\n`);
    }
  }
  if (genResult.skipped_existing.length > 0) {
    process.stdout.write(
      `  ⏭️  既存のためスキップ: ${genResult.skipped_existing.join(", ")}\n`
    );
  }

  // ── Step 2: 承認待ち提案のレビュー ──
  const pending = await loadPendingProposals();

  if (pending.length === 0) {
    process.stdout.write(
      "\n✅ 承認待ちの提案はありません。\n" +
        "   (需要が閾値に達していないか、既にレビュー済みです)\n\n"
    );
    return;
  }

  process.stdout.write(`\n📋 承認待ちの提案: ${pending.length}件\n`);

  const rl = createRL();
  const approvedProposals: Proposal[] = [];

  for (let i = 0; i < pending.length; i++) {
    const { filename, proposal } = pending[i]!;

    displayProposal(proposal, i, pending.length);

    const answer = await question(
      rl,
      "\n  承認しますか？ [y=承認 / n=却下 / s=スキップ / q=終了]: "
    );

    if (answer.toLowerCase() === "q") {
      process.stdout.write("\n  レビューを終了します。\n");
      break;
    }

    if (answer.toLowerCase() === "s") {
      process.stdout.write("  → スキップしました。\n");
      continue;
    }

    if (answer.toLowerCase() === "y") {
      const approved: Proposal = {
        ...proposal,
        status: "approved",
        reviewed_at: new Date().toISOString(),
      };
      await writeFile(
        join(APPROVED_DIR, filename),
        JSON.stringify(approved, null, 2),
        "utf-8"
      );
      // pending から削除（rename で移動）
      try {
        await rename(join(PENDING_DIR, filename), join(APPROVED_DIR, filename));
      } catch {
        // rename 失敗時はファイルが既に書かれているので無視
      }
      approvedProposals.push(approved);
      process.stdout.write(`  ✅ 承認しました: ${proposal.attribute_key}\n`);
    } else {
      const reason = await question(rl, "  却下理由（省略可）: ");
      const rejected: Proposal = {
        ...proposal,
        status: "rejected",
        reviewed_at: new Date().toISOString(),
        rejection_reason: reason || "理由なし",
      };
      await writeFile(
        join(REJECTED_DIR, filename),
        JSON.stringify(rejected, null, 2),
        "utf-8"
      );
      try {
        await rename(join(PENDING_DIR, filename), join(REJECTED_DIR, filename));
      } catch {
        // 無視
      }
      process.stdout.write(`  ❌ 却下しました: ${proposal.attribute_key}\n`);
    }
  }

  rl.close();

  // ── Step 3: 実装ガイド表示 ──
  displayImplementationGuide(approvedProposals);
}

main().catch((e) => {
  process.stderr.write(`[review_proposals] Error: ${e}\n`);
  process.exit(1);
});
