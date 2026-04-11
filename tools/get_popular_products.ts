import {
  KNOWN_PRODUCTS_DB,
  getProductCategory,
  ProductCategory,
} from "../shared/catalog/known_products";
import { logAnalytics, buildHitLog } from "../utils/logger";
import {
  attachAffiliateUrls,
  logConversions,
} from "../services/affiliate";
import { searchRakutenProducts } from "../adapters/rakuten_api";
import { buildRakutenAffiliateUrl } from "../adapters/rakuten";
import { getSeasonalHints, getTrendTags } from "../data/seasonal_hints";

export interface PopularProductsResult {
  products: Array<{
    name: string;
    brand: string;
    series: string;
    category: string;
    price_range: string;
    outer_dimensions: string;
    visual_features: string[];
    affiliate_url?: string;
    trend_tags?: string[];
  }>;
  total: number;
  miss: boolean;
  category_filter?: string;
  brand_filter?: string;
  seasonal_hints: string[];
  rakuten_trending?: Array<{
    name: string;
    price: number;
    review_count: number;
    review_average: number;
    affiliate_url: string;
  }>;
}

export async function getPopularProducts(rawInput: unknown): Promise<PopularProductsResult> {
  const params = rawInput as {
    intent: string;
    category?: string;
    brand?: string;
    limit?: number;
    include_rakuten_trending?: boolean;
  };

  const limit = Math.min(params.limit ?? 10, 30);
  let filtered = [...KNOWN_PRODUCTS_DB];

  if (params.category) {
    filtered = filtered.filter((p) => getProductCategory(p) === params.category);
  }
  if (params.brand) {
    const brandLower = params.brand.toLowerCase();
    filtered = filtered.filter((p) => p.brand.toLowerCase().includes(brandLower));
  }

  filtered.sort((a, b) => {
    const aScore = a.compatible_storage.length * 10 + a.visual_features.length * 3 + (a.consumables.length > 0 ? 5 : 0);
    const bScore = b.compatible_storage.length * 10 + b.visual_features.length * 3 + (b.consumables.length > 0 ? 5 : 0);
    return bScore - aScore;
  });

  const topProducts = filtered.slice(0, limit);

  const logEntry = buildHitLog("get_popular_products", {
    category: params.category,
    brand: params.brand,
  }, params.intent, topProducts.length);
  logAnalytics(logEntry).catch((e) => console.error("[Analytics]", e));

  if (topProducts.length === 0) {
    return {
      products: [],
      total: 0,
      miss: true,
      category_filter: params.category,
      brand_filter: params.brand,
      seasonal_hints: getSeasonalHints(),
    };
  }

  let rakutenTrending: PopularProductsResult["rakuten_trending"];
  if (params.include_rakuten_trending !== false) {
    try {
      const keyword = params.category ?? params.brand ?? "家具 収納 人気";
      const rakutenResult = await searchRakutenProducts({
        keyword,
        sort: "-reviewCount",
        hits: 5,
      });
      rakutenTrending = rakutenResult.products.map((rp) => ({
        name: rp.name,
        price: rp.price,
        review_count: rp.review_count ?? 0,
        review_average: rp.review_average ?? 0,
        affiliate_url: rp.affiliate_url ?? buildRakutenAffiliateUrl(
          rp.url ?? "",
          process.env.AFFILIATE_ID_RAKUTEN ?? "",
          process.env.UTM_SOURCE ?? "mcp_hub",
          process.env.UTM_MEDIUM ?? "ai_agent",
        ),
      }));
    } catch {
      rakutenTrending = undefined;
    }
  }

  return {
    products: topProducts.map((p) => {
      const cat = getProductCategory(p);
      const tags = getTrendTags(cat);
      return {
        name: p.name,
        brand: p.brand,
        series: p.series,
        category: cat,
        price_range: `¥${p.price_range.min.toLocaleString()}~¥${p.price_range.max.toLocaleString()}`,
        outer_dimensions: `${p.outer_width_mm}×${p.outer_depth_mm}×${p.outer_height_mm}mm`,
        visual_features: p.visual_features,
        affiliate_url: p.url_template.replace("{model_number}", p.model_number),
        ...(tags.length > 0 && { trend_tags: tags }),
      };
    }),
    total: topProducts.length,
    miss: false,
    category_filter: params.category,
    brand_filter: params.brand,
    seasonal_hints: getSeasonalHints(),
    rakuten_trending: rakutenTrending,
  };
}
