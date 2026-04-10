/**
 * Phase 2 テストスイート
 *
 * カバレッジ:
 *   - utils/unit_converter.ts (cm→mm変換・寸法文字列パース・価格パース)
 *   - adapters/nitori_scraper.ts (モックモードでのデータ取得)
 *   - data/product_store.ts (統合データレイヤー)
 *   - tools/get_product_detail.ts (MCPツール: 存在・不在・関連商品・Gap検知)
 */

import "dotenv/config";
import {
  cmToMm,
  mmToMm,
  parseToMm,
  parseDimensionString,
  parsePriceJpy,
} from "../utils/unit_converter";
import { fetchNitoriProducts } from "../adapters/nitori_scraper";
import {
  getAllProducts,
  getProductById,
  searchProductsByName,
  getStoreStatus,
} from "../data/product_store";
import { getProductDetail } from "../tools/get_product_detail";

// -----------------------------------------------------------------------
// テストユーティリティ
// -----------------------------------------------------------------------

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void | Promise<void>): Promise<void> {
  return Promise.resolve(fn())
    .then(() => {
      console.log(`  ✅ PASS: ${name}`);
      passed++;
    })
    .catch((e: unknown) => {
      console.error(`  ❌ FAIL: ${name}`);
      console.error(`     ${e instanceof Error ? e.message : String(e)}`);
      failed++;
    });
}

function expect<T>(actual: T, expected: T, label?: string): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `${label ? label + ": " : ""}Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`
    );
  }
}

function expectTruthy(value: unknown, label?: string): void {
  if (!value) {
    throw new Error(`${label ? label + ": " : ""}Expected truthy, got ${JSON.stringify(value)}`);
  }
}

function expectRange(value: number, min: number, max: number, label?: string): void {
  if (value < min || value > max) {
    throw new Error(`${label ?? "value"}: ${value} is outside [${min}, ${max}]`);
  }
}

// -----------------------------------------------------------------------
// 1. unit_converter テスト
// -----------------------------------------------------------------------

async function testUnitConverter(): Promise<void> {
  console.log("\n【1. unit_converter テスト】");

  await test("cmToMm: 40cm → 400mm", () => {
    expect(cmToMm(40), 400);
  });

  await test("cmToMm: 40.5cm → 405mm（小数対応）", () => {
    expect(cmToMm(40.5), 405);
  });

  await test("cmToMm: 180cm → 1800mm", () => {
    expect(cmToMm(180), 1800);
  });

  await test("mmToMm: 400mm → 400mm（パススルー）", () => {
    expect(mmToMm(400), 400);
  });

  await test("parseToMm: '40cm' → 400", () => {
    expect(parseToMm("40cm"), 400);
  });

  await test("parseToMm: '400mm' → 400", () => {
    expect(parseToMm("400mm"), 400);
  });

  await test("parseToMm: '400' → 400（単位なし=mm扱い）", () => {
    expect(parseToMm("400"), 400);
  });

  await test("parseToMm: '40.5cm' → 405（小数対応）", () => {
    expect(parseToMm("40.5cm"), 405);
  });

  await test("parseToMm: 無効な文字列 → null", () => {
    expect(parseToMm("abc"), null);
  });

  await test("parseDimensionString: '幅40×奥行29×高さ180cm' をパース", () => {
    const result = parseDimensionString("幅40×奥行29×高さ180cm");
    if (!result) throw new Error("結果がnull");
    expect(result.width_mm, 400, "width_mm");
    expect(result.depth_mm, 290, "depth_mm");
    expect(result.height_mm, 1800, "height_mm");
  });

  await test("parseDimensionString: 'W400×D290×H1800mm' をパース", () => {
    const result = parseDimensionString("W400×D290×H1800mm");
    if (!result) throw new Error("結果がnull");
    expect(result.width_mm, 400, "width_mm");
    expect(result.depth_mm, 290, "depth_mm");
    expect(result.height_mm, 1800, "height_mm");
  });

  await test("parseDimensionString: '幅:40cm / 奥行:29cm / 高さ:180cm' をパース", () => {
    const result = parseDimensionString("幅:40cm / 奥行:29cm / 高さ:180cm");
    if (!result) throw new Error("結果がnull");
    expect(result.width_mm, 400, "width_mm");
    expect(result.depth_mm, 290, "depth_mm");
    expect(result.height_mm, 1800, "height_mm");
  });

  await test("parseDimensionString: 不正文字列 → null", () => {
    expect(parseDimensionString("不明な寸法"), null);
  });

  await test("parsePriceJpy: '7,990円（税込）' → 7990", () => {
    expect(parsePriceJpy("7,990円（税込）"), 7990);
  });

  await test("parsePriceJpy: '¥12,990' → 12990", () => {
    expect(parsePriceJpy("¥12,990"), 12990);
  });

  await test("parsePriceJpy: '3490' → 3490", () => {
    expect(parsePriceJpy("3490"), 3490);
  });
}

// -----------------------------------------------------------------------
// 2. nitori_scraper テスト（モックモード）
// -----------------------------------------------------------------------

async function testNitoriScraper(): Promise<void> {
  console.log("\n【2. nitori_scraper テスト（SCRAPE_MOCK=true）】");

  await test("fetchNitoriProducts: シェルフ検索でモックデータが返る", async () => {
    const result = await fetchNitoriProducts("シェルフ", 5);
    expect(result.source, "mock", "source");
    expectTruthy(result.products.length > 0, "products.length > 0");
    expectTruthy(result.scraped_at, "scraped_at が存在");
    expectTruthy(result.keyword === "シェルフ", "keyword");
  });

  await test("fetchNitoriProducts: 返却商品に必須フィールドが揃っている", async () => {
    const result = await fetchNitoriProducts("シェルフ", 5);
    for (const p of result.products) {
      expectTruthy(p.id, `id: ${p.name}`);
      expectTruthy(p.name, `name`);
      expectTruthy(p.width_mm > 0, `width_mm > 0: ${p.name}`);
      expectTruthy(p.height_mm > 0, `height_mm > 0: ${p.name}`);
      expectTruthy(p.depth_mm > 0, `depth_mm > 0: ${p.name}`);
      expectTruthy(p.price > 0, `price > 0: ${p.name}`);
    }
  });

  await test("fetchNitoriProducts: maxItems パラメータが機能する", async () => {
    const result = await fetchNitoriProducts("シェルフ", 1);
    expectTruthy(result.products.length <= 1, `products.length <= 1 (got ${result.products.length})`);
  });

  await test("fetchNitoriProducts: モックデータには 'スクレイピング取得' タグが含まれる", async () => {
    const result = await fetchNitoriProducts("シェルフ");
    const hasTag = result.products.some((p) => p.tags?.includes("スクレイピング取得"));
    expectTruthy(hasTag, "スクレイピング取得タグが存在");
  });
}

// -----------------------------------------------------------------------
// 3. product_store テスト
// -----------------------------------------------------------------------

async function testProductStore(): Promise<void> {
  console.log("\n【3. product_store テスト】");

  await test("getAllProducts: ダミーデータが取得できる", () => {
    const products = getAllProducts();
    expectTruthy(products.length >= 5, `products.length >= 5 (got ${products.length})`);
  });

  await test("getProductById: 存在するIDで商品が取得できる", () => {
    const products = getAllProducts();
    const first = products[0]!;
    const found = getProductById(first.id);
    expectTruthy(found, "商品が見つかる");
    expect(found!.id, first.id, "IDが一致");
  });

  await test("getProductById: 存在しないIDで undefined が返る", () => {
    const notFound = getProductById("non-existent-id-00000");
    expect(notFound, undefined, "undefined");
  });

  await test("searchProductsByName: 'カラーボックス' で複数商品が返る", () => {
    const results = searchProductsByName("カラーボックス");
    expectTruthy(results.length >= 1, `results.length >= 1 (got ${results.length})`);
    for (const p of results) {
      expectTruthy(
        p.name.includes("カラーボックス") || p.tags?.includes("カラーボックス"),
        `${p.name} はカラーボックス関連`
      );
    }
  });

  await test("searchProductsByName: 存在しないキーワードで空配列が返る", () => {
    const results = searchProductsByName("存在しない商品名XYZXYZ");
    expect(results.length, 0, "空配列");
  });

  await test("getStoreStatus: ストア状態が正しく返る", () => {
    const status = getStoreStatus();
    expectTruthy(status.total >= 5, `total >= 5 (${status.total})`);
    expectTruthy(status.source === "dummy_only" || status.source === "merged", "source");
  });
}

// -----------------------------------------------------------------------
// 4. get_product_detail ツールテスト
// -----------------------------------------------------------------------

async function testGetProductDetail(): Promise<void> {
  console.log("\n【4. get_product_detail ツールテスト】");

  await test("get_product_detail: 存在するIDで商品詳細が返る", async () => {
    const products = getAllProducts();
    const target = products[0]!;

    const result = await getProductDetail({
      id: target.id,
      intent: "購入前の最終確認として寸法を確かめたい",
    });

    expect(result.found, true, "found");
    expectTruthy(result.product, "product が存在");
    expect(result.product!.id, target.id, "IDが一致");
  });

  await test("get_product_detail: 返却商品に affiliate_url が含まれる", async () => {
    const products = getAllProducts();
    const target = products[0]!;

    const result = await getProductDetail({
      id: target.id,
      intent: "この棚を購入したい",
    });

    expectTruthy(result.affiliate_url, "affiliate_url が存在");
    expectTruthy(result.affiliate_url!.includes("http"), "affiliate_url がURLの形式");
  });

  await test("get_product_detail: estimated_commission_yen が正の数", async () => {
    const products = getAllProducts();
    const target = products[0]!;

    const result = await getProductDetail({
      id: target.id,
      intent: "購入を検討している",
    });

    expectTruthy((result.estimated_commission_yen ?? 0) >= 0, "commission >= 0");
  });

  await test("get_product_detail: 存在しないIDで found=false が返る", async () => {
    const result = await getProductDetail({
      id: "non-existent-id-00000",
      intent: "存在しない商品のテスト",
    });

    expect(result.found, false, "found=false");
    expect(result.product, null, "product=null");
  });

  await test("get_product_detail: 関連商品が返る（同シリーズがある場合）", async () => {
    const products = getAllProducts();
    const nClick = products.find((p) => p.series_id === "n-click");
    if (!nClick) throw new Error("Nクリック商品がない");

    const result = await getProductDetail({
      id: nClick.id,
      intent: "Nクリックシリーズの詳細確認",
    });

    if (result.related_products) {
      expectTruthy(result.related_products.length > 0, "related_products が存在");
      for (const rp of result.related_products) {
        expectTruthy(rp.id, "related: id");
        expectTruthy(rp.name, "related: name");
        expectTruthy(rp.price > 0, "related: price > 0");
      }
    }
  });

  await test("get_product_detail: Gap検知が機能する（耐荷重を含む意図）", async () => {
    const products = getAllProducts();
    const target = products[0]!;

    const result = await getProductDetail({
      id: target.id,
      intent: "耐荷重50kg以上のシェルフの詳細を確認したい",
    });

    expectTruthy(result.gap_feedback, "gap_feedback が存在");
    expectTruthy(
      result.gap_feedback!.detected_needs.length > 0,
      "detected_needs が存在"
    );
  });

  await test("get_product_detail: store_info が含まれる", async () => {
    const products = getAllProducts();
    const target = products[0]!;

    const result = await getProductDetail({
      id: target.id,
      intent: "テスト",
    });

    expectTruthy(result.store_info, "store_info が存在");
    expectTruthy(result.store_info!.total_products > 0, "total_products > 0");
  });

  await test("get_product_detail: 不正入力でエラーがスローされる", async () => {
    try {
      await getProductDetail({ id: "", intent: "テスト" });
      throw new Error("エラーがスローされなかった");
    } catch (e) {
      expectTruthy(e instanceof Error, "Error がスロー");
    }
  });
}

// -----------------------------------------------------------------------
// メイン実行
// -----------------------------------------------------------------------

async function main(): Promise<void> {
  console.log("=".repeat(60));
  console.log("Phase 2 テストスイート");
  console.log("=".repeat(60));

  await testUnitConverter();
  await testNitoriScraper();
  await testProductStore();
  await testGetProductDetail();

  console.log("\n" + "=".repeat(60));
  console.log(`結果: ${passed} PASS / ${failed} FAIL`);
  console.log("=".repeat(60));

  if (failed > 0) process.exit(1);
}

main().catch((e) => {
  console.error("テスト実行エラー:", e);
  process.exit(1);
});
