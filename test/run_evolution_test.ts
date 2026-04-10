/**
 * Phase 1 v1.4 - Self-Evolution テスト
 * Gap検知 → プロポーザル自動生成 → 需要集計の一連フローを検証
 */
import { searchProducts } from "../tools/search_products";
import { analyzeDemand, getHotGaps } from "../utils/demand_analyzer";
import { generateProposals } from "../utils/proposal_generator";
import { readdir, readFile } from "fs/promises";
import { join } from "path";
import { Proposal } from "../schemas/proposal";

async function runTests(): Promise<void> {
  let passed = 0;
  let failed = 0;

  function assert(label: string, condition: boolean): void {
    if (condition) {
      process.stdout.write(`  ✅ PASS: ${label}\n`);
      passed++;
    } else {
      process.stdout.write(`  ❌ FAIL: ${label}\n`);
      failed++;
    }
  }

  process.stdout.write("\n========================================\n");
  process.stdout.write("  MCP Hub v1.4 - Self-Evolution テスト\n");
  process.stdout.write("========================================\n\n");

  // ─────────────────────────────────────────────────────────────────
  // Step 1: 複数回の検索でギャップを蓄積させる
  // ─────────────────────────────────────────────────────────────────
  process.stdout.write("【STEP 1】ギャップを複数回蓄積（各属性2件以上）\n\n");

  const searchCases = [
    {
      label: "耐荷重ニーズ①",
      input: {
        in_stock_only: true,
        intent: "本棚として使いたい。耐荷重50kg以上が必要。重い全集を入れる。",
      },
    },
    {
      label: "耐荷重ニーズ②",
      input: {
        in_stock_only: true,
        intent: "工具や工具箱を収納したい。耐荷重30kg以上の棚を探している。",
      },
    },
    {
      label: "子供・キャスターニーズ①",
      input: {
        in_stock_only: true,
        intent: "子供部屋用でキャスター付きが欲しい。おもちゃ収納に。",
      },
    },
    {
      label: "子供・キャスターニーズ②",
      input: {
        price_max: 10000,
        in_stock_only: true,
        intent: "幼児がいる家庭で安全な棚が必要。キャスターで移動できると嬉しい。",
      },
    },
    {
      label: "耐震ニーズ①",
      input: {
        in_stock_only: true,
        intent: "地震の多い地域に住んでいる。転倒防止機能のある棚が欲しい。",
      },
    },
    {
      label: "耐震ニーズ②（ミス+ギャップ）",
      input: {
        width_mm_max: 200,
        in_stock_only: true,
        intent: "耐震性能があり、幅20cm以内の超スリム棚を探している。",
      },
    },
  ];

  for (const c of searchCases) {
    process.stdout.write(`  [検索] ${c.label}...\n`);
    await searchProducts(c.input);
  }

  // プロポーザル生成を待つ（非同期）
  await new Promise((resolve) => setTimeout(resolve, 800));

  process.stdout.write("\n");

  // ─────────────────────────────────────────────────────────────────
  // Step 2: 需要集計の検証
  // ─────────────────────────────────────────────────────────────────
  process.stdout.write("【STEP 2】需要集計（demand_analyzer）\n\n");

  const demands = await analyzeDemand();
  process.stdout.write(`  集計された属性: ${demands.length}種類\n`);
  demands.slice(0, 5).forEach((d) => {
    process.stdout.write(`    - ${d.attribute_key}: ${d.demand_count}件\n`);
  });
  process.stdout.write("\n");

  assert("需要集計が1件以上", demands.length >= 1);
  assert("load_capacity_kg が集計される", demands.some((d) => d.attribute_key === "load_capacity_kg"));
  assert("sample_intents が含まれる", demands[0]?.sample_intents?.length > 0);

  // ─────────────────────────────────────────────────────────────────
  // Step 3: Hot Gaps（閾値2以上）の検証
  // ─────────────────────────────────────────────────────────────────
  process.stdout.write("【STEP 3】Hot Gaps（閾値2件以上）\n\n");

  const hotGaps = await getHotGaps(2);
  process.stdout.write(`  閾値以上の属性: ${hotGaps.length}種類\n`);
  hotGaps.forEach((g) => {
    process.stdout.write(`    - ${g.attribute_key}: ${g.demand_count}件 ★\n`);
  });
  process.stdout.write("\n");

  assert("Hot Gapsが1件以上検出される", hotGaps.length >= 1);
  assert(
    "load_capacity_kg が Hot Gaps に含まれる",
    hotGaps.some((g) => g.attribute_key === "load_capacity_kg")
  );

  // ─────────────────────────────────────────────────────────────────
  // Step 4: プロポーザル自動生成の検証
  // ─────────────────────────────────────────────────────────────────
  process.stdout.write("【STEP 4】プロポーザル自動生成\n\n");

  const genResult = await generateProposals(2, 5);
  process.stdout.write(`  生成: ${genResult.generated.length}件\n`);
  process.stdout.write(`  スキップ（既存）: ${genResult.skipped_existing.length}件\n`);
  process.stdout.write(`  Hot Gaps 総数: ${genResult.total_hot_gaps}件\n\n`);

  assert(
    "プロポーザルが生成されるか既存で処理済み",
    genResult.generated.length + genResult.skipped_existing.length >= 1
  );

  // ─────────────────────────────────────────────────────────────────
  // Step 5: proposals/pending/ ファイルの検証
  // ─────────────────────────────────────────────────────────────────
  process.stdout.write("【STEP 5】proposals/pending/ ファイル検証\n\n");

  const pendingFiles = await readdir("proposals/pending").catch(() => [] as string[]);
  const jsonFiles = pendingFiles.filter((f) => f.endsWith(".json"));
  process.stdout.write(`  pending ファイル数: ${jsonFiles.length}件\n`);

  let validProposals = 0;
  let hasLoadCapacity = false;
  let hasSampleIntents = false;
  let hasZodSuggestion = false;

  for (const f of jsonFiles) {
    const content = await readFile(join("proposals/pending", f), "utf-8");
    const p = JSON.parse(content) as Proposal;
    if (p.status === "pending" && p.attribute_key && p.demand_count >= 2) validProposals++;
    if (p.attribute_key === "load_capacity_kg") hasLoadCapacity = true;
    if (p.sample_intents?.length > 0) hasSampleIntents = true;
    if (p.zod_schema_suggestion?.length > 0) hasZodSuggestion = true;
  }

  process.stdout.write(`  有効プロポーザル: ${validProposals}件\n`);
  process.stdout.write("\n");

  assert("proposals/pending/ に有効なJSONがある", validProposals >= 1 || genResult.skipped_existing.length >= 1);
  assert("load_capacity_kg の提案が存在（pending or 既存）",
    hasLoadCapacity || genResult.skipped_existing.includes("load_capacity_kg")
  );
  assert("sample_intents が含まれる", hasSampleIntents || genResult.skipped_existing.length > 0);
  assert("zod_schema_suggestion が含まれる", hasZodSuggestion || genResult.skipped_existing.length > 0);

  // ─────────────────────────────────────────────────────────────────
  // Step 6: サンプルプロポーザルの表示
  // ─────────────────────────────────────────────────────────────────
  if (jsonFiles.length > 0 || genResult.skipped_existing.length > 0) {
    process.stdout.write("【STEP 6】サンプルプロポーザル内容:\n\n");

    // 最初のファイルを表示
    const allDirs = ["proposals/pending", "proposals/approved"];
    for (const dir of allDirs) {
      const files = await readdir(dir).catch(() => [] as string[]);
      if (files.length > 0 && files[0]?.endsWith(".json")) {
        const content = await readFile(join(dir, files[0]!), "utf-8");
        const p = JSON.parse(content) as Proposal;
        process.stdout.write(`  ファイル: ${dir}/${files[0]}\n`);
        process.stdout.write(`  ${JSON.stringify(p, null, 4).split("\n").join("\n  ")}\n\n`);
        break;
      }
    }
  }

  summarize(passed, failed);
}

function summarize(passed: number, failed: number): void {
  process.stdout.write("========================================\n");
  process.stdout.write(`  結果: ${passed}件 PASS / ${failed}件 FAIL\n`);
  if (failed === 0) {
    process.stdout.write("  🎉 Self-Evolution テスト完了！全テスト成功\n");
  } else {
    process.stdout.write("  ⚠️  一部テストが失敗しました。\n");
  }
  process.stdout.write("========================================\n\n");
  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch((e) => {
  process.stderr.write(`[Test] Fatal error: ${e}\n`);
  process.exit(1);
});
