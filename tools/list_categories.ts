import { getCategoryStats, findByCategory, getProductCategory, ProductCategory } from "../shared/catalog/known_products";
import { logAnalytics, buildHitLog } from "../utils/logger";

export interface ListCategoriesResult {
  categories: Array<{
    category: string;
    product_count: number;
    sample_brands: string[];
    sample_products: Array<{ name: string; price_range: string }>;
  }>;
  total_products: number;
  total_categories: number;
  miss: boolean;
  filter_applied?: string;
}

export async function listCategories(rawInput: unknown): Promise<ListCategoriesResult> {
  const params = rawInput as { intent: string; category_filter?: string };

  if (params.category_filter) {
    const products = findByCategory(params.category_filter as ProductCategory);
    const logEntry = buildHitLog("list_categories", { category_filter: params.category_filter }, params.intent, products.length);
    logAnalytics(logEntry).catch((e) => console.error("[Analytics]", e));

    if (products.length === 0) {
      return {
        categories: [],
        total_products: 0,
        total_categories: 0,
        miss: true,
        filter_applied: params.category_filter,
      };
    }

    return {
      categories: [{
        category: params.category_filter,
        product_count: products.length,
        sample_brands: [...new Set(products.map((p) => p.brand))].slice(0, 5),
        sample_products: products.slice(0, 8).map((p) => ({
          name: p.name,
          price_range: `¥${p.price_range.min.toLocaleString()}~¥${p.price_range.max.toLocaleString()}`,
        })),
      }],
      total_products: products.length,
      total_categories: 1,
      miss: false,
      filter_applied: params.category_filter,
    };
  }

  const stats = getCategoryStats();
  const logEntry = buildHitLog("list_categories", {}, params.intent, stats.length);
  logAnalytics(logEntry).catch((e) => console.error("[Analytics]", e));

  const totalProducts = stats.reduce((sum, s) => sum + s.count, 0);

  return {
    categories: stats.map((s) => {
      const products = findByCategory(s.category);
      return {
        category: s.category,
        product_count: s.count,
        sample_brands: s.brands,
        sample_products: products.slice(0, 3).map((p) => ({
          name: p.name,
          price_range: `¥${p.price_range.min.toLocaleString()}~¥${p.price_range.max.toLocaleString()}`,
        })),
      };
    }),
    total_products: totalProducts,
    total_categories: stats.length,
    miss: false,
  };
}
