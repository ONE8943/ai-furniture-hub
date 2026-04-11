/**
 * スペース提案ツール
 *
 * AIエージェントが「幅800mm 奥行400mmの空きスペースに入る製品は？」と
 * 問い合わせてきたときに、カテゴリ横断で入る製品群＋コーディネート提案を返す。
 *
 * coordinate_storage が「棚→中身」の縦軸なのに対し、
 * このツールは「スペース→入る製品全部」の横軸。
 */
import { z } from "zod";
import { searchRakutenProducts, extractDimensions } from "../adapters/rakuten_api";
import { detectScene, SceneCoordinate } from "../data/scene_coordinates";
import { estimateInnerSize, calcFittingCount } from "../utils/inner_size_estimator";
import { logAnalytics, buildHitLog, buildMissLog } from "../utils/logger";
import { detectGaps, logRequirementGap, buildGapFeedback, GapDetectionResult } from "../utils/gap_detector";
import { RequirementGap } from "../schemas/requirement_gap";
import { generateProposals } from "../utils/proposal_generator";
import { buildAffiliateUrl } from "../services/affiliate";
import { parseOrThrow } from "../utils/validation";

// -----------------------------------------------------------------------
// 入力スキーマ
// -----------------------------------------------------------------------

export const SuggestBySpaceParamsSchema = z.object({
  intent: z.string().min(1).describe(
    "【必須】設置場所・用途・状況を詳細に（例: '洗面所の洗濯機横 幅20cmの隙間に入る収納が欲しい'）"
  ),
  width_mm: z.number().positive().describe("空きスペースの幅（mm）"),
  depth_mm: z.number().positive().describe("空きスペースの奥行き（mm）"),
  height_mm: z.number().positive().describe("空きスペースの高さ（mm）"),
  price_max: z.number().int().positive().optional().describe("予算上限（円）"),
  categories: z.array(z.string()).optional().describe(
    "探したいカテゴリ（省略時はシーンDBから自動推定。例: ['ラック', '収納ボックス']）"
  ),
});

export type SuggestBySpaceParams = z.infer<typeof SuggestBySpaceParamsSchema>;

// -----------------------------------------------------------------------
// 出力型
// -----------------------------------------------------------------------

interface ProductCandidate {
  name: string;
  price: number;
  width_mm: number;
  height_mm: number;
  depth_mm: number;
  category: string;
  affiliate_url: string;
  url: string;
  margin_width_mm: number;
  margin_depth_mm: number;
  margin_height_mm: number;
}

interface CategoryGroup {
  category: string;
  products: ProductCandidate[];
}

export interface SuggestBySpaceResult {
  space: { width_mm: number; depth_mm: number; height_mm: number };
  categories: CategoryGroup[];
  coordination_plan: CoordinationPlan | null;
  scene_tips: string[];
  scene_name: string | null;
  total_candidates: number;
  source: string;
  miss: boolean;
  miss_reason?: string;
  suggestion?: string;
  gap_feedback?: { message: string; detected_needs: string[]; note: string };
}

interface CoordinationPlan {
  shelf: ProductCandidate;
  shelf_inner: { width_mm: number; height_per_tier_mm: number; depth_mm: number; tiers: number };
  fitting_items: Array<{
    product: ProductCandidate;
    per_tier: number;
    total: number;
    fit_detail: string;
    set_price: number;
  }>;
}

// -----------------------------------------------------------------------
// 検索キーワード生成
// -----------------------------------------------------------------------

function buildSearchKeywords(
  widthMm: number,
  scene: SceneCoordinate | null,
  userCategories?: string[],
): string[] {
  const widthCm = Math.floor(widthMm / 10);

  if (userCategories && userCategories.length > 0) {
    return userCategories.map((cat) => `${cat} 幅${widthCm}cm`);
  }

  if (scene) {
    return [
      ...scene.recommended_shelf_keywords.slice(0, 2),
      ...scene.recommended_storage_keywords.slice(0, 1),
    ];
  }

  return [
    `棚 ラック 幅${widthCm}cm`,
    `収納ボックス 幅${widthCm}cm`,
  ];
}

// -----------------------------------------------------------------------
// メインロジック
// -----------------------------------------------------------------------

export async function suggestBySpace(rawInput: unknown): Promise<SuggestBySpaceResult> {
  const params = parseOrThrow(SuggestBySpaceParamsSchema, rawInput);
  const { width_mm, depth_mm, height_mm } = params;

  // Gap検知
  const gapResult: GapDetectionResult = detectGaps(params.intent);
  if (gapResult.has_gaps) {
    const gapEntry: RequirementGap = {
      timestamp: new Date().toISOString(),
      tool: "suggest_by_space",
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

  // シーン推定
  const scene = detectScene(params.intent);

  // 検索キーワード決定
  const keywords = buildSearchKeywords(width_mm, scene, params.categories);

  // 楽天検索（複数キーワードで並行）
  const allProducts: Array<{
    name: string; price: number; category: string;
    width_mm: number; height_mm: number; depth_mm: number;
    url: string; affiliate_url: string; description: string;
  }> = [];
  let lastSource = "rakuten_api";

  for (const kw of keywords) {
    try {
      const result = await searchRakutenProducts({
        keyword: kw,
        maxPrice: params.price_max,
        hits: 10,
      });
      lastSource = result.source;

      for (const p of result.products) {
        if (p.width_mm <= 0 || p.height_mm <= 0 || p.depth_mm <= 0) continue;
        const normalFit = p.width_mm <= width_mm && p.depth_mm <= depth_mm && p.height_mm <= height_mm;
        const rotatedFit = p.depth_mm <= width_mm && p.width_mm <= depth_mm && p.height_mm <= height_mm;
        if (!normalFit && !rotatedFit) continue;

        const aff = buildAffiliateUrl(p.platform_urls?.["rakuten"] ?? p.url ?? "");
        allProducts.push({
          name: p.name,
          price: p.price,
          category: p.category ?? "家具・収納",
          width_mm: p.width_mm,
          height_mm: p.height_mm,
          depth_mm: p.depth_mm,
          url: p.url ?? "",
          affiliate_url: aff.affiliate_url,
          description: p.description ?? "",
        });
      }
    } catch {
      // 1キーワード失敗でも続行
    }
  }

  // 重複除去（商品名ベース）
  const seen = new Set<string>();
  const unique = allProducts.filter((p) => {
    if (seen.has(p.name)) return false;
    seen.add(p.name);
    return true;
  });

  if (unique.length === 0) {
    const missLog = buildMissLog(
      "suggest_by_space",
      { width_mm, depth_mm, height_mm, keywords },
      params.intent,
      "スペースに入る製品が見つからない",
    );
    logAnalytics(missLog).catch(() => {});
    return {
      space: { width_mm, depth_mm, height_mm },
      categories: [],
      coordination_plan: null,
      scene_tips: scene?.tips ?? [],
      scene_name: scene?.scene ?? null,
      total_candidates: 0,
      source: lastSource,
      miss: true,
      miss_reason: `幅${width_mm}mm×奥行${depth_mm}mm×高さ${height_mm}mmに入る製品が見つかりませんでした。`,
      suggestion: "寸法を少し広げるか、キーワードを変えてみてください。",
      ...(gapFeedback && { gap_feedback: gapFeedback }),
    };
  }

  // カテゴリ別にグルーピング
  const catMap = new Map<string, ProductCandidate[]>();
  for (const p of unique) {
    const candidate: ProductCandidate = {
      name: p.name,
      price: p.price,
      width_mm: p.width_mm,
      height_mm: p.height_mm,
      depth_mm: p.depth_mm,
      category: p.category,
      affiliate_url: p.affiliate_url,
      url: p.url,
      margin_width_mm: width_mm - p.width_mm,
      margin_depth_mm: depth_mm - p.depth_mm,
      margin_height_mm: height_mm - p.height_mm,
    };
    const arr = catMap.get(p.category) ?? [];
    arr.push(candidate);
    catMap.set(p.category, arr);
  }

  const categories: CategoryGroup[] = [];
  for (const [cat, products] of catMap) {
    products.sort((a, b) => a.price - b.price);
    categories.push({ category: cat, products: products.slice(0, 5) });
  }

  // コーディネーションプラン: 棚カテゴリがあれば、中に入る収納も提案
  let coordinationPlan: CoordinationPlan | null = null;
  const shelfCategories = ["カラーボックス", "スチールラック", "ラック・シェルフ", "隙間収納"];
  const shelfProducts = unique.filter((p) => shelfCategories.includes(p.category));
  const storageProducts = unique.filter((p) => p.category === "収納ボックス");

  if (shelfProducts.length > 0 && storageProducts.length > 0) {
    const bestShelf = shelfProducts[0]!;
    const shelfText = `${bestShelf.name} ${bestShelf.description}`;
    const inner = estimateInnerSize(
      bestShelf.width_mm, bestShelf.height_mm, bestShelf.depth_mm, shelfText,
    );

    const fittingItems: CoordinationPlan["fitting_items"] = [];
    for (const st of storageProducts) {
      const fit = calcFittingCount(inner, st.width_mm, st.height_mm, st.depth_mm);
      if (!fit.fits || fit.total === 0) continue;
      fittingItems.push({
        product: {
          name: st.name, price: st.price,
          width_mm: st.width_mm, height_mm: st.height_mm, depth_mm: st.depth_mm,
          category: st.category, affiliate_url: st.affiliate_url, url: st.url,
          margin_width_mm: inner.width_mm - st.width_mm,
          margin_depth_mm: inner.depth_mm - st.depth_mm,
          margin_height_mm: inner.height_per_tier_mm - st.height_mm,
        },
        per_tier: fit.per_tier,
        total: fit.total,
        fit_detail: fit.fit_detail,
        set_price: bestShelf.price + st.price * fit.total,
      });
    }

    if (fittingItems.length > 0) {
      fittingItems.sort((a, b) => a.set_price - b.set_price);
      const shelfAff = buildAffiliateUrl(bestShelf.url);
      coordinationPlan = {
        shelf: {
          name: bestShelf.name, price: bestShelf.price,
          width_mm: bestShelf.width_mm, height_mm: bestShelf.height_mm,
          depth_mm: bestShelf.depth_mm, category: bestShelf.category,
          affiliate_url: shelfAff.affiliate_url, url: bestShelf.url,
          margin_width_mm: width_mm - bestShelf.width_mm,
          margin_depth_mm: depth_mm - bestShelf.depth_mm,
          margin_height_mm: height_mm - bestShelf.height_mm,
        },
        shelf_inner: {
          width_mm: inner.width_mm,
          height_per_tier_mm: inner.height_per_tier_mm,
          depth_mm: inner.depth_mm,
          tiers: inner.tiers,
        },
        fitting_items: fittingItems.slice(0, 3),
      };
    }
  }

  const totalCandidates = unique.length;
  const hitLog = buildHitLog(
    "suggest_by_space",
    { width_mm, depth_mm, height_mm, keywords },
    params.intent,
    totalCandidates,
  );
  logAnalytics(hitLog).catch(() => {});

  return {
    space: { width_mm, depth_mm, height_mm },
    categories,
    coordination_plan: coordinationPlan,
    scene_tips: scene?.tips ?? [],
    scene_name: scene?.scene ?? null,
    total_candidates: totalCandidates,
    source: lastSource,
    miss: false,
    ...(gapFeedback && { gap_feedback: gapFeedback }),
  };
}
