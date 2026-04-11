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
} from "../shared/catalog/known_products";
import { searchRakutenProducts } from "../adapters/rakuten_api";
import { buildAffiliateUrl } from "../services/affiliate";
import { parseOrThrow } from "../utils/validation";
import { logAnalytics, buildHitLog, buildMissLog } from "../utils/logger";
import { detectGaps, buildGapFeedback, GapDetectionResult } from "../utils/gap_detector";

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

  const hitLog = buildHitLog(
    "find_replacement",
    { query: params.query, model: primary.model_number },
    params.intent,
    successors.length + rakuten_alternatives.length,
  );
  logAnalytics(hitLog).catch(() => {});

  return {
    matched_known: {
      name: primary.name,
      model_number: primary.model_number,
      brand: primary.brand,
      discontinued: primary.discontinued ?? false,
      successors: primary.successors,
    },
    db_successors_detail,
    rakuten_alternatives: rakuten_alternatives.slice(0, 8),
    tip:
      primary.discontinued || successors.length > 0
        ? "DBに登録された後継候補と楽天検索結果を併せて確認してください。最終判断は公式サイトの現行品番で。"
        : "既知DBに後継エントリはありません。楽天候補と同シリーズの現行ページを公式で確認してください。",
    miss: successors.length === 0 && rakuten_alternatives.length === 0,
    ...(gapFeedback && { gap_feedback: gapFeedback }),
  };
}
