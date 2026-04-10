import { Product } from "../schemas/product";
import { SearchParams } from "../schemas/search";

/**
 * 検索パラメータに基づいて商品をフィルタリングする
 */
export function filterProducts(products: Product[], params: SearchParams): Product[] {
  return products.filter((p) => {
    if (params.in_stock_only && !p.in_stock) return false;

    if (params.width_mm_min !== undefined && p.width_mm < params.width_mm_min) return false;
    if (params.width_mm_max !== undefined && p.width_mm > params.width_mm_max) return false;
    if (params.height_mm_min !== undefined && p.height_mm < params.height_mm_min) return false;
    if (params.height_mm_max !== undefined && p.height_mm > params.height_mm_max) return false;
    if (params.depth_mm_min !== undefined && p.depth_mm < params.depth_mm_min) return false;
    if (params.depth_mm_max !== undefined && p.depth_mm > params.depth_mm_max) return false;

    if (params.price_max !== undefined && p.price > params.price_max) return false;
    if (params.price_min !== undefined && p.price < params.price_min) return false;

    if (params.color !== undefined && p.color !== params.color) return false;

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
