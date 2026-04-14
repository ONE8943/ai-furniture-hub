/**
 * コーディネート提案ツール
 *
 * 棚を検索 → 内寸推定 → 棚に入る収納ボックスを検索 → 個数計算 → セット提案
 *
 * AIエージェントが「カラーボックスに合う収納ボックスも一緒に提案して」と
 * 言われたときに、このツール1つで棚+中身のセット提案を返す。
 */
import { z } from "zod";
import { searchRakutenProducts, RakutenSearchResult, extractDimensions } from "../adapters/rakuten_api";
import { estimateInnerSize, calcFittingCount, type FitStatus } from "../utils/inner_size_estimator";
import { detectScene, SceneCoordinate, PersonaHint } from "../data/scene_coordinates";
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

export const CoordinateParamsSchema = z.object({
  intent: z.string().min(1).describe(
    "【必須】設置場所・用途・状況を詳細に記述。シーン推定に使用。"
  ),
  keyword: z.string().min(1).describe(
    "棚の検索キーワード（例: 'カラーボックス 3段', 'スチールラック 幅90'）"
  ),
  price_max: z.number().int().positive().optional().describe("棚の予算上限（円）"),
  storage_keyword: z.string().optional().describe(
    "収納ボックスの検索キーワード（省略時はシーンDBから自動推定）"
  ),
  scene: z.string().optional().describe(
    "設置場所ヒント（'押入れ','洗面所','キッチン'等、省略可）"
  ),
  shelf_count: z.number().int().min(1).max(5).optional().default(3).describe(
    "提案する棚の件数（1〜5、デフォルト3）"
  ),
});

export type CoordinateParams = z.infer<typeof CoordinateParamsSchema>;

// -----------------------------------------------------------------------
// 出力型
// -----------------------------------------------------------------------

interface ProductSummary {
  name: string;
  price: number;
  width_mm: number;
  height_mm: number;
  depth_mm: number;
  category?: string;
  affiliate_url: string;
  url: string;
}

interface FittingStorage {
  storage: ProductSummary;
  per_tier: number;
  total: number;
  set_price: number;
  fit_detail: string;
  fit_status: FitStatus;
  used_rotation: boolean;
  safety_margin_mm: {
    width_mm: number;
    depth_mm: number;
    height_mm: number;
    policy: string;
  };
}

interface ShelfProposal {
  shelf: ProductSummary;
  estimated_inner: {
    width_mm: number;
    height_per_tier_mm: number;
    depth_mm: number;
    tiers: number;
    source: string;
    confidence: string;
    reason: string;
  };
  fitting_storage: FittingStorage[];
  carry_in?: CarryInNote;
}

export interface CoordinateResult {
  shelves: ShelfProposal[];
  scene_tips: string[];
  scene_name: string | null;
  persona_hints?: PersonaHint[];
  total_combinations: number;
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

const fitStatusRank: Record<FitStatus, number> = {
  safe_fit: 3,
  tight_fit: 2,
  near_miss: 1,
  miss: 0,
};

// -----------------------------------------------------------------------
// メインロジック
// -----------------------------------------------------------------------

export async function coordinateStorage(rawInput: unknown): Promise<CoordinateResult> {
  const params = parseOrThrow(CoordinateParamsSchema, rawInput);

  // Gap検知
  const gapResult: GapDetectionResult = detectGaps(params.intent);
  if (gapResult.has_gaps) {
    const gapEntry: RequirementGap = {
      timestamp: new Date().toISOString(),
      tool: "coordinate_storage",
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
  const sceneText = params.scene ?? params.intent;
  const scene: SceneCoordinate | null = detectScene(sceneText);
  const safetyFlags = inferSafetyFlags(`${params.intent} ${scene?.scene ?? ""}`);

  // Step 1: 棚を楽天で検索
  let shelfResult: RakutenSearchResult;
  try {
    shelfResult = await searchRakutenProducts({
      keyword: params.keyword,
      maxPrice: params.price_max,
      hits: params.shelf_count ?? 3,
    });
  } catch (e) {
    throw new Error(`棚の検索に失敗: ${e instanceof Error ? e.message : String(e)}`);
  }

  // 寸法が取れた棚のみ残す
  const validShelves = shelfResult.products.filter(
    (p) => p.width_mm > 0 && p.height_mm > 0 && p.depth_mm > 0
  );

  if (validShelves.length === 0) {
    const missLog = buildMissLog("coordinate_storage", { keyword: params.keyword }, params.intent, "棚が見つからない");
    logAnalytics(missLog).catch(() => {});
    logDemandSignal({
      timestamp: new Date().toISOString(),
      tool: "coordinate_storage",
      intent: params.intent,
      scene_name: scene?.scene ?? null,
      keywords: {
        shelf_keyword: params.keyword,
      },
      outcome: {
        result_count: 0,
        miss: true,
        miss_reason: "棚が見つからない",
      },
      safety_flags: safetyFlags,
    }).catch(() => {});
    return {
      shelves: [],
      scene_tips: scene?.tips ?? [],
      scene_name: scene?.scene ?? null,
      ...(scene?.personas && { persona_hints: scene.personas }),
      total_combinations: 0,
      source: shelfResult.source,
      miss: true,
      miss_reason: "条件に合う棚が見つかりませんでした（寸法情報のある商品が0件）。",
      suggestion: "キーワードを変更するか、予算を広げてみてください。",
      ...(gapFeedback && { gap_feedback: gapFeedback }),
    };
  }

  // Step 2: 収納ボックスの検索キーワード決定
  const storageKeywords: string[] = [];
  if (params.storage_keyword) {
    storageKeywords.push(params.storage_keyword);
  } else if (scene) {
    storageKeywords.push(...scene.recommended_storage_keywords.slice(0, 2));
  } else {
    storageKeywords.push("収納ボックス インナーケース");
  }

  // Step 3: 収納ボックスを検索（1回で取得、棚ごとに使い回す）
  const allStorageProducts: RakutenSearchResult["products"] = [];
  for (const kw of storageKeywords) {
    try {
      const sr = await searchRakutenProducts({ keyword: kw, hits: 10 });
      allStorageProducts.push(...sr.products);
    } catch {
      // 1つ失敗しても続行
    }
  }

  // 寸法が取れた収納のみ
  const validStorage = allStorageProducts.filter(
    (p) => p.width_mm > 0 && p.height_mm > 0 && p.depth_mm > 0
  );

  // Step 4: 棚ごとにマッチング
  const shelves: ShelfProposal[] = [];
  let totalCombinations = 0;

  for (const shelf of validShelves) {
    const productText = `${shelf.name} ${shelf.description ?? ""}`;
    const inner = estimateInnerSize(
      shelf.width_mm, shelf.height_mm, shelf.depth_mm, productText
    );

    const shelfAff = buildAffiliateUrl(
      shelf.platform_urls?.["rakuten"] ?? shelf.url ?? ""
    );

    const fittingStorage: FittingStorage[] = [];

    for (const st of validStorage) {
      const fit = calcFittingCount(
        inner,
        st.width_mm,
        st.height_mm,
        st.depth_mm,
        {
          intent_text: params.intent,
          shelf_text: productText,
          storage_text: `${st.name} ${st.description ?? ""}`,
        },
      );
      if (!fit.fits || fit.total === 0) continue;

      const stAff = buildAffiliateUrl(
        st.platform_urls?.["rakuten"] ?? st.url ?? ""
      );

      fittingStorage.push({
        storage: {
          name: st.name,
          price: st.price,
          width_mm: st.width_mm,
          height_mm: st.height_mm,
          depth_mm: st.depth_mm,
          category: st.category ?? "家具・収納",
          affiliate_url: stAff.affiliate_url,
          url: st.url ?? "",
        },
        per_tier: fit.per_tier,
        total: fit.total,
        set_price: shelf.price + st.price * fit.total,
        fit_detail: fit.fit_detail,
        fit_status: fit.status,
        used_rotation: fit.used_rotation,
        safety_margin_mm: fit.safety_margin_mm,
      });
    }

    fittingStorage.sort((a, b) => {
      if (fitStatusRank[b.fit_status] !== fitStatusRank[a.fit_status]) {
        return fitStatusRank[b.fit_status] - fitStatusRank[a.fit_status];
      }
      return a.set_price - b.set_price;
    });

    totalCombinations += fittingStorage.length;

    const shelfCarryIn = checkCarryIn({
      width_mm: shelf.width_mm,
      height_mm: shelf.height_mm,
      depth_mm: shelf.depth_mm,
      weight_kg: inferWeightFromDimensions(
        { width_mm: shelf.width_mm, height_mm: shelf.height_mm, depth_mm: shelf.depth_mm },
        shelf.category ?? shelf.name,
      ) ?? undefined,
    });

    shelves.push({
      shelf: {
        name: shelf.name,
        price: shelf.price,
        width_mm: shelf.width_mm,
        height_mm: shelf.height_mm,
        depth_mm: shelf.depth_mm,
        category: shelf.category ?? "家具・収納",
        affiliate_url: shelfAff.affiliate_url,
        url: shelf.url ?? "",
      },
      estimated_inner: {
        width_mm: inner.width_mm,
        height_per_tier_mm: inner.height_per_tier_mm,
        depth_mm: inner.depth_mm,
        tiers: inner.tiers,
        source: inner.source,
        confidence: inner.confidence,
        reason: inner.reason,
      },
      fitting_storage: fittingStorage.slice(0, 5),
      ...(shelfCarryIn.risk !== "none" && { carry_in: shelfCarryIn }),
    });
  }

  // ログ
  const hitLog = buildHitLog(
    "coordinate_storage",
    { keyword: params.keyword, storage_keywords: storageKeywords },
    params.intent,
    totalCombinations,
  );
  logAnalytics(hitLog).catch(() => {});

  const topShelf = shelves.find((s) => s.fitting_storage.length > 0) ?? shelves[0];
  const topStorage = topShelf?.fitting_storage[0];
  logDemandSignal({
    timestamp: new Date().toISOString(),
    tool: "coordinate_storage",
    intent: params.intent,
    scene_name: scene?.scene ?? null,
    keywords: {
      shelf_keyword: params.keyword,
      storage_keywords: storageKeywords,
    },
    outcome: {
      result_count: totalCombinations,
      miss: totalCombinations === 0,
      top_fit_status: topStorage?.fit_status,
      top_fit_detail: topStorage?.fit_detail,
      miss_reason: totalCombinations === 0
        ? "棚は見つかったが、内寸に合う収納ボックスが見つからない"
        : undefined,
    },
    fit_context: {
      shelf_category: topShelf?.shelf.category,
      storage_category: topStorage?.storage.category,
      inner_source: topShelf
        ? topShelf.estimated_inner.source as "text_inner" | "known_spec" | "estimated"
        : undefined,
      inner_confidence: topShelf
        ? topShelf.estimated_inner.confidence as "high" | "medium" | "low"
        : undefined,
      safety_policy: topStorage?.safety_margin_mm.policy,
      used_rotation: topStorage?.used_rotation,
    },
    safety_flags: topStorage?.used_rotation
      ? [...safetyFlags, "rotated_placement"]
      : safetyFlags,
  }).catch(() => {});

  return {
    shelves,
    scene_tips: scene?.tips ?? [],
    scene_name: scene?.scene ?? null,
    ...(scene?.personas && { persona_hints: scene.personas }),
    total_combinations: totalCombinations,
    source: shelfResult.source,
    miss: totalCombinations === 0,
    ...(totalCombinations === 0 && {
      miss_reason: "棚は見つかりましたが、内寸に合う収納ボックスが見つかりませんでした。",
      suggestion: "収納ボックスのキーワードを変えるか、別サイズの棚を試してみてください。",
    }),
    ...(gapFeedback && { gap_feedback: gapFeedback }),
  };
}
