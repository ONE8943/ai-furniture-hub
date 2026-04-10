/**
 * 楽天API連携テストスイート
 */
import "dotenv/config";
import { searchRakutenProducts, isRakutenApiConfigured } from "../adapters/rakuten_api";
import { searchRakuten } from "../tools/search_rakuten";
import { buildAffiliateUrl } from "../services/affiliate";
import { readFile } from "fs/promises";

const ANALYTICS_LOG = "logs/analytics.jsonl";

async function runTests(): Promise<void> {
  let passed = 0;
  let failed = 0;

  function assert(label: string, condition: boolean): void {
    if (condition) {
      process.stdout.write(`  PASS: ${label}\n`);
      passed++;
    } else {
      process.stdout.write(`  FAIL: ${label}\n`);
      failed++;
    }
  }

  process.stdout.write("\n========================================\n");
  process.stdout.write("  MCP Hub - 楽天API連携テスト\n");
  process.stdout.write("========================================\n\n");

  // ─────────────────────────────────────────────────────────────────
  // U1: isRakutenApiConfigured
  // ─────────────────────────────────────────────────────────────────
  process.stdout.write("[U1] isRakutenApiConfigured()\n");
  const configured = isRakutenApiConfigured();
  assert("モックモードではtrue", configured === true);

  // ─────────────────────────────────────────────────────────────────
  // U2: モック検索 - キーワード一致
  // ─────────────────────────────────────────────────────────────────
  process.stdout.write("\n[U2] モック検索: キーワード 'Nクリック'\n");
  const u2 = await searchRakutenProducts({ keyword: "Nクリック" });
  process.stdout.write(`  source: ${u2.source}, 件数: ${u2.products.length}\n`);
  assert("source=mock", u2.source === "mock");
  assert("Nクリック関連がヒット", u2.products.length >= 1);
  assert("商品名にNクリック含む", u2.products.some((p) => p.name.includes("Nクリック")));

  // ─────────────────────────────────────────────────────────────────
  // U3: モック検索 - 価格フィルタ
  // ─────────────────────────────────────────────────────────────────
  process.stdout.write("\n[U3] モック検索: 価格帯 5000〜15000円\n");
  const u3 = await searchRakutenProducts({ keyword: "楽天", minPrice: 5000, maxPrice: 15000 });
  process.stdout.write(`  件数: ${u3.products.length}\n`);
  for (const p of u3.products) {
    assert(`${p.name}(${p.price}円) が価格帯内`, p.price >= 5000 && p.price <= 15000);
  }

  // ─────────────────────────────────────────────────────────────────
  // U4: モック検索 - 0件
  // ─────────────────────────────────────────────────────────────────
  process.stdout.write("\n[U4] モック検索: 存在しないキーワード\n");
  const u4 = await searchRakutenProducts({ keyword: "宇宙船格納庫ラック" });
  assert("0件", u4.products.length === 0);

  // ─────────────────────────────────────────────────────────────────
  // U5: アフィリエイトURL生成（楽天URLに対して）
  // ─────────────────────────────────────────────────────────────────
  process.stdout.write("\n[U5] 楽天URLのアフィリエイトURL生成\n");
  const rakutenUrl = "https://item.rakuten.co.jp/nitori/8842174-/";
  const aff = buildAffiliateUrl(rakutenUrl);
  process.stdout.write(`  入力: ${rakutenUrl}\n`);
  process.stdout.write(`  出力: ${aff.affiliate_url.slice(0, 80)}...\n`);
  assert("platform=rakuten", aff.platform === "rakuten");
  assert("/ichiba/ 形式", aff.affiliate_url.includes("/ichiba/"));
  const rakutenId = process.env["AFFILIATE_ID_RAKUTEN"] ?? "";
  if (rakutenId) {
    assert("楽天アフィリエイトID含む", aff.affiliate_url.includes(rakutenId));
  } else {
    assert("ID未設定時は元URLが返る", aff.affiliate_url === rakutenUrl);
  }
  assert("pcパラメータにエンコードされたURL含む", aff.affiliate_url.includes("pc="));

  // ─────────────────────────────────────────────────────────────────
  // I1: MCPツール search_rakuten - 正常検索
  // ─────────────────────────────────────────────────────────────────
  process.stdout.write("\n[I1] search_rakuten ツール: キーワード検索\n");
  const i1 = await searchRakuten({
    intent: "リビングに置くワイドなシェルフを探している。白系が好み。",
    keyword: "Nクリック",
  });
  process.stdout.write(`  total: ${i1.total}, source: ${i1.source}, miss: ${i1.miss}\n`);
  assert("miss=false", i1.miss === false);
  assert("total >= 1", i1.total >= 1);
  assert("source=mock", i1.source === "mock");
  assert("全商品にaffiliate_urlがある", i1.products.every((p) => p.affiliate_url.length > 0));
  assert(
    "estimated_commission_yen >= 0",
    i1.products.every((p) => p.estimated_commission_yen >= 0)
  );

  // ─────────────────────────────────────────────────────────────────
  // I2: MCPツール search_rakuten - ミス（0件）
  // ─────────────────────────────────────────────────────────────────
  process.stdout.write("\n[I2] search_rakuten ツール: 0件ケース\n");
  const i2 = await searchRakuten({
    intent: "特殊な宇宙用家具が欲しい",
    keyword: "宇宙船格納庫ラック",
  });
  assert("miss=true", i2.miss === true);
  assert("miss_reasonがある", typeof i2.miss_reason === "string");
  assert("suggestionがある", typeof i2.suggestion === "string");

  // ─────────────────────────────────────────────────────────────────
  // I3: MCPツール search_rakuten - Gap検知
  // ─────────────────────────────────────────────────────────────────
  process.stdout.write("\n[I3] search_rakuten ツール: Gap検知（耐荷重）\n");
  const i3 = await searchRakuten({
    intent: "耐荷重30kg以上の丈夫な棚が必要。防水加工も欲しい。",
    keyword: "収納棚",
  });
  if (i3.gap_feedback) {
    process.stdout.write(`  gap_feedback.detected_needs: ${i3.gap_feedback.detected_needs.join(", ")}\n`);
    assert(
      "耐荷重(load_capacity_kg)が検知される",
      i3.gap_feedback.detected_needs.some((n) => n.includes("load_capacity") || n.includes("耐荷重"))
    );
    assert(
      "防水(water_resistant)が検知される",
      i3.gap_feedback.detected_needs.some((n) => n.includes("water_resistant") || n.includes("防水"))
    );
  } else {
    assert("gap_feedbackが返る", false);
  }

  // ─────────────────────────────────────────────────────────────────
  // V1: ログ検証
  // ─────────────────────────────────────────────────────────────────
  process.stdout.write("\n[V1] analytics.jsonl に楽天ツールのログがある\n");
  await new Promise((r) => setTimeout(r, 500));
  let logContent = "";
  try {
    logContent = await readFile(ANALYTICS_LOG, "utf-8");
  } catch {
    assert("analytics.jsonl が存在する", false);
    summarize(passed, failed);
    return;
  }
  const rakutenLogs = logContent
    .trim()
    .split("\n")
    .filter((l) => l.includes("search_rakuten_products"));
  process.stdout.write(`  楽天関連ログ: ${rakutenLogs.length}件\n`);
  assert("楽天ツールのログが記録されている", rakutenLogs.length > 0);

  if (rakutenLogs.length > 0) {
    try {
      const last = JSON.parse(rakutenLogs[rakutenLogs.length - 1]!) as Record<string, unknown>;
      assert("toolフィールドが正しい", last["tool"] === "search_rakuten_products");
    } catch {
      assert("ログがJSONとして正常", false);
    }
  }

  summarize(passed, failed);
}

function summarize(passed: number, failed: number): void {
  process.stdout.write("\n========================================\n");
  process.stdout.write(`  結果: ${passed}件 PASS / ${failed}件 FAIL\n`);
  if (failed === 0) {
    process.stdout.write("  楽天API連携テスト完了！全テスト成功\n");
  } else {
    process.stdout.write("  一部テストが失敗しました。\n");
  }
  process.stdout.write("========================================\n\n");
  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch((e) => {
  process.stderr.write(`[Test] Fatal error: ${e}\n`);
  process.exit(1);
});
