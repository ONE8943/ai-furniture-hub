import { SearchParamsSchema, SearchParams } from "../schemas/search";
import { getAllProducts } from "../data/product_store";
import { filterProducts, detectMissReason } from "../utils/filter";
import { parseOrThrow } from "../utils/validation";
import { logAnalytics, buildHitLog, buildMissLog } from "../utils/logger";
import {
  detectGaps,
  logRequirementGap,
  buildGapFeedback,
  GapDetectionResult,
} from "../utils/gap_detector";
import { RequirementGap } from "../schemas/requirement_gap";
import { generateProposals } from "../utils/proposal_generator";
import {
  attachAffiliateUrls,
  logConversions,
  ProductWithAffiliate,
  estimateCommission,
} from "../services/affiliate";
import { getProductRelatedItems } from "../shared/catalog/known_products";

export interface GapFeedback {
  message: string;
  detected_needs: string[];
  note: string;
}

export interface SearchResult {
  products: ProductWithAffiliate[];
  total: number;
  miss: boolean;
  miss_reason?: string;
  suggestion?: string;
  gap_feedback?: GapFeedback;
  affiliate_summary?: {
    links_generated: number;
    platforms: string[];
    estimated_commission_yen: number;
  };
}

/**
 * search_products ツールのロジック（v1.3: Gap検知追加）
 * Zodバリデーション → Gap検知 → フィルタリング → ログ記録（並列） → 結果返却
 */
export async function searchProducts(rawInput: unknown): Promise<SearchResult> {
  const params: SearchParams = parseOrThrow(SearchParamsSchema, rawInput);

  // Step 1: Gap検知（intentをスキャン）
  const gapResult: GapDetectionResult = detectGaps(params.intent);

  const results = filterProducts(getAllProducts(), params);
  const hitCount = results.length;

  const query: Record<string, unknown> = {
    ...(params.width_mm_min !== undefined && { width_mm_min: params.width_mm_min }),
    ...(params.width_mm_max !== undefined && { width_mm_max: params.width_mm_max }),
    ...(params.height_mm_min !== undefined && { height_mm_min: params.height_mm_min }),
    ...(params.height_mm_max !== undefined && { height_mm_max: params.height_mm_max }),
    ...(params.depth_mm_min !== undefined && { depth_mm_min: params.depth_mm_min }),
    ...(params.depth_mm_max !== undefined && { depth_mm_max: params.depth_mm_max }),
    ...(params.price_max !== undefined && { price_max: params.price_max }),
    ...(params.price_min !== undefined && { price_min: params.price_min }),
    ...(params.color !== undefined && { color: params.color }),
    ...(params.category !== undefined && { category: params.category }),
    in_stock_only: params.in_stock_only,
  };

  // Step 2: Gap ログをノンブロッキックで記録し、閾値超えでプロポーザル自動生成
  if (gapResult.has_gaps) {
    const gapEntry: RequirementGap = {
      timestamp: new Date().toISOString(),
      tool: "search_products",
      intent: params.intent,
      detected_attributes: gapResult.detected_attributes,
      keywords_matched: gapResult.keywords_matched,
      search_context: {
        had_results: hitCount > 0,
        hit_count: hitCount,
      },
    };
    // ログ書き込み → 完了後にプロポーザル自動生成を試みる（ノンブロッキング）
    logRequirementGap(gapEntry)
      .then(() =>
        generateProposals().catch((e) =>
          console.error("[ProposalGenerator] auto-generate error:", e)
        )
      )
      .catch((e) => console.error("[GapDetector] async log error:", e));
  }

  const gapFeedback: GapFeedback | undefined = gapResult.has_gaps
    ? buildGapFeedback(gapResult.detected_attributes, gapResult.keywords_matched)
    : undefined;

  // Step 3: 検索結果ログ
  if (hitCount === 0) {
    const missReason = detectMissReason(params);
    const logEntry = buildMissLog("search_products", query, params.intent, missReason);
    logAnalytics(logEntry).catch((e) => console.error("[Analytics] async log error:", e));

    return {
      products: [],
      total: 0,
      miss: true,
      miss_reason: missReason,
      suggestion:
        "ご指定の条件に合致する商品が見つかりませんでした。条件を変更するか、別のカテゴリをお試しください。",
      ...(gapFeedback && { gap_feedback: gapFeedback }),
    };
  }

  // Step 4: アフィリエイトURL付与
  const { products: enrichedProducts, conversionLogs } = attachAffiliateUrls(
    results,
    params.intent
  );

  const platforms = [...new Set(conversionLogs.map((l) => l.platform))];
  const estimatedCommission = conversionLogs.reduce(
    (sum, l) => sum + estimateCommission(l.price, l.platform as "nitori" | "rakuten" | "amazon" | "generic"),
    0
  );

  const logEntry = buildHitLog("search_products", query, params.intent, hitCount);
  // analyticsログにアフィリエイト情報を追加
  const enrichedLog = {
    ...logEntry,
    affiliate_links_generated: conversionLogs.length,
    platforms_represented: platforms,
  };

  const logLabels = ["analytics", "conversions"] as const;
  const logResults = await Promise.allSettled([
    logAnalytics(enrichedLog),
    logConversions(conversionLogs),
  ]);

  for (let i = 0; i < logResults.length; i++) {
    const r = logResults[i]!;
    if (r.status === "rejected") {
      console.error(`[${logLabels[i]}] Log write failed:`, r.reason);
    }
  }

  const productsWithHints = enrichedProducts.map((p) => {
    const knownIdTag = p.tags?.find((t) => t.startsWith("known_id:"));
    if (!knownIdTag) return p;
    const knownId = knownIdTag.replace("known_id:", "");
    const related = getProductRelatedItems(knownId);
    if (related.length === 0) return p;
    return {
      ...p,
      related_items_hint: {
        known_product_id: knownId,
        count: related.length,
        summary: related.slice(0, 3).map((r) => `${r.name} (${r.relation})`).join(", "),
        tip: `Use get_related_items with product_id="${knownId}" for full related-item chain`,
      },
    };
  });

  return {
    products: productsWithHints,
    total: hitCount,
    miss: false,
    affiliate_summary: {
      links_generated: conversionLogs.length,
      platforms,
      estimated_commission_yen: estimatedCommission,
    },
    ...(gapFeedback && { gap_feedback: gapFeedback }),
  };
}
