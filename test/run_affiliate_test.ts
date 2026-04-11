/**
 * Phase 1 v1.5 - アフィリエイト機能テスト
 */
import "dotenv/config";
import { searchProducts } from "../tools/search_products";
import { buildAffiliateUrl, estimateCommission } from "../services/affiliate";
import { readFile } from "fs/promises";

const CONVERSION_LOG_PATH = "logs/conversions.jsonl";

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
  process.stdout.write("  MCP Hub v1.5 - アフィリエイトテスト\n");
  process.stdout.write("========================================\n\n");

  // ─────────────────────────────────────────────────────────────────
  // Unit Tests: buildAffiliateUrl()
  // ─────────────────────────────────────────────────────────────────
  process.stdout.write("【UNIT TESTS: buildAffiliateUrl()】\n\n");

  // Test U1: ニトリURLの変換（ID未設定 → 元URLがそのまま返る）
  process.stdout.write("[U1] ニトリURL（ID未設定時は元URLを返す）\n");
  const u1 = buildAffiliateUrl("https://example.nitori.co.jp/products/shelf-40");
  process.stdout.write(`  結果: ${u1.affiliate_url}\n`);
  assert("platform=nitori", u1.platform === "nitori");
  const nitoriId = process.env["AFFILIATE_ID_NITORI"] ?? "";
  if (nitoriId) {
    assert("affiliate_url にアフィリエイトIDが含まれる", u1.affiliate_url.includes(nitoriId));
    assert("utm_source=mcp_hub が含まれる", u1.affiliate_url.includes("mcp_hub"));
  } else {
    assert("ID未設定時は元URLがそのまま返る", u1.affiliate_url === "https://example.nitori.co.jp/products/shelf-40");
  }

  // Test U2: Amazon URLの変換
  process.stdout.write("\n[U2] Amazon URLにアソシエイトタグが付与される\n");
  const u2 = buildAffiliateUrl("https://www.amazon.co.jp/dp/B0DUMMY001");
  process.stdout.write(`  結果: ${u2.affiliate_url}\n`);
  const amazonId = process.env["AFFILIATE_ID_AMAZON"] ?? "";
  assert("platform=amazon", u2.platform === "amazon");
  assert("tagパラメータが含まれる", u2.affiliate_url.includes("tag="));
  assert("本番Amazon IDが含まれる", amazonId ? u2.affiliate_url.includes(amazonId) : u2.affiliate_url === "https://www.amazon.co.jp/dp/B0DUMMY001");

  // Test U3: 楽天URLの変換
  process.stdout.write("\n[U3] 楽天URLがアフィリエイト形式に変換される\n");
  const u3 = buildAffiliateUrl("https://item.example-rakuten.co.jp/nitori/shelf-80/");
  process.stdout.write(`  結果: ${u3.affiliate_url.slice(0, 80)}...\n`);
  assert("platform=rakuten", u3.platform === "rakuten");
  assert("楽天アフィリエイトドメインを含む", u3.affiliate_url.includes("hb.afl.rakuten"));

  // Test U4: 不明URLの汎用フォールバック（ID未設定 → 元URLがそのまま返る）
  process.stdout.write("\n[U4] 不明なURLは generic アダプターにフォールバック\n");
  const u4 = buildAffiliateUrl("https://example.com/furniture/chair");
  process.stdout.write(`  結果: ${u4.affiliate_url}\n`);
  const genericId = process.env["AFFILIATE_ID_VALUECOMMERCE"] ?? "";
  assert("platform=generic", u4.platform === "generic");
  if (genericId) {
    assert("aff_id パラメータが含まれる", u4.affiliate_url.includes("aff_id="));
  } else {
    assert("ID未設定時は元URLがそのまま返る", u4.affiliate_url === "https://example.com/furniture/chair");
  }

  // Test U5: 報酬推定
  process.stdout.write("\n[U5] 報酬推定（estimateCommission）\n");
  const comm_nitori = estimateCommission(9990, "nitori");
  const comm_amazon = estimateCommission(9990, "amazon");
  process.stdout.write(`  ニトリ 9990円 → 推定報酬: ${comm_nitori}円\n`);
  process.stdout.write(`  Amazon 9990円 → 推定報酬: ${comm_amazon}円\n`);
  assert("ニトリの報酬が正の値", comm_nitori > 0);
  assert("Amazon の報酬 > ニトリの報酬（料率が高い）", comm_amazon > comm_nitori);

  // ─────────────────────────────────────────────────────────────────
  // Integration Tests: searchProducts() でのアフィリエイト付与
  // ─────────────────────────────────────────────────────────────────
  process.stdout.write("\n【INTEGRATION TESTS: searchProducts() + アフィリエイト】\n\n");

  // Test I1: 検索結果に affiliate_url が付与される
  process.stdout.write("[I1] 検索結果に affiliate_url が付与されること\n");
  const i1 = await searchProducts({
    price_max: 15000,
    in_stock_only: true,
    intent: "リビングに白い棚を置きたい。予算は15000円以内。シンプルなデザインが好み。",
  });
  process.stdout.write(`  ヒット: ${i1.total}件\n`);
  process.stdout.write(`  最初の商品の affiliate_url: ${i1.products[0]?.affiliate_url?.slice(0, 70)}...\n`);

  assert("ヒット件数が1以上", i1.total >= 1);
  assert("全商品に affiliate_url がある", i1.products.every((p) => p.affiliate_url !== ""));
  assert("affiliate_summary が返る", i1.affiliate_summary !== undefined);
  assert(
    "affiliate_summary.links_generated が正しい",
    i1.affiliate_summary?.links_generated === i1.total
  );
  assert(
    "estimated_commission_yen が正の値",
    (i1.affiliate_summary?.estimated_commission_yen ?? 0) > 0
  );

  // Test I2: ニトリURLの商品（ID未設定なら元URLが返る、設定済みならIDが含まれる）
  process.stdout.write("\n[I2] ニトリ商品のaffiliate_urlが正しく設定される\n");
  const nitoriProduct = i1.products.find((p) =>
    p.affiliate_platform === "nitori"
  );
  if (nitoriProduct) {
    process.stdout.write(`  商品: ${nitoriProduct.name}\n`);
    process.stdout.write(`  affiliate_url: ${nitoriProduct.affiliate_url}\n`);
    const nitoriIdI2 = process.env["AFFILIATE_ID_NITORI"] ?? "";
    if (nitoriIdI2) {
      assert("ニトリアフィリエイトID含む", nitoriProduct.affiliate_url?.includes(nitoriIdI2) ?? false);
    } else {
      assert("ID未設定時は元URL（nitori含む）が返る", nitoriProduct.affiliate_url?.includes("nitori") ?? false);
    }
  } else {
    assert("ニトリ商品が存在する", false);
  }

  // Test I3: affiliate_summary のプラットフォーム一覧
  process.stdout.write("\n[I3] platforms_represented が返される\n");
  const i3 = await searchProducts({
    in_stock_only: false,
    intent: "引っ越し用に複数の棚を揃えたい。全ラインナップを教えてほしい。",
  });
  process.stdout.write(`  プラットフォーム: ${i3.affiliate_summary?.platforms.join(", ")}\n`);
  assert("platformsが1種類以上", (i3.affiliate_summary?.platforms.length ?? 0) >= 1);

  // ─────────────────────────────────────────────────────────────────
  // Log Verification: conversions.jsonl
  // ─────────────────────────────────────────────────────────────────
  process.stdout.write("\n[VERIFY] conversions.jsonl の内容を確認\n");

  await new Promise((resolve) => setTimeout(resolve, 600));

  let convContent = "";
  try {
    convContent = await readFile(CONVERSION_LOG_PATH, "utf-8");
  } catch {
    assert("conversions.jsonl が存在する", false);
    summarize(passed, failed);
    return;
  }

  const convLines = convContent.trim().split("\n").filter((l) => l.length > 0);
  process.stdout.write(`  コンバージョンログ: ${convLines.length}件\n`);

  assert("conversions.jsonl に記録がある", convLines.length > 0);

  let parseErrors = 0;
  let affiliateIdFound = false;
  let priceFound = false;

  for (const line of convLines) {
    try {
      const entry = JSON.parse(line) as Record<string, unknown>;
      if (typeof entry["affiliate_url"] === "string" && entry["affiliate_url"].length > 0) {
        affiliateIdFound = true;
      }
      if (typeof entry["price"] === "number" && entry["price"] > 0) {
        priceFound = true;
      }
    } catch {
      parseErrors++;
    }
  }

  assert("全ログ行がJSONとして正常", parseErrors === 0);
  assert("affiliate_url が記録されている", affiliateIdFound);
  assert("price（報酬計算用）が記録されている", priceFound);

  // サンプル表示
  process.stdout.write("\n  --- コンバージョンログ サンプル（最新1件）---\n");
  const last = JSON.parse(convLines[convLines.length - 1]!) as Record<string, unknown>;
  process.stdout.write(`  ${JSON.stringify(last, null, 4)}\n`);

  summarize(passed, failed);
}

function summarize(passed: number, failed: number): void {
  process.stdout.write("\n========================================\n");
  process.stdout.write(`  結果: ${passed}件 PASS / ${failed}件 FAIL\n`);
  if (failed === 0) {
    process.stdout.write("  🎉 アフィリエイトテスト完了！全テスト成功\n");
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
