#!/usr/bin/env ts-node
/**
 * 需要ギャップのサマリーを表示する読み取り専用スクリプト
 * `npm run analyze` で起動
 */
import { analyzeDemand } from "../utils/demand_analyzer";
import { readdir, readFile } from "fs/promises";
import { join } from "path";
import { Proposal } from "../schemas/proposal";

async function loadProposalsByStatus(
  dir: string
): Promise<Proposal[]> {
  const files = await readdir(dir).catch(() => [] as string[]);
  const result: Proposal[] = [];
  for (const f of files.filter((x) => x.endsWith(".json"))) {
    try {
      const content = await readFile(join(dir, f), "utf-8");
      result.push(JSON.parse(content) as Proposal);
    } catch {
      // ignore
    }
  }
  return result;
}

async function main(): Promise<void> {
  process.stdout.write("\n");
  process.stdout.write("╔══════════════════════════════════════════════════════════╗\n");
  process.stdout.write("║   📊 MCP Hub - 需要ギャップ分析レポート                 ║\n");
  process.stdout.write("╚══════════════════════════════════════════════════════════╝\n\n");

  // ── 需要ランキング ──
  const demands = await analyzeDemand();

  if (demands.length === 0) {
    process.stdout.write("需要データがありません。検索ツールを呼び出してログを蓄積してください。\n\n");
  } else {
    process.stdout.write("🔥 需要ランキング（requirement_gaps.jsonl より）:\n\n");
    process.stdout.write(
      `  ${"順位".padEnd(4)} ${"件数".padEnd(6)} ${"属性".padEnd(30)} 説明\n`
    );
    process.stdout.write("  " + "─".repeat(70) + "\n");

    demands.forEach((d, i) => {
      const bar = "█".repeat(Math.min(d.demand_count * 3, 15)).padEnd(15);
      process.stdout.write(
        `  ${String(i + 1).padEnd(4)} ${String(d.demand_count).padEnd(6)} ${d.attribute_key.padEnd(30)} ${d.description}\n`
      );
    });

    // ビジネスインサイト
    process.stdout.write("\n💡 ビジネスインサイト:\n");
    const top3 = demands.slice(0, 3);
    top3.forEach((d) => {
      process.stdout.write(
        `  → 「${d.description}」が${d.demand_count}件リクエスト。` +
          `商品ページへの追加で回答精度が向上します。\n`
      );
    });
  }

  // ── プロポーザル状況 ──
  const pending = await loadProposalsByStatus("proposals/pending");
  const approved = await loadProposalsByStatus("proposals/approved");
  const rejected = await loadProposalsByStatus("proposals/rejected");

  process.stdout.write("\n📋 プロポーザル状況:\n");
  process.stdout.write(`  承認待ち  : ${pending.length}件\n`);
  process.stdout.write(`  承認済み  : ${approved.length}件\n`);
  process.stdout.write(`  却下済み  : ${rejected.length}件\n`);

  if (approved.length > 0) {
    process.stdout.write("\n✅ 承認済み（実装予定）:\n");
    approved.forEach((p) => {
      process.stdout.write(
        `  - ${p.attribute_key} (需要: ${p.demand_count}件) 承認: ${p.reviewed_at?.slice(0, 10)}\n`
      );
    });
    process.stdout.write("\n  ▶ schemas/product.ts への追記案:\n\n");
    process.stdout.write("```typescript\n");
    approved.forEach((p) => {
      process.stdout.write(`  // ${p.description}\n`);
      process.stdout.write(`  ${p.zod_schema_suggestion},\n`);
    });
    process.stdout.write("```\n");
  }

  if (pending.length > 0) {
    process.stdout.write("\n⏳ 承認待ち（「npm run review」で審査してください）:\n");
    pending.forEach((p) => {
      process.stdout.write(
        `  - ${p.attribute_key} (需要: ${p.demand_count}件)\n`
      );
    });
  }

  process.stdout.write("\n");
}

main().catch((e) => {
  process.stderr.write(`Error: ${e}\n`);
  process.exit(1);
});
