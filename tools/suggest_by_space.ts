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
import { estimateInnerSize, calcFittingCount, classifySpaceFit, type FitStatus } from "../utils/inner_size_estimator";
import { logAnalytics, buildHitLog, buildMissLog } from "../utils/logger";
import { detectGaps, logRequirementGap, buildGapFeedback, GapDetectionResult } from "../utils/gap_detector";
import { RequirementGap } from "../schemas/requirement_gap";
import { generateProposals } from "../utils/proposal_generator";
import { buildAffiliateUrl } from "../services/affiliate";
import { inferSafetyFlags, logDemandSignal } from "../utils/demand_logger";
import { checkCarryIn, inferWeightFromDimensions, type CarryInNote } from "../utils/carry_in_checker";
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
  fit_status: FitStatus;
  fit_detail: string;
  used_rotation: boolean;
  safety_margin_mm: {
    width_mm: number;
    depth_mm: number;
    height_mm: number;
    policy: string;
  };
  carry_in?: CarryInNote;
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
  carry_in_warnings?: CarryInNote[];
}

interface CoordinationPlan {
  shelf: ProductCandidate;
  shelf_inner: {
    width_mm: number;
    height_per_tier_mm: number;
    depth_mm: number;
    tiers: number;
    source: string;
    confidence: string;
    reason: string;
  };
  fitting_items: Array<{
    product: ProductCandidate;
    per_tier: number;
    total: number;
    fit_detail: string;
    set_price: number;
    fit_status: FitStatus;
    used_rotation: boolean;
    safety_margin_mm: {
      width_mm: number;
      depth_mm: number;
      height_mm: number;
      policy: string;
    };
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

const fitStatusRank: Record<FitStatus, number> = {
  safe_fit: 3,
  tight_fit: 2,
  near_miss: 1,
  miss: 0,
};

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
  const safetyFlags = inferSafetyFlags(`${params.intent} ${scene?.scene ?? ""}`);

  // 検索キーワード決定
  const keywords = buildSearchKeywords(width_mm, scene, params.categories);

  // 楽天検索（複数キーワードで並行）
  const allProducts: Array<{
    name: string; price: number; category: string;
    width_mm: number; height_mm: number; depth_mm: number;
    url: string; affiliate_url: string; description: string;
    margin_width_mm: number;
    margin_depth_mm: number;
    margin_height_mm: number;
    fit_status: FitStatus;
    fit_detail: string;
    used_rotation: boolean;
    safety_margin_mm: {
      width_mm: number;
      depth_mm: number;
      height_mm: number;
      policy: string;
    };
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
        const fitContext = {
          intent_text: params.intent,
          space_text: scene?.scene,
          item_text: `${p.name} ${p.category ?? ""} ${p.description ?? ""}`,
        };
        const fitChoices = [
          {
            result: classifySpaceFit(
              { width_mm, depth_mm, height_mm },
              { width_mm: p.width_mm, depth_mm: p.depth_mm, height_mm: p.height_mm },
              fitContext,
            ),
            used_rotation: false,
          },
        ];

        if (p.width_mm !== p.depth_mm) {
          fitChoices.push({
            result: classifySpaceFit(
              { width_mm, depth_mm, height_mm },
              { width_mm: p.depth_mm, depth_mm: p.width_mm, height_mm: p.height_mm },
              fitContext,
            ),
            used_rotation: true,
          });
        }

        fitChoices.sort((a, b) => {
          if (fitStatusRank[b.result.status] !== fitStatusRank[a.result.status]) {
            return fitStatusRank[b.result.status] - fitStatusRank[a.result.status];
          }
          const aMin = Math.min(
            a.result.clearance_width_mm,
            a.result.clearance_depth_mm,
            a.result.clearance_height_mm,
          );
          const bMin = Math.min(
            b.result.clearance_width_mm,
            b.result.clearance_depth_mm,
            b.result.clearance_height_mm,
          );
          if (bMin !== aMin) return bMin - aMin;
          return Number(a.used_rotation) - Number(b.used_rotation);
        });

        const bestFit = fitChoices[0]!;
        if (!bestFit.result.fits) continue;

        const aff = buildAffiliateUrl(p.platform_urls?.["rakuten"] ?? p.url ?? "");
        const carryInDims = {
          width_mm: p.width_mm,
          height_mm: p.height_mm,
          depth_mm: p.depth_mm,
          weight_kg: inferWeightFromDimensions(
            { width_mm: p.width_mm, height_mm: p.height_mm, depth_mm: p.depth_mm },
            p.category ?? p.name,
          ) ?? undefined,
        };
        const carryIn = checkCarryIn(carryInDims);

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
          margin_width_mm: bestFit.result.clearance_width_mm,
          margin_depth_mm: bestFit.result.clearance_depth_mm,
          margin_height_mm: bestFit.result.clearance_height_mm,
          fit_status: bestFit.result.status,
          fit_detail: bestFit.used_rotation
            ? `${bestFit.result.fit_detail}（製品を90度回転して設置）`
            : bestFit.result.fit_detail,
          used_rotation: bestFit.used_rotation,
          safety_margin_mm: bestFit.result.safety_margin_mm,
          ...(carryIn.risk !== "none" && { carry_in: carryIn }),
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
    logDemandSignal({
      timestamp: new Date().toISOString(),
      tool: "suggest_by_space",
      intent: params.intent,
      scene_name: scene?.scene ?? null,
      space: { width_mm, depth_mm, height_mm },
      keywords: {
        storage_keywords: keywords,
        categories: params.categories,
      },
      outcome: {
        result_count: 0,
        miss: true,
        miss_reason: "スペースに入る製品が見つからない",
      },
      safety_flags: safetyFlags,
    }).catch(() => {});
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
      margin_width_mm: p.margin_width_mm,
      margin_depth_mm: p.margin_depth_mm,
      margin_height_mm: p.margin_height_mm,
      fit_status: p.fit_status,
      fit_detail: p.fit_detail,
      used_rotation: p.used_rotation,
      safety_margin_mm: p.safety_margin_mm,
    };
    const arr = catMap.get(p.category) ?? [];
    arr.push(candidate);
    catMap.set(p.category, arr);
  }

  const categories: CategoryGroup[] = [];
  for (const [cat, products] of catMap) {
    products.sort((a, b) => {
      if (fitStatusRank[b.fit_status] !== fitStatusRank[a.fit_status]) {
        return fitStatusRank[b.fit_status] - fitStatusRank[a.fit_status];
      }
      return a.price - b.price;
    });
    categories.push({ category: cat, products: products.slice(0, 5) });
  }

  const rankedCandidates = categories
    .flatMap((group) => group.products)
    .sort((a, b) => {
      if (fitStatusRank[b.fit_status] !== fitStatusRank[a.fit_status]) {
        return fitStatusRank[b.fit_status] - fitStatusRank[a.fit_status];
      }
      const aMin = Math.min(a.margin_width_mm, a.margin_depth_mm, a.margin_height_mm);
      const bMin = Math.min(b.margin_width_mm, b.margin_depth_mm, b.margin_height_mm);
      if (bMin !== aMin) return bMin - aMin;
      return a.price - b.price;
    });
  const topCandidate = rankedCandidates[0];

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
      const fit = calcFittingCount(
        inner,
        st.width_mm,
        st.height_mm,
        st.depth_mm,
        {
          intent_text: params.intent,
          shelf_text: shelfText,
          storage_text: `${st.name} ${st.description ?? ""}`,
        },
      );
      if (!fit.fits || fit.total === 0) continue;
      fittingItems.push({
        product: {
          name: st.name, price: st.price,
          width_mm: st.width_mm, height_mm: st.height_mm, depth_mm: st.depth_mm,
          category: st.category, affiliate_url: st.affiliate_url, url: st.url,
          margin_width_mm: Math.max(-fit.overflow_width_mm, 0),
          margin_depth_mm: Math.max(-fit.overflow_depth_mm, 0),
          margin_height_mm: Math.max(-fit.overflow_height_mm, 0),
          fit_status: fit.status,
          fit_detail: fit.fit_detail,
          used_rotation: fit.used_rotation,
          safety_margin_mm: fit.safety_margin_mm,
        },
        per_tier: fit.per_tier,
        total: fit.total,
        fit_detail: fit.fit_detail,
        set_price: bestShelf.price + st.price * fit.total,
        fit_status: fit.status,
        used_rotation: fit.used_rotation,
        safety_margin_mm: fit.safety_margin_mm,
      });
    }

    if (fittingItems.length > 0) {
      fittingItems.sort((a, b) => {
        if (fitStatusRank[b.fit_status] !== fitStatusRank[a.fit_status]) {
          return fitStatusRank[b.fit_status] - fitStatusRank[a.fit_status];
        }
        return a.set_price - b.set_price;
      });
      const shelfAff = buildAffiliateUrl(bestShelf.url);
      coordinationPlan = {
        shelf: {
          name: bestShelf.name, price: bestShelf.price,
          width_mm: bestShelf.width_mm, height_mm: bestShelf.height_mm,
          depth_mm: bestShelf.depth_mm, category: bestShelf.category,
          affiliate_url: shelfAff.affiliate_url, url: bestShelf.url,
          margin_width_mm: bestShelf.margin_width_mm,
          margin_depth_mm: bestShelf.margin_depth_mm,
          margin_height_mm: bestShelf.margin_height_mm,
          fit_status: bestShelf.fit_status,
          fit_detail: bestShelf.fit_detail,
          used_rotation: bestShelf.used_rotation,
          safety_margin_mm: bestShelf.safety_margin_mm,
        },
        shelf_inner: {
          width_mm: inner.width_mm,
          height_per_tier_mm: inner.height_per_tier_mm,
          depth_mm: inner.depth_mm,
          tiers: inner.tiers,
          source: inner.source,
          confidence: inner.confidence,
          reason: inner.reason,
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
  logDemandSignal({
    timestamp: new Date().toISOString(),
    tool: "suggest_by_space",
    intent: params.intent,
    scene_name: scene?.scene ?? null,
    space: { width_mm, depth_mm, height_mm },
    keywords: {
      storage_keywords: keywords,
      categories: params.categories,
    },
    outcome: {
      result_count: totalCandidates,
      miss: false,
      top_fit_status: topCandidate?.fit_status,
      top_fit_detail: topCandidate?.fit_detail,
    },
    fit_context: {
      shelf_category: coordinationPlan?.shelf.category ?? topCandidate?.category,
      storage_category: coordinationPlan?.fitting_items[0]?.product.category,
      inner_source: coordinationPlan
        ? coordinationPlan.shelf_inner.source as "text_inner" | "known_spec" | "estimated"
        : undefined,
      inner_confidence: coordinationPlan
        ? coordinationPlan.shelf_inner.confidence as "high" | "medium" | "low"
        : undefined,
      safety_policy: topCandidate?.safety_margin_mm.policy,
      used_rotation: topCandidate?.used_rotation,
    },
    safety_flags: topCandidate?.used_rotation
      ? [...safetyFlags, "rotated_placement"]
      : safetyFlags,
  }).catch(() => {});

  const carryInWarnings = categories
    .flatMap((g) => g.products)
    .filter((p) => p.carry_in && p.carry_in.risk !== "none")
    .map((p) => p.carry_in!);
  const uniqueCarryIn = carryInWarnings.filter(
    (w, i, arr) => arr.findIndex((x) => x.risk === w.risk && x.max_side_mm === w.max_side_mm) === i,
  );

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
    ...(uniqueCarryIn.length > 0 && { carry_in_warnings: uniqueCarryIn }),
  };
}
