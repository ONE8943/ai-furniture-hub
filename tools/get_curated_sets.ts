/**
 * キュレーション済みセット提案ツール
 *
 * バンドル / ルームプリセット / インフルエンサーPick / ハックセット を
 * 条件に応じて検索・返却する。
 */
import { z } from "zod";
import {
  BUNDLES,
  INFLUENCER_PICKS,
  ROOM_PRESETS,
  HACK_SETS,
  findBundlesByOccasion,
  findPresetsByScene,
} from "../data/curation";
import type {
  CuratedBundle,
  InfluencerPick,
  RoomPreset,
  HackSet,
  CurationType,
} from "../data/curation";
import { KNOWN_PRODUCTS_DB } from "../shared/catalog/known_products";
import { logAnalytics, buildHitLog, buildMissLog } from "../utils/logger";
import { injectAttribution } from "../shared/attribution/index";
import { logAttribution } from "../utils/attribution_logger";

export const GET_CURATED_SETS_SCHEMA = {
  intent: z.string().min(1).describe("【必須】なぜこの提案が必要か"),
  type: z.enum(["bundle", "room_preset", "influencer_pick", "hack_set"]).optional()
    .describe("絞り込み: bundle / room_preset / influencer_pick / hack_set"),
  scene: z.string().optional().describe("シーン（書斎、キッチン、リビング等）"),
  occasion: z.string().optional().describe("オケージョン（新生活、引越し、出産準備等）"),
  budget_max: z.number().optional().describe("予算上限（円）"),
  keyword: z.string().optional().describe("フリーワード検索"),
};

function resolveProductNames(ids: string[]): Array<{ id: string; name: string; brand: string }> {
  return ids.map((id) => {
    const p = KNOWN_PRODUCTS_DB.find((prod) => prod.id === id);
    return p
      ? { id: p.id, name: p.name, brand: p.brand }
      : { id, name: "(カタログ外)", brand: "" };
  });
}

export interface CuratedSetsResult {
  bundles: Array<CuratedBundle & { products: Array<{ id: string; name: string; brand: string }> }>;
  room_presets: Array<RoomPreset & { products: Array<{ id: string; name: string; brand: string }> }>;
  influencer_picks: Array<InfluencerPick & { products: Array<{ id: string; name: string; brand: string }> }>;
  hack_sets: Array<HackSet & { target_products: Array<{ id: string; name: string; brand: string }> }>;
  total_results: number;
  miss: boolean;
}

export async function getCuratedSets(rawInput: unknown): Promise<CuratedSetsResult> {
  const params = rawInput as {
    intent: string;
    type?: CurationType;
    scene?: string;
    occasion?: string;
    budget_max?: number;
    keyword?: string;
  };

  const kw = params.keyword?.toLowerCase();

  let bundles = params.type && params.type !== "bundle" ? [] : [...BUNDLES];
  let presets = params.type && params.type !== "room_preset" ? [] : [...ROOM_PRESETS];
  let picks = params.type && params.type !== "influencer_pick" ? [] : [...INFLUENCER_PICKS];
  let hacks = params.type && params.type !== "hack_set" ? [] : [...HACK_SETS];

  if (params.occasion) {
    bundles = findBundlesByOccasion(params.occasion);
  }
  if (params.scene) {
    presets = findPresetsByScene(params.scene);
  }
  if (params.budget_max) {
    bundles = bundles.filter((b) => b.total_price_yen <= params.budget_max!);
    presets = presets.filter((r) => r.budget_total_yen <= params.budget_max!);
  }
  if (kw) {
    bundles = bundles.filter(
      (b) => b.title.toLowerCase().includes(kw) || b.description.toLowerCase().includes(kw)
    );
    presets = presets.filter(
      (r) => r.title.toLowerCase().includes(kw) || r.target_persona.toLowerCase().includes(kw)
    );
    picks = picks.filter(
      (p) =>
        p.title.toLowerCase().includes(kw) ||
        p.curator_name.toLowerCase().includes(kw) ||
        p.why_picked.toLowerCase().includes(kw)
    );
    hacks = hacks.filter(
      (h) => h.title.toLowerCase().includes(kw) || h.tags.some((t) => t.includes(kw))
    );
  }

  const total = bundles.length + presets.length + picks.length + hacks.length;

  if (total === 0) {
    const missLog = buildMissLog("get_curated_sets", params, params.intent, "条件に一致するキュレーションなし");
    logAnalytics(missLog).catch(() => {});
  } else {
    const hitLog = buildHitLog("get_curated_sets", params, params.intent, total);
    logAnalytics(hitLog).catch(() => {});
  }

  const result = {
    bundles: bundles.map((b) => ({ ...b, products: resolveProductNames(b.product_ids) })),
    room_presets: presets.map((r) => ({ ...r, products: resolveProductNames(r.product_ids) })),
    influencer_picks: picks.map((p) => ({ ...p, products: resolveProductNames(p.product_ids) })),
    hack_sets: hacks.map((h) => ({
      ...h,
      target_products: resolveProductNames(h.target_product_ids),
    })),
    total_results: total,
    miss: total === 0,
  };

  const attributed = injectAttribution(result, "get_curated_sets");
  logAttribution(attributed._attribution, total, params).catch(() => {});
  return attributed;
}
