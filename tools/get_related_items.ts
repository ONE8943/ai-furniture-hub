import {
  KNOWN_PRODUCTS_DB,
  KnownProduct,
  RelatedItem,
  getProductRelatedItems,
  getProductCategory,
  getRelatedChainDeep,
  findMatchingProducts,
} from "../shared/catalog/known_products";
import { logAnalytics, buildHitLog, buildMissLog } from "../utils/logger";
import { searchRakutenProducts } from "../adapters/rakuten_api";

interface RelatedItemResult {
  relation: string;
  name: string;
  category: string;
  why: string;
  required: boolean;
  price_range?: { min: number; max: number };
  search_keywords: string[];
  db_product?: {
    id: string;
    brand: string;
    name: string;
    price_range: { min: number; max: number };
    outer_dimensions: string;
  };
  rakuten_results?: Array<{
    name: string;
    price: number;
    affiliate_url: string;
    image_url?: string;
    review_count?: number;
  }>;
  sub_items?: RelatedItemResult[];
}

export interface GetRelatedItemsResult {
  source_product: {
    id: string;
    name: string;
    brand: string;
    category: string;
  } | null;
  related_items: RelatedItemResult[];
  required_count: number;
  recommended_count: number;
  total_related: number;
  estimated_total_cost?: { min: number; max: number };
  miss: boolean;
}

async function enrichWithRakuten(ri: RelatedItem): Promise<RelatedItemResult["rakuten_results"]> {
  try {
    const keyword = ri.search_keywords[0];
    if (!keyword) return undefined;
    const result = await searchRakutenProducts({ keyword, hits: 3, sort: "-reviewCount" });
    return result.products.map((rp) => ({
      name: rp.name,
      price: rp.price,
      affiliate_url: rp.affiliate_url ?? rp.url ?? "",
      image_url: rp.image_url,
      review_count: rp.review_count,
    }));
  } catch {
    return undefined;
  }
}

export async function getRelatedItems(rawInput: unknown): Promise<GetRelatedItemsResult> {
  const params = rawInput as {
    intent: string;
    product_id?: string;
    keyword?: string;
    include_rakuten?: boolean;
    depth?: number;
  };

  let product: KnownProduct | undefined;

  if (params.product_id) {
    product = KNOWN_PRODUCTS_DB.find((p) => p.id === params.product_id);
  }
  if (!product && params.keyword) {
    const matches = findMatchingProducts(params.keyword, 1);
    if (matches.length > 0 && matches[0]!.confidence >= 20) {
      product = matches[0]!.product;
    }
  }

  if (!product) {
    const logEntry = buildMissLog("get_related_items", {
      product_id: params.product_id, keyword: params.keyword,
    }, params.intent, "product_not_found");
    logAnalytics(logEntry).catch((e) => console.error("[Analytics]", e));

    return {
      source_product: null,
      related_items: [],
      required_count: 0,
      recommended_count: 0,
      total_related: 0,
      miss: true,
    };
  }

  const relatedItems = getProductRelatedItems(product.id);
  const includeRakuten = params.include_rakuten !== false;
  const useDeep = (params.depth ?? 1) >= 2;

  let results: RelatedItemResult[];

  if (useDeep) {
    const deepChain = getRelatedChainDeep(product.id);
    const deepItemsIfAny = deepChain.length > 0 ? deepChain : relatedItems.map((ri) => ({
      item: { ...ri, resolved_product: ri.product_id ? KNOWN_PRODUCTS_DB.find((p) => p.id === ri.product_id) : undefined },
      sub_items: [],
    }));

    results = await Promise.all(deepItemsIfAny.map(async ({ item, sub_items }) => {
      const rakuten = includeRakuten ? await enrichWithRakuten(item) : undefined;
      const subResults = await Promise.all(sub_items.map(async (si) => {
        const subRakuten = includeRakuten ? await enrichWithRakuten(si) : undefined;
        return buildResult(si, subRakuten);
      }));
      const r = buildResult(item, rakuten);
      if (subResults.length > 0) r.sub_items = subResults;
      return r;
    }));
  } else {
    results = await Promise.all(relatedItems.map(async (ri) => {
      const resolved = ri.product_id ? KNOWN_PRODUCTS_DB.find((p) => p.id === ri.product_id) : undefined;
      const rakuten = includeRakuten ? await enrichWithRakuten(ri) : undefined;
      return buildResult({ ...ri, resolved_product: resolved }, rakuten);
    }));
  }

  const requiredCount = results.filter((r) => r.required).length;
  const recommendedCount = results.length - requiredCount;

  let estimatedMin = 0;
  let estimatedMax = 0;
  for (const r of results) {
    if (r.price_range) {
      estimatedMin += r.price_range.min;
      estimatedMax += r.price_range.max;
    }
  }

  const logEntry = buildHitLog("get_related_items", {
    product_id: product.id, keyword: params.keyword,
  }, params.intent, results.length);
  logAnalytics(logEntry).catch((e) => console.error("[Analytics]", e));

  return {
    source_product: {
      id: product.id,
      name: product.name,
      brand: product.brand,
      category: getProductCategory(product),
    },
    related_items: results,
    required_count: requiredCount,
    recommended_count: recommendedCount,
    total_related: results.length,
    estimated_total_cost: estimatedMax > 0 ? { min: estimatedMin, max: estimatedMax } : undefined,
    miss: false,
  };
}

function buildResult(
  item: RelatedItem & { resolved_product?: KnownProduct },
  rakuten: RelatedItemResult["rakuten_results"],
): RelatedItemResult {
  return {
    relation: item.relation,
    name: item.name,
    category: item.category,
    why: item.why,
    required: item.required,
    price_range: item.price_range,
    search_keywords: item.search_keywords,
    db_product: item.resolved_product ? {
      id: item.resolved_product.id,
      brand: item.resolved_product.brand,
      name: item.resolved_product.name,
      price_range: item.resolved_product.price_range,
      outer_dimensions: `${item.resolved_product.outer_width_mm}×${item.resolved_product.outer_depth_mm}×${item.resolved_product.outer_height_mm}mm`,
    } : undefined,
    rakuten_results: rakuten,
  };
}
