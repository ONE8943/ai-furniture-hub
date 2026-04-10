/**
 * Phase 1 動作テスト
 * - search_products を直接呼び出してログが正しく書き込まれるか確認
 */
import { searchProducts } from "../tools/search_products";
import { readFile } from "fs/promises";

const LOG_PATH = "logs/analytics.jsonl";

async function runTests(): Promise<void> {
  let passed = 0;
  let failed = 0;

  async function assert(label: string, condition: boolean): Promise<void> {
    if (condition) {
      process.stdout.write(`  ✅ PASS: ${label}\n`);
      passed++;
    } else {
      process.stdout.write(`  ❌ FAIL: ${label}\n`);
      failed++;
    }
  }

  process.stdout.write("\n========================================\n");
  process.stdout.write("  MCP Hub Phase 1 - 動作テスト\n");
  process.stdout.write("========================================\n\n");

  // --- Test 1: 幅450mm以下でヒットする検索 ---
  process.stdout.write("[TEST 1] 幅450mm以下・在庫ありの棚を検索\n");
  const result1 = await searchProducts({
    width_mm_max: 450,
    in_stock_only: true,
    intent:
      "脱衣所の洗濯機横に幅450mm以内の収納棚を置きたい。下着やタオルを入れる予定。予算は特に決めていない。",
  });
  process.stdout.write(`  結果: ${result1.total}件ヒット\n`);
  await assert("ヒット件数が1件以上", result1.total >= 1);
  await assert("missフラグがfalse", result1.miss === false);
  await assert("productsが返る", Array.isArray(result1.products));

  // --- Test 2: 価格10000円以下でヒットする検索 ---
  process.stdout.write("\n[TEST 2] 価格10000円以下のカラーボックスを検索\n");
  const result2 = await searchProducts({
    price_max: 10000,
    category: "カラーボックス",
    in_stock_only: true,
    intent:
      "子供部屋に安価なカラーボックスを置きたい。おもちゃや絵本を整理するため。予算は1万円以内。",
  });
  process.stdout.write(`  結果: ${result2.total}件ヒット\n`);
  await assert("ヒット件数が1件以上", result2.total >= 1);
  await assert("missフラグがfalse", result2.miss === false);
  await assert("全商品が価格条件を満たす", result2.products.every((p) => p.price <= 10000));

  // --- Test 3: 在庫切れ商品が除外されることを確認 ---
  process.stdout.write("\n[TEST 3] ブラウンのカラーボックスを検索（在庫切れ商品の除外テスト）\n");
  const result3 = await searchProducts({
    color: "ブラウン",
    in_stock_only: true,
    intent: "ブラウン系の家具でリビングをまとめたい。既存の棚に合わせるため色指定が重要。",
  });
  process.stdout.write(`  結果: ${result3.total}件ヒット\n`);
  await assert("在庫切れ商品が除外され0件", result3.total === 0);
  await assert("missフラグがtrue（Gap Analysis記録）", result3.miss === true);
  await assert("miss_reasonが設定されている", result3.miss_reason !== undefined);

  // --- Test 4: 幅430〜599mmという在庫のないサイズ帯（Gap Analysis テスト）---
  process.stdout.write("\n[TEST 4] 幅430〜599mmの棚で検索（Gap Analysis - 市場の隙間）\n");
  const result4 = await searchProducts({
    width_mm_min: 430,
    width_mm_max: 599,
    in_stock_only: true,
    intent:
      "洗面所の壁と洗濯機の間が正確に430〜599mmの隙間しかない。この幅に合う棚がどこにもなくて困っている。ニトリや他社を探してもないサイズ。",
  });
  process.stdout.write(`  結果: ${result4.total}件ヒット\n`);
  await assert("missフラグがtrue（市場の隙間データ）", result4.miss === true);
  await assert("suggestion（代替案）が提供される", typeof result4.suggestion === "string");

  // --- Test 5: 全商品を返す検索（インサイトログ記録確認）---
  process.stdout.write("\n[TEST 5] 広い条件で検索してヒット記録をログに残す\n");
  const result5 = await searchProducts({
    price_max: 50000,
    in_stock_only: false,
    intent:
      "引っ越し先のリビング・寝室・洗面所に収納家具を揃えたい。まずラインナップを見たいので全商品を見せてほしい。",
  });
  process.stdout.write(`  結果: ${result5.total}件ヒット\n`);
  await assert("全5件が返る", result5.total === 5);

  // --- ログファイルの検証 ---
  process.stdout.write("\n[VERIFY] analytics.jsonl の内容を確認\n");

  // ログ書き込みを待つ
  await new Promise((resolve) => setTimeout(resolve, 500));

  let logContent = "";
  try {
    logContent = await readFile(LOG_PATH, "utf-8");
  } catch {
    await assert("analytics.jsonl が存在する", false);
    summarize(passed, failed);
    return;
  }

  const logLines = logContent
    .trim()
    .split("\n")
    .filter((l) => l.length > 0);
  process.stdout.write(`  ログ行数: ${logLines.length}件\n`);

  await assert("analytics.jsonl が存在し内容がある", logLines.length > 0);

  // 各行がJSONとしてパース可能か確認
  let parseErrors = 0;
  let missCount = 0;
  let hitCount = 0;
  for (const line of logLines) {
    try {
      const entry = JSON.parse(line) as Record<string, unknown>;
      if (entry["miss"] === true) missCount++;
      else hitCount++;
    } catch {
      parseErrors++;
    }
  }

  await assert("全ログ行がJSONとして正常", parseErrors === 0);
  await assert("missログが存在する（Gap Analysis有効）", missCount >= 1);
  await assert("hitログが存在する（正常ヒット記録）", hitCount >= 1);

  process.stdout.write(`\n  内訳 → ヒット: ${hitCount}件 / ミス: ${missCount}件\n`);

  // サンプルログを表示
  process.stdout.write("\n  --- サンプルログ（最後の1件）---\n");
  const last = JSON.parse(logLines[logLines.length - 1]!) as Record<string, unknown>;
  process.stdout.write(`  ${JSON.stringify(last, null, 4)}\n`);

  summarize(passed, failed);
}

function summarize(passed: number, failed: number): void {
  process.stdout.write("\n========================================\n");
  process.stdout.write(
    `  結果: ${passed}件 PASS / ${failed}件 FAIL\n`
  );
  if (failed === 0) {
    process.stdout.write("  🎉 Phase 1 テスト完了！全テスト成功\n");
  } else {
    process.stdout.write("  ⚠️  一部テストが失敗しました。ログを確認してください。\n");
  }
  process.stdout.write("========================================\n\n");
  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch((e) => {
  process.stderr.write(`[Test] Fatal error: ${e}\n`);
  process.exit(1);
});
