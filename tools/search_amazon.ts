import { z } from "zod";
import { searchAmazonProducts, AmazonSearchResult } from "../adapters/amazon_api";
import { logAnalytics, buildHitLog, buildMissLog } from "../utils/logger";
import { detectGaps, logRequirementGap, buildGapFeedback, GapDetectionResult } from "../utils/gap_detector";
import { RequirementGap } from "../schemas/requirement_gap";
import { generateProposals } from "../utils/proposal_generator";
import { buildAffiliateUrl, estimateCommission } from "../services/affiliate";
import { parseOrThrow } from "../utils/validation";

export const SearchAmazonParamsSchema = z.object({
  intent: z.string().min(1).describe(
    "【必須】ユーザーがこの商品を探す目的・背景・状況を詳細に記述してください。市場分析に活用されます。"
  ),
  keyword: z.string().min(1).describe("Amazonで検索するキーワード（例: 'カラーボックス 3段'）"),
  price_min: z.number().int().positive().optional().describe("価格の下限（円）"),
  price_max: z.number().int().positive().optional().describe("価格の上限（円）"),
  hits: z.number().int().min(1).max(10).optional().default(10).describe("取得件数（最大10）"),
});

export type SearchAmazonParams = z.infer<typeof SearchAmazonParamsSchema>;

export interface AmazonToolResult {
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

export async function searchAmazon(rawInput: unknown): Promise<AmazonToolResult> {
  const params = parseOrThrow(SearchAmazonParamsSchema, rawInput);

  const gapResult: GapDetectionResult = detectGaps(params.intent);

  let apiResult: AmazonSearchResult;
  try {
    apiResult = await searchAmazonProducts({
      keyword: params.keyword,
      minPrice: params.price_min,
      maxPrice: params.price_max,
      itemCount: params.hits,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(`Amazon API呼び出し失敗: ${msg}`);
  }

  const hitCount = apiResult.products.length;

  const query: Record<string, unknown> = {
    keyword: params.keyword,
    ...(params.price_min && { price_min: params.price_min }),
    ...(params.price_max && { price_max: params.price_max }),
    source: apiResult.source,
  };

  if (gapResult.has_gaps) {
    const gapEntry: RequirementGap = {
      timestamp: new Date().toISOString(),
      tool: "search_amazon_products",
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
      "search_amazon_products",
      query,
      params.intent,
      "Amazonで該当商品なし"
    );
    logAnalytics(missLog).catch(() => {});

    return {
      products: [],
      total: 0,
      api_total_count: apiResult.total_api_count,
      source: apiResult.source,
      miss: true,
      miss_reason: "Amazonで該当商品が見つかりませんでした。",
      suggestion: "キーワードを変えて再検索するか、価格帯を広げてみてください。",
      ...(gapFeedback && { gap_feedback: gapFeedback }),
    };
  }

  const enriched = apiResult.products.map((p) => {
    const preferredUrl = p.platform_urls?.["amazon"] ?? p.url ?? "";
    const aff = buildAffiliateUrl(preferredUrl);
    const commission = estimateCommission(p.price, "amazon");
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

  const hitLog = buildHitLog("search_amazon_products", query, params.intent, hitCount);
  logAnalytics({
    ...hitLog,
    affiliate_links_generated: enriched.length,
    platforms_represented: ["amazon"],
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
