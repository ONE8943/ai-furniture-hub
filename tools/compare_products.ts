/**
 * 製品比較ツール
 *
 * 2〜5件の製品を並べて比較表を返す。
 * AIエージェントが「AとBどっちがいい？」に対して構造化データで即答できる。
 */
import { z } from "zod";
import { searchRakutenProducts } from "../adapters/rakuten_api";
import { findMatchingProducts } from "../shared/catalog/known_products";
import { logAnalytics, buildHitLog, buildMissLog } from "../utils/logger";
import { detectGaps, buildGapFeedback, GapDetectionResult } from "../utils/gap_detector";
import { buildAffiliateUrl } from "../services/affiliate";
import { parseOrThrow } from "../utils/validation";

// -----------------------------------------------------------------------
// 入力スキーマ
// -----------------------------------------------------------------------

export const CompareParamsSchema = z.object({
  intent: z.string().min(1).describe(
    "【必須】なぜ比較したいか（例: '子供部屋の本棚を買いたい。ニトリかIKEAで迷っている'）"
  ),
  keywords: z.array(z.string().min(1)).min(2).max(5).describe(
    "比較したい製品の検索キーワード（2〜5件）。各キーワードで1件ずつ代表製品を取得"
  ),
  compare_aspects: z.array(z.string()).optional().describe(
    "比較したい観点（省略時はデフォルト: ['価格','サイズ','レビュー','耐荷重']）"
  ),
});

export type CompareParams = z.infer<typeof CompareParamsSchema>;

// -----------------------------------------------------------------------
// 出力型
// -----------------------------------------------------------------------

interface CompareItem {
  keyword: string;
  name: string;
  price: number;
  width_mm: number;
  height_mm: number;
  depth_mm: number;
  category: string;
  review_count: number;
  review_average: number;
  image_url: string;
  affiliate_url: string;
  url: string;
  known_product_match: {
    model_number: string;
    brand: string;
    series: string;
    inner_width_mm: number;
    inner_depth_mm: number;
    inner_height_per_tier_mm: number;
    tiers: number;
    load_capacity_per_tier_kg: number;
    compatible_storage_count: number;
  } | null;
}

interface ComparisonNote {
  aspect: string;
  winner: string;
  detail: string;
}

export interface CompareResult {
  items: CompareItem[];
  comparison_notes: ComparisonNote[];
  recommendation: string;
  total_compared: number;
  miss: boolean;
  miss_reason?: string;
  gap_feedback?: { message: string; detected_needs: string[]; note: string };
}

// -----------------------------------------------------------------------
// メインロジック
// -----------------------------------------------------------------------

export async function compareProducts(rawInput: unknown): Promise<CompareResult> {
  const params = parseOrThrow(CompareParamsSchema, rawInput);

  const gapResult: GapDetectionResult = detectGaps(params.intent);
  const gapFeedback = gapResult.has_gaps
    ? buildGapFeedback(gapResult.detected_attributes, gapResult.keywords_matched)
    : undefined;

  const items: CompareItem[] = [];

  for (const keyword of params.keywords) {
    try {
      const result = await searchRakutenProducts({ keyword, hits: 1 });
      if (result.products.length === 0) continue;

      const p = result.products[0]!;
      const aff = buildAffiliateUrl(p.platform_urls?.["rakuten"] ?? p.url ?? "");

      const knownMatches = findMatchingProducts(`${p.name} ${p.description ?? ""}`, 1);
      const knownMatch = knownMatches.length > 0 && knownMatches[0]!.confidence >= 40
        ? knownMatches[0]!.product
        : null;

      items.push({
        keyword,
        name: p.name,
        price: p.price,
        width_mm: p.width_mm,
        height_mm: p.height_mm,
        depth_mm: p.depth_mm,
        category: p.category ?? "家具・収納",
        review_count: p.review_count ?? 0,
        review_average: p.review_average ?? 0,
        image_url: p.image_url ?? "",
        affiliate_url: aff.affiliate_url,
        url: p.url ?? "",
        known_product_match: knownMatch ? {
          model_number: knownMatch.model_number,
          brand: knownMatch.brand,
          series: knownMatch.series,
          inner_width_mm: knownMatch.inner_width_mm,
          inner_depth_mm: knownMatch.inner_depth_mm,
          inner_height_per_tier_mm: knownMatch.inner_height_per_tier_mm,
          tiers: knownMatch.tiers,
          load_capacity_per_tier_kg: knownMatch.load_capacity_per_tier_kg,
          compatible_storage_count: knownMatch.compatible_storage.length,
        } : null,
      });
    } catch {
      // 検索失敗は握りつぶして次へ
    }
  }

  if (items.length < 2) {
    const missLog = buildMissLog(
      "compare_products",
      { keywords: params.keywords },
      params.intent,
      "比較に必要な製品が2件未満",
    );
    logAnalytics(missLog).catch(() => {});
    return {
      items,
      comparison_notes: [],
      recommendation: "",
      total_compared: items.length,
      miss: true,
      miss_reason: "比較に必要な製品が2件以上見つかりませんでした。キーワードを変えてみてください。",
      ...(gapFeedback && { gap_feedback: gapFeedback }),
    };
  }

  // 比較ノート自動生成
  const notes: ComparisonNote[] = [];

  // 価格比較
  const cheapest = items.reduce((a, b) => a.price < b.price ? a : b);
  const expensive = items.reduce((a, b) => a.price > b.price ? a : b);
  if (cheapest.name !== expensive.name) {
    const diff = expensive.price - cheapest.price;
    notes.push({
      aspect: "価格",
      winner: cheapest.name,
      detail: `最安: ${cheapest.price.toLocaleString()}円 (${cheapest.name}) / 最高: ${expensive.price.toLocaleString()}円 (${expensive.name}) / 差額: ${diff.toLocaleString()}円`,
    });
  }

  // レビュー比較
  const itemsWithReview = items.filter((i) => i.review_count > 0);
  if (itemsWithReview.length >= 2) {
    const bestReview = itemsWithReview.reduce((a, b) => a.review_average > b.review_average ? a : b);
    const mostReviewed = itemsWithReview.reduce((a, b) => a.review_count > b.review_count ? a : b);
    notes.push({
      aspect: "レビュー評価",
      winner: bestReview.name,
      detail: `最高評価: ${bestReview.review_average}点 (${bestReview.name}, ${bestReview.review_count}件) / 最多件数: ${mostReviewed.review_count}件 (${mostReviewed.name})`,
    });
  }

  // サイズ比較
  const widest = items.reduce((a, b) => a.width_mm > b.width_mm ? a : b);
  const tallest = items.reduce((a, b) => a.height_mm > b.height_mm ? a : b);
  notes.push({
    aspect: "サイズ",
    winner: widest.name,
    detail: `最大幅: ${widest.width_mm}mm (${widest.name}) / 最大高さ: ${tallest.height_mm}mm (${tallest.name})`,
  });

  // 耐荷重比較（既知製品のみ）
  const withLoad = items.filter((i) => i.known_product_match?.load_capacity_per_tier_kg);
  if (withLoad.length >= 2) {
    const strongest = withLoad.reduce((a, b) =>
      (a.known_product_match!.load_capacity_per_tier_kg > b.known_product_match!.load_capacity_per_tier_kg) ? a : b
    );
    notes.push({
      aspect: "耐荷重（1段あたり）",
      winner: strongest.name,
      detail: `最大: ${strongest.known_product_match!.load_capacity_per_tier_kg}kg/段 (${strongest.name})`,
    });
  }

  // 互換収納比較
  const withCompat = items.filter((i) => i.known_product_match && i.known_product_match.compatible_storage_count > 0);
  if (withCompat.length > 0) {
    const best = withCompat.reduce((a, b) =>
      a.known_product_match!.compatible_storage_count > b.known_product_match!.compatible_storage_count ? a : b
    );
    notes.push({
      aspect: "互換収納バリエーション",
      winner: best.name,
      detail: `${best.name}: ${best.known_product_match!.compatible_storage_count}種類の互換収納あり`,
    });
  }

  // 総合おすすめ
  let recommendation = "";
  if (cheapest.review_average >= 4.0) {
    recommendation = `コスパ重視なら「${cheapest.name}」(${cheapest.price.toLocaleString()}円、レビュー${cheapest.review_average}点)がおすすめ。`;
  } else if (itemsWithReview.length > 0) {
    const bestReview = itemsWithReview.reduce((a, b) => a.review_average > b.review_average ? a : b);
    recommendation = `品質重視なら「${bestReview.name}」(レビュー${bestReview.review_average}点/${bestReview.review_count}件)がおすすめ。`;
  }

  const hitLog = buildHitLog("compare_products", { keywords: params.keywords }, params.intent, items.length);
  logAnalytics(hitLog).catch(() => {});

  return {
    items,
    comparison_notes: notes,
    recommendation,
    total_compared: items.length,
    miss: false,
    ...(gapFeedback && { gap_feedback: gapFeedback }),
  };
}
