import { z } from "zod";
import { searchRakutenProducts, RakutenSearchResult } from "../adapters/rakuten_api";
import { logAnalytics, buildHitLog, buildMissLog } from "../utils/logger";
import { detectGaps, logRequirementGap, buildGapFeedback, GapDetectionResult } from "../utils/gap_detector";
import { RequirementGap } from "../schemas/requirement_gap";
import { generateProposals } from "../utils/proposal_generator";
import { buildAffiliateUrl, estimateCommission } from "../services/affiliate";
import { parseOrThrow } from "../utils/validation";

// -----------------------------------------------------------------------
// 入力スキーマ
// -----------------------------------------------------------------------
export const SearchRakutenParamsSchema = z.object({
  intent: z.string().min(1),
  keyword: z.string().min(1).describe("楽天で検索するキーワード（例: 'カラーボックス ニトリ'）"),
  price_min: z.number().int().positive().optional(),
  price_max: z.number().int().positive().optional(),
  sort: z
    .enum([
      "standard",
      "+itemPrice",
      "-itemPrice",
      "-reviewCount",
      "-reviewAverage",
      "+updateTimestamp",
    ])
    .optional()
    .default("standard"),
  hits: z.number().int().min(1).max(30).optional().default(10),
});

export type SearchRakutenParams = z.infer<typeof SearchRakutenParamsSchema>;

// -----------------------------------------------------------------------
// 結果型
// -----------------------------------------------------------------------
export interface RakutenToolResult {
  products: Array<{
    name: string;
    price: number;
    width_mm: number;
    height_mm: number;
    depth_mm: number;
    url: string;
    affiliate_url: string;
    in_stock: boolean;
    estimated_commission_yen: number;
  }>;
  total: number;
  api_total_count: number;
  source: string;
  miss: boolean;
  miss_reason?: string;
  suggestion?: string;
  gap_feedback?: {
    message: string;
    detected_needs: string[];
    note: string;
  };
}

/**
 * search_rakuten_products ツールのロジック
 */
export async function searchRakuten(rawInput: unknown): Promise<RakutenToolResult> {
  const params = parseOrThrow(SearchRakutenParamsSchema, rawInput);

  // Gap 検知
  const gapResult: GapDetectionResult = detectGaps(params.intent);

  // 楽天API呼び出し
  let apiResult: RakutenSearchResult;
  try {
    apiResult = await searchRakutenProducts({
      keyword: params.keyword,
      minPrice: params.price_min,
      maxPrice: params.price_max,
      sort: params.sort,
      hits: params.hits,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(`楽天API呼び出し失敗: ${msg}`);
  }

  const hitCount = apiResult.products.length;

  const query: Record<string, unknown> = {
    keyword: params.keyword,
    ...(params.price_min && { price_min: params.price_min }),
    ...(params.price_max && { price_max: params.price_max }),
    sort: params.sort,
    source: apiResult.source,
  };

  // Gap ログ（ノンブロッキング）
  if (gapResult.has_gaps) {
    const gapEntry: RequirementGap = {
      timestamp: new Date().toISOString(),
      tool: "search_rakuten_products",
      intent: params.intent,
      detected_attributes: gapResult.detected_attributes,
      keywords_matched: gapResult.keywords_matched,
      search_context: { had_results: hitCount > 0, hit_count: hitCount },
    };
    logRequirementGap(gapEntry)
      .then(() => generateProposals().catch(() => {}))
      .catch((e) => console.error("[GapDetector] async log error:", e));
  }

  const gapFeedback = gapResult.has_gaps
    ? buildGapFeedback(gapResult.detected_attributes, gapResult.keywords_matched)
    : undefined;

  if (hitCount === 0) {
    const missLog = buildMissLog(
      "search_rakuten_products",
      query,
      params.intent,
      "楽天で該当商品なし"
    );
    logAnalytics(missLog).catch(() => {});

    return {
      products: [],
      total: 0,
      api_total_count: apiResult.total_api_count,
      source: apiResult.source,
      miss: true,
      miss_reason: "楽天で該当商品が見つかりませんでした。",
      suggestion: "キーワードを変えて再検索するか、価格帯を広げてみてください。",
      ...(gapFeedback && { gap_feedback: gapFeedback }),
    };
  }

  // アフィリエイトURL付与
  const enriched = apiResult.products.map((p) => {
    const preferredUrl = p.platform_urls?.["rakuten"] ?? p.url ?? "";
    const aff = p.affiliate_url
      ? { affiliate_url: p.affiliate_url, platform: "rakuten" as const }
      : buildAffiliateUrl(preferredUrl);
    const commission = estimateCommission(p.price, "rakuten");
    return {
      name: p.name,
      price: p.price,
      width_mm: p.width_mm,
      height_mm: p.height_mm,
      depth_mm: p.depth_mm,
      url: preferredUrl,
      affiliate_url: aff.affiliate_url,
      in_stock: p.in_stock,
      estimated_commission_yen: commission,
    };
  });

  const totalCommission = enriched.reduce((s, p) => s + p.estimated_commission_yen, 0);
  const hitLog = buildHitLog("search_rakuten_products", query, params.intent, hitCount);
  logAnalytics({
    ...hitLog,
    affiliate_links_generated: enriched.length,
    platforms_represented: ["rakuten"],
  }).catch(() => {});

  return {
    products: enriched,
    total: hitCount,
    api_total_count: apiResult.total_api_count,
    source: apiResult.source,
    miss: false,
    ...(gapFeedback && { gap_feedback: gapFeedback }),
  };
}
