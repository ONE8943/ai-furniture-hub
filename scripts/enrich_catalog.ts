/**
 * カタログ情報補強スクリプト（Gemini Flash 利用）
 *
 * usage: npx ts-node scripts/enrich_catalog.ts
 *
 * 既存の known_products.ts の製品を読み込み、
 * 寸法データが不完全な製品を検出してレポートする。
 * --ai フラグ付きで Gemini API を使った補完候補を生成する。
 */
import "dotenv/config";
import {
  KNOWN_PRODUCTS_DB,
  KnownProduct,
} from "../shared/catalog/known_products";

interface QualityIssue {
  id: string;
  name: string;
  brand: string;
  issues: string[];
}

function auditProduct(p: KnownProduct): string[] {
  const issues: string[] = [];

  if (p.inner_width_mm <= 0 || p.inner_depth_mm <= 0 || p.inner_height_per_tier_mm <= 0) {
    issues.push("内寸データ不完全");
  }
  if (p.compatible_storage.length === 0 && p.tiers >= 2) {
    issues.push("互換収納なし（2段以上で互換が欲しい）");
  }
  if (p.consumables.length === 0 && p.material.includes("スチール")) {
    issues.push("消耗品/オプション品なし（スチール製品は追加棚板等が多い）");
  }
  if (p.visual_features.length < 3) {
    issues.push("視覚的特徴が少ない（identify_product の精度に影響）");
  }
  if (p.colors.length <= 1) {
    issues.push("色バリエーション情報が少ない");
  }
  if (p.price_range.min === 0 || p.price_range.max === 0) {
    issues.push("価格情報なし");
  }
  if (p.weight_kg <= 0) {
    issues.push("重量情報なし");
  }

  return issues;
}

function main(): void {
  const useAi = process.argv.includes("--ai");

  console.log("\n=== Catalog Quality Audit ===\n");
  console.log(`Total products: ${KNOWN_PRODUCTS_DB.length}`);

  const brandCounts: Record<string, number> = {};
  for (const p of KNOWN_PRODUCTS_DB) {
    brandCounts[p.brand] = (brandCounts[p.brand] ?? 0) + 1;
  }
  console.log("\nBrand distribution:");
  for (const [brand, count] of Object.entries(brandCounts).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${brand}: ${count}`);
  }

  const issueList: QualityIssue[] = [];
  for (const p of KNOWN_PRODUCTS_DB) {
    const issues = auditProduct(p);
    if (issues.length > 0) {
      issueList.push({ id: p.id, name: p.name, brand: p.brand, issues });
    }
  }

  console.log(`\nProducts with issues: ${issueList.length}/${KNOWN_PRODUCTS_DB.length}`);
  console.log("");

  for (const item of issueList) {
    console.log(`[${item.brand}] ${item.name} (${item.id})`);
    for (const issue of item.issues) {
      console.log(`  - ${issue}`);
    }
  }

  const withCompat = KNOWN_PRODUCTS_DB.filter((p) => p.compatible_storage.length > 0);
  const withConsumables = KNOWN_PRODUCTS_DB.filter((p) => p.consumables.length > 0);
  const discontinued = KNOWN_PRODUCTS_DB.filter((p) => p.discontinued);

  console.log("\n=== Summary ===");
  console.log(`Products with compatible storage: ${withCompat.length}`);
  console.log(`Products with consumables: ${withConsumables.length}`);
  console.log(`Discontinued products: ${discontinued.length}`);

  if (useAi) {
    console.log("\n[AI Mode] Gemini-based enrichment not yet implemented.");
    console.log("Future: will call Gemini to suggest inner dimensions and compatible storage for products with issues.");
  }

  console.log("\n=== End of Audit ===\n");
}

main();
