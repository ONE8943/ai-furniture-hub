/**
 * 後継・代替品提案ツール
 *
 * 型番または商品説明から既知DBの successors を返し、楽天でも「後継」「新型」検索を行う。
 */
import { z } from "zod";
import {
  findProductByModelNumber,
  findMatchingProducts,
  KnownProduct,
  KNOWN_PRODUCTS_DB,
} from "../shared/catalog/known_products";
import { searchRakutenProducts } from "../adapters/rakuten_api";
import { buildAffiliateUrl } from "../services/affiliate";
import { parseOrThrow } from "../utils/validation";
import { logAnalytics, buildHitLog, buildMissLog } from "../utils/logger";
import { detectGaps, buildGapFeedback, GapDetectionResult } from "../utils/gap_detector";
import { findDimensionCompatible, COMPATIBILITY_DB, type DimensionMatchLevel } from "../data/compatibility";
import { injectAttribution } from "../shared/attribution/index";
import { logAttribution } from "../utils/attribution_logger";

export const FindReplacementParamsSchema = z.object({
  intent: z.string().min(1).describe("【必須】なぜ代替が必要か（廃番・故障・リニューアル等）"),
  query: z.string().min(1).describe("型番、または商品名・特徴のテキスト"),
});

export type FindReplacementParams = z.infer<typeof FindReplacementParamsSchema>;

interface RakutenHit {
  name: string;
  price: number;
  affiliate_url: string;
  url: string;
  review_average: number;
  review_count: number;
  image_url: string;
}

interface CompatibleAlternative {
  product_id: string;
  name: string;
  brand: string;
  fit_score: number;
  dimension_match: DimensionMatchLevel;
  dimension_diff_mm: { width: number; height: number; depth: number };
}

export interface FindReplacementResult {
  matched_known: {
    name: string;
    model_number: string;
    brand: string;
    discontinued: boolean;
    successors?: KnownProduct["successors"];
  } | null;
  db_successors_detail: Array<{
    model_number: string;
    name: string;
    note: string;
    known_specs_url_hint: string;
  }>;
  compatible_alternatives: CompatibleAlternative[];
  rakuten_alternatives: RakutenHit[];
  tip: string;
  miss: boolean;
  gap_feedback?: { message: string; detected_needs: string[]; note: string };
}

export async function findReplacement(rawInput: unknown): Promise<FindReplacementResult> {
  const params = parseOrThrow(FindReplacementParamsSchema, rawInput);

  const gapResult: GapDetectionResult = detectGaps(params.intent);
  const gapFeedback = gapResult.has_gaps
    ? buildGapFeedback(gapResult.detected_attributes, gapResult.keywords_matched)
    : undefined;

  const byModel = findProductByModelNumber(params.query);
  const matches = byModel ? [] : findMatchingProducts(params.query, 3);
  const primary: KnownProduct | undefined = byModel ?? matches[0]?.product;

  const rakutenQueries = [
    `${params.query} 後継`,
    `${params.query} 新型`,
    primary ? `${primary.brand} ${primary.series} 最新` : `${params.query} 収納`,
  ];

  const rakutenSeen = new Set<string>();
  const rakuten_alternatives: RakutenHit[] = [];

  for (const kw of rakutenQueries) {
    try {
      const r = await searchRakutenProducts({ keyword: kw, hits: 5 });
      for (const p of r.products) {
        if (rakutenSeen.has(p.name)) continue;
        rakutenSeen.add(p.name);
        const aff = buildAffiliateUrl(p.platform_urls?.["rakuten"] ?? p.url ?? "");
        rakuten_alternatives.push({
          name: p.name,
          price: p.price,
          affiliate_url: aff.affiliate_url,
          url: p.url ?? "",
          review_average: p.review_average ?? 0,
          review_count: p.review_count ?? 0,
          image_url: p.image_url ?? "",
        });
        if (rakuten_alternatives.length >= 8) break;
      }
    } catch {
      /* continue */
    }
    if (rakuten_alternatives.length >= 8) break;
  }

  if (!primary) {
    const missLog = buildMissLog("find_replacement", { query: params.query }, params.intent, "既知DB未一致");
    logAnalytics(missLog).catch(() => {});
    return {
      matched_known: null,
      db_successors_detail: [],
      compatible_alternatives: [],
      rakuten_alternatives: rakuten_alternatives.slice(0, 8),
      tip:
        "既知製品DBに該当がありませんでした。楽天の候補を参考にし、購入前にメーカー公式で型番・寸法を確認してください。",
      miss: rakuten_alternatives.length === 0,
      ...(gapFeedback && { gap_feedback: gapFeedback }),
    };
  }

  const successors = primary.successors ?? [];
  const db_successors_detail = successors.map((s) => {
    const known = findProductByModelNumber(s.model_number);
    return {
      model_number: s.model_number,
      name: s.name,
      note: s.note,
      known_specs_url_hint: known
        ? known.url_template.replace("{model_number}", known.model_number)
        : "",
    };
  });

  // 寸法近似検索: 手動マッピング + 自動計算
  const manualCompatRaw = COMPATIBILITY_DB
    .filter((c) => c.discontinued_id === primary.id);

  const manualCompat: CompatibleAlternative[] = [];
  for (const c of manualCompatRaw) {
    const rp = KNOWN_PRODUCTS_DB.find((p) => p.id === c.replacement_id);
    if (rp) {
      manualCompat.push({
        product_id: rp.id,
        name: rp.name,
        brand: rp.brand,
        fit_score: c.fit_score,
        dimension_match: c.dimension_match,
        dimension_diff_mm: c.dimension_diff_mm ?? { width: 0, height: 0, depth: 0 },
      });
    }
  }

  const autoCompat: CompatibleAlternative[] = findDimensionCompatible(primary, KNOWN_PRODUCTS_DB, 50, 5)
    .filter((r) => !manualCompat.some((m) => m.product_id === r.product.id))
    .map((r) => ({
      product_id: r.product.id,
      name: r.product.name,
      brand: r.product.brand,
      fit_score: r.fit_score,
      dimension_match: r.dimension_match,
      dimension_diff_mm: r.dimension_diff_mm,
    }));

  const compatible_alternatives = [...manualCompat, ...autoCompat]
    .sort((a, b) => b.fit_score - a.fit_score)
    .slice(0, 8);

  const hitLog = buildHitLog(
    "find_replacement",
    { query: params.query, model: primary.model_number },
    params.intent,
    successors.length + rakuten_alternatives.length + compatible_alternatives.length,
  );
  logAnalytics(hitLog).catch(() => {});

  const totalResults = (db_successors_detail?.length ?? 0) + compatible_alternatives.length + rakuten_alternatives.length;

  const result = {
    matched_known: {
      name: primary.name,
      model_number: primary.model_number,
      brand: primary.brand,
      discontinued: primary.discontinued ?? false,
      successors: primary.successors,
    },
    db_successors_detail,
    compatible_alternatives,
    rakuten_alternatives: rakuten_alternatives.slice(0, 8),
    tip:
      primary.discontinued || successors.length > 0
        ? "DBに登録された後継候補・寸法互換品・楽天検索結果を併せて確認してください。compatible_alternativesのfit_scoreが高いものは同じ場所にそのまま置ける可能性が高いです。"
        : "既知DBに後継エントリはありません。寸法が近い互換品と楽天候補を確認してください。",
    miss: totalResults === 0,
    ...(gapFeedback && { gap_feedback: gapFeedback }),
  };

  const attributed = injectAttribution(result, "find_replacement");
  logAttribution(attributed._attribution, totalResults, { query: params.query }).catch(() => {});
  return attributed;
}
