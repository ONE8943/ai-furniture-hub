/**
 * カタログDB検索・マッチングヘルパー
 */

import {
  KnownProduct,
  ProductCategory,
  ProductMatch,
  RelatedItem,
} from "./types";
import { KNOWN_PRODUCTS_DB } from "./products_db";

/**
 * 型番（または型番を含む文字列）で既知製品を1件返す。
 */
export function findProductByModelNumber(raw: string): KnownProduct | undefined {
  const q = raw.normalize("NFKC").trim().toLowerCase();
  if (!q) return undefined;
  const byExact = KNOWN_PRODUCTS_DB.find((p) => p.model_number && p.model_number.toLowerCase() === q);
  if (byExact) return byExact;
  return KNOWN_PRODUCTS_DB.find(
    (p) => p.model_number && (q.includes(p.model_number.toLowerCase()) || p.model_number.toLowerCase().includes(q))
  );
}

/**
 * 特徴テキストから既知製品を検索し、マッチ度付きで返す。
 * AIが画像解析で抽出した特徴（色、形状、ブランド名、段数等）をテキストで受け取る。
 */
export function findMatchingProducts(featureText: string, maxResults: number = 5): ProductMatch[] {
  const lower = featureText.normalize("NFKC").toLowerCase();
  const results: ProductMatch[] = [];

  for (const product of KNOWN_PRODUCTS_DB) {
    let score = 0;
    const reasons: string[] = [];

    if (lower.includes(product.brand.toLowerCase())) {
      score += 30;
      reasons.push(`ブランド「${product.brand}」一致`);
    }

    if (lower.includes(product.series.toLowerCase())) {
      score += 25;
      reasons.push(`シリーズ「${product.series}」一致`);
    }

    if (lower.includes(product.model_number.toLowerCase())) {
      score += 50;
      reasons.push(`型番「${product.model_number}」完全一致`);
    }

    for (const color of product.colors) {
      if (lower.includes(color.toLowerCase())) {
        score += 10;
        reasons.push(`色「${color}」一致`);
        break;
      }
    }

    const tierMatch = lower.match(/(\d+)\s*段/);
    if (tierMatch && parseInt(tierMatch[1]!) === product.tiers) {
      score += 15;
      reasons.push(`段数「${product.tiers}段」一致`);
    }

    if (lower.includes("スチール") && product.material.includes("スチール")) {
      score += 10;
      reasons.push("素材「スチール」一致");
    }
    if (lower.includes("木") && (product.material.includes("木") || product.material.includes("オーク"))) {
      score += 10;
      reasons.push("素材「木」一致");
    }

    for (const feature of product.visual_features) {
      const featureLower = feature.toLowerCase();
      const featureKeywords = featureLower.split(/[、。\s]+/).filter((w) => w.length >= 2);
      for (const kw of featureKeywords) {
        if (lower.includes(kw)) {
          score += 5;
          reasons.push(`特徴「${kw}」一致`);
        }
      }
    }

    const widthMatch = lower.match(/幅\s*(\d+)/);
    if (widthMatch) {
      const w = parseInt(widthMatch[1]!) * 10;
      if (Math.abs(w - product.outer_width_mm) < 30) {
        score += 15;
        reasons.push(`幅(${product.outer_width_mm}mm)が近似`);
      }
    }

    if (score > 0) {
      const confidence = Math.min(score, 100);
      results.push({ product, confidence, match_reasons: reasons });
    }
  }

  results.sort((a, b) => b.confidence - a.confidence);
  return results.slice(0, maxResults);
}

/**
 * 寸法で既知製品を検索する。空きスペースに入る製品を返す。
 */
export function findByDimensions(
  maxWidth: number, maxDepth: number, maxHeight: number
): KnownProduct[] {
  return KNOWN_PRODUCTS_DB.filter(
    (p) =>
      p.outer_width_mm <= maxWidth &&
      p.outer_depth_mm <= maxDepth &&
      p.outer_height_mm <= maxHeight
  );
}

export function getProductCategory(product: KnownProduct): ProductCategory {
  return product.category || "その他";
}

export function getProductRelatedItems(productId: string): RelatedItem[] {
  const product = KNOWN_PRODUCTS_DB.find((p) => p.id === productId);
  return product?.related_items || [];
}

export function getProductBuyGuide(productId: string): KnownProduct["buy_guide"] | undefined {
  const product = KNOWN_PRODUCTS_DB.find((p) => p.id === productId);
  return product?.buy_guide;
}

export function getRelatedChainDeep(
  productId: string,
  depth: number = 2,
): Array<{ item: RelatedItem; sub_items: RelatedItem[] }> {
  const items = getProductRelatedItems(productId);
  if (depth <= 1) return items.map((item) => ({ item, sub_items: [] }));
  return items.map((item) => ({
    item,
    sub_items: item.product_id
      ? getProductRelatedItems(item.product_id)
      : [],
  }));
}

export function getCategoryStats(): Array<{
  category: ProductCategory;
  count: number;
  brands: string[];
}> {
  const map = new Map<string, { count: number; brands: Set<string> }>();
  for (const p of KNOWN_PRODUCTS_DB) {
    const cat = p.category || "その他";
    if (!map.has(cat)) map.set(cat, { count: 0, brands: new Set() });
    const entry = map.get(cat)!;
    entry.count++;
    entry.brands.add(p.brand);
  }
  return [...map.entries()].map(([category, { count, brands }]) => ({
    category: category as ProductCategory,
    count,
    brands: [...brands],
  }));
}

export function findByCategory(category: ProductCategory): KnownProduct[] {
  return KNOWN_PRODUCTS_DB.filter(
    (p) => (p.category || "その他") === category,
  );
}
