import { Product } from "../schemas/product";
import { SearchParams } from "../schemas/search";

const COLOR_ALIASES: Record<string, string[]> = {
  "白": ["ホワイト", "白", "アイボリー", "オフホワイト"],
  "ホワイト": ["ホワイト", "白", "アイボリー", "オフホワイト"],
  "黒": ["ブラック", "黒", "チャコール"],
  "ブラック": ["ブラック", "黒", "チャコール"],
  "茶": ["ブラウン", "茶", "ダークブラウン", "ライトブラウン", "ミドルブラウン", "ウォールナット"],
  "ブラウン": ["ブラウン", "茶", "ダークブラウン", "ライトブラウン", "ミドルブラウン", "ウォールナット"],
  "木目": ["ナチュラル", "木目", "ライトブラウン", "オーク", "パイン"],
  "ナチュラル": ["ナチュラル", "木目", "ライトブラウン", "オーク"],
  "グレー": ["グレー", "グレイ", "灰色", "シルバー"],
  "灰色": ["グレー", "グレイ", "灰色", "シルバー"],
  "ピンク": ["ピンク", "ローズ", "桜"],
  "赤": ["レッド", "赤", "ワインレッド"],
  "青": ["ブルー", "青", "ネイビー"],
  "緑": ["グリーン", "緑", "カーキ"],
};

function matchesColor(productColor: string | undefined, queryColor: string): boolean {
  if (!productColor) return false;
  const lowerProduct = productColor.toLowerCase();
  const lowerQuery = queryColor.toLowerCase();
  if (lowerProduct.includes(lowerQuery) || lowerQuery.includes(lowerProduct)) return true;
  const aliases = COLOR_ALIASES[queryColor];
  if (aliases) {
    return aliases.some((a) => lowerProduct.includes(a.toLowerCase()));
  }
  return false;
}

function matchesKeyword(product: Product, keyword: string): boolean {
  const lower = keyword.toLowerCase();
  const tokens = lower.split(/[\s　]+/).filter(Boolean);
  const searchable = [
    product.name,
    product.category,
    product.color || "",
    product.material || "",
    product.description || "",
    ...(product.tags || []),
  ].join(" ").toLowerCase();

  return tokens.every((token) => searchable.includes(token));
}

/**
 * 検索パラメータに基づいて商品をフィルタリングする
 */
export function filterProducts(products: Product[], params: SearchParams): Product[] {
  return products.filter((p) => {
    if (params.in_stock_only && !p.in_stock) return false;

    if (params.keyword !== undefined && !matchesKeyword(p, params.keyword)) return false;

    if (params.width_mm_min !== undefined && p.width_mm < params.width_mm_min) return false;
    if (params.width_mm_max !== undefined && p.width_mm > params.width_mm_max) return false;
    if (params.height_mm_min !== undefined && p.height_mm < params.height_mm_min) return false;
    if (params.height_mm_max !== undefined && p.height_mm > params.height_mm_max) return false;
    if (params.depth_mm_min !== undefined && p.depth_mm < params.depth_mm_min) return false;
    if (params.depth_mm_max !== undefined && p.depth_mm > params.depth_mm_max) return false;

    if (params.price_max !== undefined && p.price > params.price_max) return false;
    if (params.price_min !== undefined && p.price < params.price_min) return false;

    if (params.color !== undefined && !matchesColor(p.color, params.color)) return false;

    if (params.brand !== undefined) {
      const brandLower = params.brand.toLowerCase();
      const hasBrand = p.tags?.some((t) => t.toLowerCase().includes(brandLower))
        || p.name.toLowerCase().includes(brandLower);
      if (!hasBrand) return false;
    }

    if (
      params.category !== undefined &&
      !p.category.includes(params.category) &&
      !p.tags.some((t) => t.includes(params.category!))
    )
      return false;

    return true;
  });
}

/**
 * ミスの原因を推定する（Gap Analysis用）
 */
export function detectMissReason(params: SearchParams): string {
  const hasSizeFilter =
    params.width_mm_min !== undefined ||
    params.width_mm_max !== undefined ||
    params.height_mm_min !== undefined ||
    params.height_mm_max !== undefined ||
    params.depth_mm_min !== undefined ||
    params.depth_mm_max !== undefined;
  if (hasSizeFilter) return "no_matching_size";
  if (params.price_max !== undefined || params.price_min !== undefined) return "no_matching_price";
  if (params.color !== undefined) return "no_matching_color";
  if (params.category !== undefined) return "no_matching_category";
  return "no_results";
}
