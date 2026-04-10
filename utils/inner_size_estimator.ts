/**
 * 棚の外寸から内寸を推定し、収納ボックスが何個入るかを計算する。
 *
 * カラーボックス・スチールラック等の種類ごとに板厚ルールを分岐し、
 * テキスト中に内寸や段数が書かれていればそれを優先抽出する。
 */

import { extractDimensions } from "../adapters/rakuten_api";

// -----------------------------------------------------------------------
// 既知スペックテーブル（メーカー公称値ベース）
// -----------------------------------------------------------------------

interface KnownSpec {
  keywords: string[];
  inner_width_mm: number;
  inner_depth_mm: number;
  inner_height_per_tier_mm: number;
  default_tiers: number;
}

const KNOWN_SPECS: KnownSpec[] = [
  {
    keywords: ["nクリック", "n-click", "nclick"],
    inner_width_mm: 380,
    inner_depth_mm: 260,
    inner_height_per_tier_mm: 270,
    default_tiers: 5,
  },
  {
    keywords: ["カラーボックス 3段", "カラーbox 3段"],
    inner_width_mm: 390,
    inner_depth_mm: 260,
    inner_height_per_tier_mm: 330,
    default_tiers: 3,
  },
  {
    keywords: ["カラーボックス 2段", "カラーbox 2段"],
    inner_width_mm: 390,
    inner_depth_mm: 260,
    inner_height_per_tier_mm: 330,
    default_tiers: 2,
  },
];

// -----------------------------------------------------------------------
// 棚の種類ごとの板厚マージン (mm)
// -----------------------------------------------------------------------

interface ThicknessRule {
  keywords: string[];
  side_mm: number;      // 左右の板厚合計
  back_mm: number;      // 背板厚 + 前方マージン
  shelf_plate_mm: number; // 棚板厚（高さ計算用）
}

const THICKNESS_RULES: ThicknessRule[] = [
  {
    keywords: ["スチールラック", "メタルラック", "ワイヤーラック", "ルミナス"],
    side_mm: 10, back_mm: 0, shelf_plate_mm: 5,
  },
  {
    keywords: ["カラーボックス", "カラーbox"],
    side_mm: 20, back_mm: 30, shelf_plate_mm: 15,
  },
  {
    keywords: ["キャビネット", "食器棚", "本棚"],
    side_mm: 30, back_mm: 40, shelf_plate_mm: 18,
  },
];

const DEFAULT_THICKNESS: ThicknessRule = {
  keywords: [],
  side_mm: 20, back_mm: 30, shelf_plate_mm: 15,
};

// -----------------------------------------------------------------------
// 段数推定
// -----------------------------------------------------------------------

export function estimateTiers(text: string): number | null {
  const normalized = text.normalize("NFKC");
  const m = normalized.match(/(\d+)\s*段/);
  if (m) return parseInt(m[1]!, 10);

  const tier_map: Record<string, number> = {
    "一段": 1, "二段": 2, "三段": 3, "四段": 4,
    "五段": 5, "六段": 6, "七段": 7,
  };
  for (const [k, v] of Object.entries(tier_map)) {
    if (normalized.includes(k)) return v;
  }
  return null;
}

// -----------------------------------------------------------------------
// 内寸テキスト抽出
// -----------------------------------------------------------------------

interface ParsedInner {
  width_mm: number | null;
  height_mm: number | null;
  depth_mm: number | null;
}

function extractInnerDimensions(text: string): ParsedInner | null {
  const normalized = text.normalize("NFKC");

  const m = normalized.match(
    /内寸[：:]?\s*(?:約\s*)?(?:幅\s*)?(\d+(?:\.\d+)?)\s*[×xX*]\s*(?:奥行[きケ]?\s*)?(\d+(?:\.\d+)?)\s*[×xX*]\s*(?:高さ?\s*)?(\d+(?:\.\d+)?)\s*(cm|mm)/i
  );
  if (m) {
    const factor = m[4]!.toLowerCase() === "mm" ? 1 : 10;
    return {
      width_mm: Math.round(parseFloat(m[1]!) * factor),
      depth_mm: Math.round(parseFloat(m[2]!) * factor),
      height_mm: Math.round(parseFloat(m[3]!) * factor),
    };
  }
  return null;
}

// -----------------------------------------------------------------------
// 内寸推定メイン
// -----------------------------------------------------------------------

export interface EstimatedInner {
  width_mm: number;
  height_per_tier_mm: number;
  depth_mm: number;
  tiers: number;
  source: "text_inner" | "known_spec" | "estimated";
}

export function estimateInnerSize(
  outer_width_mm: number,
  outer_height_mm: number,
  outer_depth_mm: number,
  productText: string,
): EstimatedInner {
  const lower = productText.normalize("NFKC").toLowerCase();
  const tiers = estimateTiers(productText);

  // 1. テキスト中に内寸があればそれを優先
  const textInner = extractInnerDimensions(productText);
  if (textInner && textInner.width_mm && textInner.depth_mm && textInner.height_mm) {
    const t = tiers ?? 3;
    return {
      width_mm: textInner.width_mm,
      height_per_tier_mm: textInner.height_mm,
      depth_mm: textInner.depth_mm,
      tiers: t,
      source: "text_inner",
    };
  }

  // 2. 既知スペックテーブルに一致するか
  for (const spec of KNOWN_SPECS) {
    if (spec.keywords.some((kw) => lower.includes(kw))) {
      return {
        width_mm: spec.inner_width_mm,
        height_per_tier_mm: spec.inner_height_per_tier_mm,
        depth_mm: spec.inner_depth_mm,
        tiers: tiers ?? spec.default_tiers,
        source: "known_spec",
      };
    }
  }

  // 3. 板厚ルールから推定
  let rule = DEFAULT_THICKNESS;
  for (const r of THICKNESS_RULES) {
    if (r.keywords.some((kw) => lower.includes(kw))) {
      rule = r;
      break;
    }
  }

  const t = tiers ?? 3;
  const usable_height = outer_height_mm - rule.shelf_plate_mm * (t + 1);
  const height_per_tier = Math.max(Math.round(usable_height / t), 50);

  return {
    width_mm: Math.max(outer_width_mm - rule.side_mm, 50),
    height_per_tier_mm: height_per_tier,
    depth_mm: Math.max(outer_depth_mm - rule.back_mm, 50),
    tiers: t,
    source: "estimated",
  };
}

// -----------------------------------------------------------------------
// 個数計算
// -----------------------------------------------------------------------

export interface FitResult {
  fits: boolean;
  per_tier_across: number;
  per_tier_deep: number;
  per_tier: number;
  total: number;
  overflow_width_mm: number;
  overflow_depth_mm: number;
  overflow_height_mm: number;
  fit_detail: string;
}

/**
 * 棚の1段の内寸に収納ボックスが何個入るかを計算する。
 *
 * 横並び = floor(棚内幅 / 収納外幅)
 * 奥行き列 = floor(棚内奥行 / 収納外奥行)
 * 高さ: 収納の高さが1段の高さを超えたら入らない
 */
export function calcFittingCount(
  shelfInner: EstimatedInner,
  storageWidth: number,
  storageHeight: number,
  storageDepth: number,
): FitResult {
  if (storageWidth <= 0 || storageHeight <= 0 || storageDepth <= 0) {
    return {
      fits: false, per_tier_across: 0, per_tier_deep: 0,
      per_tier: 0, total: 0,
      overflow_width_mm: 0, overflow_depth_mm: 0, overflow_height_mm: 0,
      fit_detail: "収納ボックスのサイズ情報が不明です",
    };
  }

  const across = Math.floor(shelfInner.width_mm / storageWidth);
  const deep = Math.floor(shelfInner.depth_mm / storageDepth);
  const heightOk = storageHeight <= shelfInner.height_per_tier_mm;

  const per_tier = across * deep;
  const total = per_tier * shelfInner.tiers;

  const overflow_w = storageWidth - shelfInner.width_mm;
  const overflow_d = storageDepth - shelfInner.depth_mm;
  const overflow_h = storageHeight - shelfInner.height_per_tier_mm;

  if (!heightOk) {
    return {
      fits: false, per_tier_across: across, per_tier_deep: deep,
      per_tier: 0, total: 0,
      overflow_width_mm: overflow_w, overflow_depth_mm: overflow_d,
      overflow_height_mm: overflow_h,
      fit_detail: `高さが${overflow_h}mm超過（棚1段:${shelfInner.height_per_tier_mm}mm < 収納:${storageHeight}mm）`,
    };
  }

  if (per_tier === 0) {
    const reasons: string[] = [];
    if (across === 0) reasons.push(`幅が${overflow_w}mm超過`);
    if (deep === 0) reasons.push(`奥行が${overflow_d}mm超過`);
    return {
      fits: false, per_tier_across: across, per_tier_deep: deep,
      per_tier: 0, total: 0,
      overflow_width_mm: overflow_w, overflow_depth_mm: overflow_d,
      overflow_height_mm: overflow_h,
      fit_detail: reasons.join("、") || "サイズが合いません",
    };
  }

  return {
    fits: true,
    per_tier_across: across,
    per_tier_deep: deep,
    per_tier,
    total,
    overflow_width_mm: overflow_w,
    overflow_depth_mm: overflow_d,
    overflow_height_mm: overflow_h,
    fit_detail: `横${across}個 x 奥${deep}個 x ${shelfInner.tiers}段 = ${total}個`,
  };
}
