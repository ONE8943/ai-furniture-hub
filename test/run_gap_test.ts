/**
 * Phase 1 改 - Gap検知機能テスト
 */
import { searchProducts } from "../tools/search_products";
import { detectGaps } from "../utils/gap_detector";
import { readFile } from "fs/promises";

const GAP_LOG_PATH = "logs/requirement_gaps.jsonl";

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
  process.stdout.write("  MCP Hub v1.3 - Gap検知テスト\n");
  process.stdout.write("========================================\n\n");

  // ─────────────────────────────────────────────────────────────────
  // Unit Tests: detectGaps() の単体テスト
  // ─────────────────────────────────────────────────────────────────
  process.stdout.write("【UNIT TESTS: detectGaps()】\n\n");

  // Test U1: 耐荷重
  process.stdout.write("[U1] 「耐荷重50kg以上の棚」を検知できるか\n");
  const u1 = detectGaps("耐荷重50kg以上の棚が欲しい。本をたくさん入れたい。");
  process.stdout.write(`  検知: ${u1.detected_attributes.join(", ")}\n`);
  assert("has_gaps=true", u1.has_gaps);
  assert("load_capacity_kg を検知", u1.detected_attributes.includes("load_capacity_kg"));

  // Test U2: 複数ギャップ
  process.stdout.write("\n[U2] 「子供部屋用・キャスター付き・防水」複数ギャップ検知\n");
  const u2 = detectGaps(
    "子供部屋に置く棚で、キャスター付きで移動できるものが欲しい。また防水加工されていると嬉しい。"
  );
  process.stdout.write(`  検知: ${u2.detected_attributes.join(", ")}\n`);
  assert("has_gaps=true", u2.has_gaps);
  assert("child_safe を検知", u2.detected_attributes.includes("child_safe"));
  assert("has_casters を検知", u2.detected_attributes.includes("has_casters"));
  assert("water_resistant を検知", u2.detected_attributes.includes("water_resistant"));
  assert("3つ以上検知", u2.detected_attributes.length >= 3);

  // Test U3: ギャップなし（既存スキーマ内の要件のみ）
  process.stdout.write("\n[U3] 既存スキーマ内の要件のみ → Gap検知なし\n");
  const u3 = detectGaps("リビングに幅80cmの棚を置きたい。白色でシンプルなもの。予算は1万円以内。");
  process.stdout.write(`  検知: ${u3.detected_attributes.join(", ") || "なし"}\n`);
  assert("has_gaps=false（既存属性のみ）", !u3.has_gaps);

  // Test U4: 耐震・転倒防止
  process.stdout.write("\n[U4] 「地震・転倒防止」ギャップ検知\n");
  const u4 = detectGaps("地震が多い地域に住んでいる。転倒防止金具が付けられる棚が欲しい。");
  process.stdout.write(`  検知: ${u4.detected_attributes.join(", ")}\n`);
  assert("earthquake_resistant を検知", u4.detected_attributes.includes("earthquake_resistant"));

  // Test U5: 全角・半角正規化
  process.stdout.write("\n[U5] 全角英字「ＦＳＣ」の正規化マッチ\n");
  const u5 = detectGaps("ＦＳＣ認証の木材を使ったエコな棚が欲しい。");
  process.stdout.write(`  検知: ${u5.detected_attributes.join(", ")}\n`);
  assert("eco_certified を検知（全角FSC）", u5.detected_attributes.includes("eco_certified"));

  // ─────────────────────────────────────────────────────────────────
  // Integration Tests: searchProducts() 経由の Gap 記録テスト
  // ─────────────────────────────────────────────────────────────────
  process.stdout.write("\n【INTEGRATION TESTS: searchProducts() + Gap記録】\n\n");

  // Test I1: 耐荷重ありでヒットする検索
  process.stdout.write("[I1] 「耐荷重50kg以上」の意図でヒット検索 → Gap記録\n");
  const i1 = await searchProducts({
    width_mm_max: 900,
    in_stock_only: true,
    intent: "本棚として使いたい。耐荷重50kg以上の棚が欲しい。本をたくさん入れる予定。",
  });
  process.stdout.write(`  検索結果: ${i1.total}件ヒット\n`);
  assert("検索は正常にヒット", i1.total >= 1);
  assert("gap_feedback が返却される", i1.gap_feedback !== undefined);
  assert(
    "gap_feedback に load_capacity_kg が含まれる",
    i1.gap_feedback?.detected_needs.includes("load_capacity_kg") ?? false
  );

  // Test I2: 防炎・耐震でミス検索 → Gap + miss 両方記録
  process.stdout.write("\n[I2] 「防炎・耐震・幅25cm以下」でミス検索 → Gap+Miss 両方記録\n");
  const i2 = await searchProducts({
    width_mm_max: 250,
    in_stock_only: true,
    intent:
      "マンションの消防法で防炎加工が必要。また耐震性能も重視。幅25cm以内の薄い棚が欲しい。",
  });
  process.stdout.write(`  検索結果: ${i2.total}件ヒット\n`);
  assert("ミス（0件）", i2.total === 0);
  assert("miss=true", i2.miss === true);
  assert("gap_feedback が返却される（miss + gap 両立）", i2.gap_feedback !== undefined);
  assert(
    "fire_resistant を検知",
    i2.gap_feedback?.detected_needs.includes("fire_resistant") ?? false
  );
  assert(
    "earthquake_resistant を検知",
    i2.gap_feedback?.detected_needs.includes("earthquake_resistant") ?? false
  );

  // Test I3: ギャップなしで通常検索
  process.stdout.write("\n[I3] ギャップなしで通常検索 → gap_feedback なし\n");
  const i3 = await searchProducts({
    price_max: 15000,
    in_stock_only: true,
    intent: "リビングに白い棚を置きたい。予算は15000円以内。",
  });
  process.stdout.write(`  検索結果: ${i3.total}件ヒット\n`);
  assert("通常ヒット", i3.total >= 1);
  assert("gap_feedback なし（ギャップなし）", i3.gap_feedback === undefined);

  // ─────────────────────────────────────────────────────────────────
  // Log Verification: requirement_gaps.jsonl の検証
  // ─────────────────────────────────────────────────────────────────
  process.stdout.write("\n[VERIFY] requirement_gaps.jsonl の内容を確認\n");

  await new Promise((resolve) => setTimeout(resolve, 500));

  let gapContent = "";
  try {
    gapContent = await readFile(GAP_LOG_PATH, "utf-8");
  } catch {
    assert("requirement_gaps.jsonl が存在する", false);
    summarize(passed, failed);
    return;
  }

  const gapLines = gapContent
    .trim()
    .split("\n")
    .filter((l) => l.length > 0);
  process.stdout.write(`  ギャップログ行数: ${gapLines.length}件\n`);

  assert("requirement_gaps.jsonl が存在し内容がある", gapLines.length > 0);

  let parseErrors = 0;
  let loadCapacityCount = 0;
  for (const line of gapLines) {
    try {
      const entry = JSON.parse(line) as Record<string, unknown>;
      const attrs = entry["detected_attributes"] as string[];
      if (attrs?.includes("load_capacity_kg")) loadCapacityCount++;
    } catch {
      parseErrors++;
    }
  }

  assert("全ギャップログ行がJSONとして正常", parseErrors === 0);
  assert("load_capacity_kg の記録が存在する", loadCapacityCount >= 1);

  // サンプル表示
  process.stdout.write("\n  --- サンプル Gap ログ（最初の1件）---\n");
  const first = JSON.parse(gapLines[0]!) as Record<string, unknown>;
  process.stdout.write(`  ${JSON.stringify(first, null, 4)}\n`);

  summarize(passed, failed);
}

function summarize(passed: number, failed: number): void {
  process.stdout.write("\n========================================\n");
  process.stdout.write(`  結果: ${passed}件 PASS / ${failed}件 FAIL\n`);
  if (failed === 0) {
    process.stdout.write("  🎉 Gap検知テスト完了！全テスト成功\n");
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
