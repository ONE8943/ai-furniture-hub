/**
 * 製品特定ツール
 *
 * AIエージェントが画像を解析して抽出した特徴テキストを受け取り、
 * 既知製品DBから候補を返す。型番が分かれば内寸・消耗品情報まで提供。
 *
 * 写真 → AIが解析 → テキスト特徴 → このツール → 型番・スペック候補
 */
import { z } from "zod";
import { findMatchingProducts, ProductMatch, KnownProduct } from "../data/known_products";
import { searchRakutenProducts, extractDimensions } from "../adapters/rakuten_api";
import { logAnalytics, buildHitLog, buildMissLog } from "../utils/logger";
import { detectGaps, logRequirementGap, buildGapFeedback, GapDetectionResult } from "../utils/gap_detector";
import { RequirementGap } from "../schemas/requirement_gap";
import { generateProposals } from "../utils/proposal_generator";
import { buildAffiliateUrl } from "../services/affiliate";
import { parseOrThrow } from "../utils/validation";

// -----------------------------------------------------------------------
// 入力スキーマ
// -----------------------------------------------------------------------

export const IdentifyProductParamsSchema = z.object({
  intent: z.string().min(1).describe(
    "【必須】なぜこの製品を特定したいか（例: '写真の棚の型番を知りたい。消耗品も教えて'）"
  ),
  features: z.string().min(1).describe(
    "画像から読み取った特徴をテキストで記述。" +
    "【推奨項目】ブランド名/ロゴ、色、段数、素材（木/スチール）、" +
    "推定サイズ（幅約42cm等）、形状特徴（丸い穴、ワイヤーメッシュ等）"
  ),
  brand_hint: z.string().optional().describe(
    "ブランド名ヒント（写真にロゴが見えた場合: 'ニトリ', 'IKEA', '無印良品'等）"
  ),
  dimensions_hint: z.object({
    width_mm: z.number().positive().optional(),
    height_mm: z.number().positive().optional(),
    depth_mm: z.number().positive().optional(),
  }).optional().describe("推定寸法（mm）。分かる範囲で"),
  include_compatible: z.boolean().optional().default(true).describe(
    "互換収納・消耗品情報も含めるか（デフォルト: true）"
  ),
});

export type IdentifyProductParams = z.infer<typeof IdentifyProductParamsSchema>;

// -----------------------------------------------------------------------
// 出力型
// -----------------------------------------------------------------------

interface CandidateResult {
  confidence: number;
  match_reasons: string[];
  brand: string;
  series: string;
  model_number: string;
  name: string;
  outer_dimensions: { width_mm: number; height_mm: number; depth_mm: number };
  inner_dimensions: { width_mm: number; height_per_tier_mm: number; depth_mm: number; tiers: number };
  price_range: { min: number; max: number };
  colors: string[];
  material: string;
  load_capacity_per_tier_kg: number;
  product_url: string;
  consumables: KnownProduct["consumables"];
  compatible_storage: KnownProduct["compatible_storage"];
}

interface RakutenFallback {
  name: string;
  price: number;
  width_mm: number;
  height_mm: number;
  depth_mm: number;
  affiliate_url: string;
  url: string;
}

export interface IdentifyProductResult {
  candidates: CandidateResult[];
  rakuten_suggestions: RakutenFallback[];
  best_match_confidence: number;
  identification_status: "exact" | "probable" | "guess" | "not_found";
  tip: string;
  miss: boolean;
  gap_feedback?: { message: string; detected_needs: string[]; note: string };
}

// -----------------------------------------------------------------------
// メインロジック
// -----------------------------------------------------------------------

export async function identifyProduct(rawInput: unknown): Promise<IdentifyProductResult> {
  const params = parseOrThrow(IdentifyProductParamsSchema, rawInput);

  // Gap検知
  const gapResult: GapDetectionResult = detectGaps(params.intent);
  if (gapResult.has_gaps) {
    const gapEntry: RequirementGap = {
      timestamp: new Date().toISOString(),
      tool: "identify_product",
      intent: params.intent,
      detected_attributes: gapResult.detected_attributes,
      keywords_matched: gapResult.keywords_matched,
      search_context: { had_results: false, hit_count: 0 },
    };
    logRequirementGap(gapEntry)
      .then(() => generateProposals().catch(() => {}))
      .catch(() => {});
  }
  const gapFeedback = gapResult.has_gaps
    ? buildGapFeedback(gapResult.detected_attributes, gapResult.keywords_matched)
    : undefined;

  // 特徴テキスト組み立て
  let searchText = params.features;
  if (params.brand_hint) searchText += ` ${params.brand_hint}`;
  if (params.dimensions_hint) {
    if (params.dimensions_hint.width_mm) searchText += ` 幅${Math.round(params.dimensions_hint.width_mm / 10)}cm`;
    if (params.dimensions_hint.height_mm) searchText += ` 高さ${Math.round(params.dimensions_hint.height_mm / 10)}cm`;
    if (params.dimensions_hint.depth_mm) searchText += ` 奥行${Math.round(params.dimensions_hint.depth_mm / 10)}cm`;
  }

  // 既知DBから検索
  const matches: ProductMatch[] = findMatchingProducts(searchText, 5);

  // 候補を整形
  const candidates: CandidateResult[] = matches.map((m) => {
    const p = m.product;
    const url = p.url_template.replace("{model_number}", p.model_number);
    return {
      confidence: m.confidence,
      match_reasons: m.match_reasons,
      brand: p.brand,
      series: p.series,
      model_number: p.model_number,
      name: p.name,
      outer_dimensions: {
        width_mm: p.outer_width_mm,
        height_mm: p.outer_height_mm,
        depth_mm: p.outer_depth_mm,
      },
      inner_dimensions: {
        width_mm: p.inner_width_mm,
        height_per_tier_mm: p.inner_height_per_tier_mm,
        depth_mm: p.inner_depth_mm,
        tiers: p.tiers,
      },
      price_range: p.price_range,
      colors: p.colors,
      material: p.material,
      load_capacity_per_tier_kg: p.load_capacity_per_tier_kg,
      product_url: url,
      consumables: params.include_compatible ? p.consumables : [],
      compatible_storage: params.include_compatible ? p.compatible_storage : [],
    };
  });

  // 楽天フォールバック: DB一致が低信頼度の場合、楽天でも探す
  const rakutenSuggestions: RakutenFallback[] = [];
  const bestConfidence = candidates.length > 0 ? candidates[0]!.confidence : 0;

  if (bestConfidence < 60) {
    const rakutenKeyword = params.brand_hint
      ? `${params.brand_hint} ${params.features.slice(0, 30)}`
      : params.features.slice(0, 50);

    try {
      const rResult = await searchRakutenProducts({ keyword: rakutenKeyword, hits: 5 });
      for (const p of rResult.products) {
        const aff = buildAffiliateUrl(p.platform_urls?.["rakuten"] ?? p.url ?? "");
        rakutenSuggestions.push({
          name: p.name,
          price: p.price,
          width_mm: p.width_mm,
          height_mm: p.height_mm,
          depth_mm: p.depth_mm,
          affiliate_url: aff.affiliate_url,
          url: p.url ?? "",
        });
      }
    } catch {
      // 楽天検索失敗は握りつぶす
    }
  }

  // ステータス判定
  let status: IdentifyProductResult["identification_status"];
  let tip: string;

  if (bestConfidence >= 80) {
    status = "exact";
    tip = `高信頼度で「${candidates[0]!.name}」と特定しました。型番: ${candidates[0]!.model_number}`;
  } else if (bestConfidence >= 50) {
    status = "probable";
    tip = "いくつかの候補が見つかりました。ブランドロゴや型番シールがあれば、追加情報で絞り込めます。";
  } else if (candidates.length > 0) {
    status = "guess";
    tip = "確信度の低い候補です。色・段数・素材などの追加特徴があると精度が上がります。";
  } else {
    status = "not_found";
    tip = "既知製品DBに該当なし。楽天の検索結果を参考にしてください。";
  }

  // ログ
  const totalHits = candidates.length + rakutenSuggestions.length;
  if (totalHits > 0) {
    const hitLog = buildHitLog("identify_product", { features: params.features.slice(0, 100) }, params.intent, totalHits);
    logAnalytics(hitLog).catch(() => {});
  } else {
    const missLog = buildMissLog("identify_product", { features: params.features.slice(0, 100) }, params.intent, "候補なし");
    logAnalytics(missLog).catch(() => {});
  }

  return {
    candidates,
    rakuten_suggestions: rakutenSuggestions,
    best_match_confidence: bestConfidence,
    identification_status: status,
    tip,
    miss: totalHits === 0,
    ...(gapFeedback && { gap_feedback: gapFeedback }),
  };
}
