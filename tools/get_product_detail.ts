import { z } from "zod";
import { Product } from "../schemas/product";
import { getProductById, getAllProducts } from "../data/product_store";
import { logAnalytics, buildHitLog, buildMissLog } from "../utils/logger";
import { attachAffiliateUrls, logConversions, estimateCommission, ProductWithAffiliate } from "../services/affiliate";
import { detectGaps, logRequirementGap, buildGapFeedback } from "../utils/gap_detector";
import { RequirementGap } from "../schemas/requirement_gap";
import { parseOrThrow } from "../utils/validation";
import { findMatchingProducts, getProductRelatedItems, RelatedItem } from "../shared/catalog/known_products";
import { findCurationsForProduct } from "../data/curation";

// -----------------------------------------------------------------------
// 入力スキーマ
// -----------------------------------------------------------------------

export const GetProductDetailParamsSchema = z.object({
  id: z
    .string()
    .min(1)
    .describe("取得する商品のID（search_products の返却値にある id フィールド）"),
  intent: z
    .string()
    .min(1)
    .describe(
      "【必須】なぜこの商品の詳細が必要か（購入検討中、サイズ確認、比較検討など）。市場分析に活用されます。"
    ),
});

export type GetProductDetailParams = z.infer<typeof GetProductDetailParamsSchema>;

// -----------------------------------------------------------------------
// 結果型
// -----------------------------------------------------------------------

export interface ProductDetailResult {
  product: ProductWithAffiliate | null;
  found: boolean;
  affiliate_url?: string;
  estimated_commission_yen?: number;
  gap_feedback?: {
    message: string;
    detected_needs: string[];
    note: string;
  };
  related_products?: {
    id: string;
    name: string;
    price: number;
    affiliate_url?: string;
  }[];
  related_items_hint?: {
    total: number;
    required: Array<{ name: string; why: string; search_keywords: string[] }>;
    recommended: Array<{ name: string; why: string; search_keywords: string[] }>;
    note: string;
  };
  curated_in?: Array<{ type: string; id: string; title: string }>;
  store_info?: {
    total_products: number;
    source: string;
  };
}

// -----------------------------------------------------------------------
// MCP ツール定義（description を使ってAIエージェントへ指示）
// -----------------------------------------------------------------------

export const GET_PRODUCT_DETAIL_TOOL_DEFINITION = {
  title: "家具・収納商品の詳細情報を取得",
  description:
    "商品IDを指定して、特定の家具・収納商品のフルスペック（寸法・価格・在庫・素材など）を取得します。" +
    "【重要】intentには、なぜこの詳細が必要か（例：購入前の最終確認、サイズの詳細確認、他商品との比較）を記述してください。" +
    "【収益化】返却される affiliate_url をユーザーへの購入リンクとして使用してください。" +
    "関連商品（同シリーズ・近いサイズ）も自動で提案されます。",
  inputSchema: {
    id: GetProductDetailParamsSchema.shape.id,
    intent: GetProductDetailParamsSchema.shape.intent,
  },
} as const;

// -----------------------------------------------------------------------
// コアロジック
// -----------------------------------------------------------------------

/**
 * 関連商品を取得する（同シリーズ or 近いサイズ）
 * Product[] を直接返す（二重検索を回避するため）
 * 最大3件まで
 */
function findRelatedProducts(
  targetId: string,
  seriesId?: string,
  widthMm?: number
): Product[] {
  return getAllProducts()
    .filter((p) => {
      if (p.id === targetId) return false;
      if (seriesId && p.series_id === seriesId) return true;
      if (widthMm && Math.abs(p.width_mm - widthMm) <= 100) return true;
      return false;
    })
    .slice(0, 3);
}

/**
 * get_product_detail ツールのコアロジック
 *
 * 処理フロー:
 *   1. IDでデータストアから商品を検索
 *   2. Gap検知（intent をスキャン）
 *   3. アフィリエイトURL付与
 *   4. 関連商品の取得
 *   5. analytics.jsonl & conversions.jsonl へノンブロッキングで記録
 */
export async function getProductDetail(
  rawInput: unknown
): Promise<ProductDetailResult> {
  const params: GetProductDetailParams = parseOrThrow(GetProductDetailParamsSchema, rawInput);

  const { id, intent } = params;

  // ── Gap検知（意図に含まれる未対応属性のチェック） ──
  const gapResult = detectGaps(intent);

  // ── 商品検索 ──
  const product = getProductById(id);
  const found = product !== undefined;

  // Gap ログは商品取得後に記録（search_context に実態を反映）
  if (gapResult.has_gaps) {
    const gapEntry: RequirementGap = {
      timestamp: new Date().toISOString(),
      tool: "get_product_detail",
      intent,
      detected_attributes: gapResult.detected_attributes,
      keywords_matched: gapResult.keywords_matched,
      search_context: {
        had_results: found,
        hit_count: found ? 1 : 0,
      },
    };
    logRequirementGap(gapEntry).catch((e) =>
      console.error("[GapDetector] async log error:", e)
    );
  }

  const gapFeedback = gapResult.has_gaps
    ? buildGapFeedback(gapResult.detected_attributes, gapResult.keywords_matched)
    : undefined;

  if (!product) {
    const missLog = buildMissLog(
      "get_product_detail",
      { requested_id: id },
      intent,
      `商品ID "${id}" が見つかりません`
    );
    logAnalytics(missLog).catch((e) =>
      console.error("[Analytics] async log error:", e)
    );

    return {
      product: null,
      found: false,
      ...(gapFeedback && { gap_feedback: gapFeedback }),
    };
  }

  // ── アフィリエイトURL付与 ──
  const { products: enriched, conversionLogs } = attachAffiliateUrls(
    [product],
    intent
  );
  const enrichedProduct = enriched[0];
  if (!enrichedProduct) {
    throw new Error(`[get_product_detail] affiliate enrichment returned empty for id=${id}`);
  }

  const estimatedCommission = conversionLogs.reduce(
    (sum, l) =>
      sum +
      estimateCommission(
        l.price,
        l.platform as "nitori" | "rakuten" | "amazon" | "generic"
      ),
    0
  );

  // ── 関連商品（アフィリエイトURL付き） ──
  const relatedProducts = findRelatedProducts(id, product.series_id, product.width_mm);
  let relatedWithAffiliate: { id: string; name: string; price: number; affiliate_url?: string }[] = [];

  if (relatedProducts.length > 0) {
    const { products: relEnriched } = attachAffiliateUrls(relatedProducts, intent);
    relatedWithAffiliate = relEnriched.map((re) => ({
      id: re.id,
      name: re.name,
      price: re.price,
      affiliate_url: re.affiliate_url,
    }));
  }

  // ── ログ記録（ノンブロッキング） ──
  const logEntry = buildHitLog("get_product_detail", { requested_id: id }, intent, 1);
  const enrichedLog = {
    ...logEntry,
    affiliate_links_generated: conversionLogs.length,
    platforms_represented: conversionLogs.map((l) => l.platform),
  };

  const logLabels = ["analytics", "conversions"] as const;
  Promise.allSettled([
    logAnalytics(enrichedLog),
    logConversions(conversionLogs),
  ]).then((results) => {
    for (let i = 0; i < results.length; i++) {
      const r = results[i]!;
      if (r.status === "rejected") {
        console.error(`[${logLabels[i]}] Log write failed:`, r.reason);
      }
    }
  });

  const allProducts = getAllProducts();

  // known_products DBから関連アイテム情報を検索
  const knownMatches = findMatchingProducts(enrichedProduct.name, 1);
  const knownProduct = knownMatches.length > 0 && knownMatches[0]!.confidence >= 20
    ? knownMatches[0]!.product : undefined;
  const relatedItems = knownProduct ? getProductRelatedItems(knownProduct.id) : [];
  const requiredItems = relatedItems.filter((ri) => ri.required);
  const recommendedItems = relatedItems.filter((ri) => !ri.required);

  const relatedItemsHint = relatedItems.length > 0 ? {
    total: relatedItems.length,
    required: requiredItems.map((ri) => ({ name: ri.name, why: ri.why, search_keywords: ri.search_keywords })),
    recommended: recommendedItems.slice(0, 5).map((ri) => ({ name: ri.name, why: ri.why, search_keywords: ri.search_keywords })),
    note: "詳細は get_related_items ツールで取得可能（楽天検索結果付き）",
  } : undefined;

  return {
    product: enrichedProduct,
    found: true,
    affiliate_url: enrichedProduct.affiliate_url,
    estimated_commission_yen: estimatedCommission,
    ...(relatedWithAffiliate.length > 0 && { related_products: relatedWithAffiliate }),
    ...(gapFeedback && { gap_feedback: gapFeedback }),
    ...(relatedItemsHint && { related_items_hint: relatedItemsHint }),
    curated_in: knownProduct ? findCurationsForProduct(knownProduct.id) : [],
    store_info: {
      total_products: allProducts.length,
      source: "product_store",
    },
  };
}
