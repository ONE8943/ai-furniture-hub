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
  {
    keywords: ["kallax", "カラックス"],
    inner_width_mm: 330,
    inner_depth_mm: 380,
    inner_height_per_tier_mm: 330,
    default_tiers: 4,
  },
  {
    keywords: ["billy", "ビリー"],
    inner_width_mm: 760,
    inner_depth_mm: 260,
    inner_height_per_tier_mm: 350,
    default_tiers: 5,
  },
  {
    keywords: ["stax", "スタックス", "スタックスボックス"],
    inner_width_mm: 260,
    inner_depth_mm: 370,
    inner_height_per_tier_mm: 240,
    default_tiers: 1,
  },
  {
    keywords: ["ポリプロピレン収納ケース", "pp収納ケース"],
    inner_width_mm: 340,
    inner_depth_mm: 440,
    inner_height_per_tier_mm: 180,
    default_tiers: 1,
  },
  {
    keywords: ["fits", "フィッツ", "フィッツケース"],
    inner_width_mm: 340,
    inner_depth_mm: 550,
    inner_height_per_tier_mm: 180,
    default_tiers: 1,
  },
  {
    keywords: ["nインボックス", "インボックス"],
    inner_width_mm: 375,
    inner_depth_mm: 262,
    inner_height_per_tier_mm: 233,
    default_tiers: 1,
  },
];

// -----------------------------------------------------------------------
// 棚の種類ごとの板厚マージン (mm)
// -----------------------------------------------------------------------

interface ThicknessRule {
  keywords: string[];
  side_mm: number;
  back_mm: number;
  shelf_plate_mm: number;
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
  {
    keywords: ["シェルフ", "ラック", "オープンラック", "ワゴン"],
    side_mm: 20, back_mm: 20, shelf_plate_mm: 15,
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

  const tierMap: Record<string, number> = {
    "一段": 1,
    "二段": 2,
    "三段": 3,
    "四段": 4,
    "五段": 5,
    "六段": 6,
    "七段": 7,
  };
  for (const [k, v] of Object.entries(tierMap)) {
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
  reason?: string;
}

function toMm(value: string, unit: string): number {
  const num = parseFloat(value);
  return unit.toLowerCase() === "mm" ? Math.round(num) : Math.round(num * 10);
}

function injectTrailingUnit(block: string): string {
  const units = Array.from(block.matchAll(/\b(cm|mm)\b/ig));
  const fallbackUnit = units.length > 0 ? units[units.length - 1]![1]! : null;
  if (!fallbackUnit) return block;

  return block.replace(
    /((?:幅|横幅|奥行[きケ]?|高さ?|W|D|H)\s*[:：]?\s*\d+(?:\.\d+)?)(?!\s*(?:cm|mm))/ig,
    `$1${fallbackUnit}`,
  );
}

function inferDefaultTiers(normalizedLower: string): number {
  if (/(収納ケース|衣装ケース|ケース|ボックス|バスケット|ファイルボックス|トレー|ゴミ箱)/.test(normalizedLower)) {
    return 1;
  }
  if (/(ワゴン|wagon)/.test(normalizedLower)) {
    return 3;
  }
  if (/(スチールラック|メタルラック|ワイヤーラック|ラック|シェルフ|本棚|オープンラック|カラーボックス)/.test(normalizedLower)) {
    return 3;
  }
  if (/(キャビネット|食器棚|チェスト)/.test(normalizedLower)) {
    return 2;
  }
  return 1;
}

function extractInnerDimensions(text: string): ParsedInner | null {
  const normalized = text.normalize("NFKC");
  const innerBlock = normalized.match(
    /(?:有効|収納部|引き出し|引出し|棚板|棚|ケース|1マス)?(?:内寸|内径|有効内寸|棚板間)[^。\n\r]{0,120}/i,
  )?.[0];
  if (!innerBlock) return null;

  const tripleMatch = innerBlock.match(
    /(?:有効|収納部|引き出し|引出し|棚板|棚|ケース|1マス)?内寸[：:\s()]*?(?:約\s*)?(?:幅\s*)?(\d+(?:\.\d+)?)\s*[×xX*／/]\s*(?:奥行[きケ]?\s*)?(\d+(?:\.\d+)?)\s*[×xX*／/]\s*(?:高さ?\s*)?(\d+(?:\.\d+)?)\s*(cm|mm)/i,
  );
  if (tripleMatch) {
    return {
      width_mm: toMm(tripleMatch[1]!, tripleMatch[4]!),
      depth_mm: toMm(tripleMatch[2]!, tripleMatch[4]!),
      height_mm: toMm(tripleMatch[3]!, tripleMatch[4]!),
      reason: "text_inner_triple",
    };
  }

  const normalizedBlock = injectTrailingUnit(
    innerBlock.replace(
      /(?:有効|収納部|引き出し|引出し|棚板|棚|ケース|1マス)?内寸[：:]?/i,
      "サイズ:",
    ),
  );
  const parsed = extractDimensions(normalizedBlock);
  if (parsed.width_mm && parsed.depth_mm && parsed.height_mm) {
    return {
      width_mm: parsed.width_mm,
      depth_mm: parsed.depth_mm,
      height_mm: parsed.height_mm,
      reason: "text_inner_labeled",
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
  confidence: "high" | "medium" | "low";
  reason: string;
}

export function estimateInnerSize(
  outer_width_mm: number,
  outer_height_mm: number,
  outer_depth_mm: number,
  productText: string,
): EstimatedInner {
  const lower = productText.normalize("NFKC").toLowerCase();
  const tiers = estimateTiers(productText);
  const inferredTiers = Math.max(tiers ?? inferDefaultTiers(lower), 1);

  const textInner = extractInnerDimensions(productText);
  if (textInner && textInner.width_mm && textInner.depth_mm && textInner.height_mm) {
    return {
      width_mm: textInner.width_mm,
      height_per_tier_mm: textInner.height_mm,
      depth_mm: textInner.depth_mm,
      tiers: inferredTiers,
      source: "text_inner",
      confidence: "high",
      reason: textInner.reason ?? "text_inner_detected",
    };
  }

  for (const spec of KNOWN_SPECS) {
    if (spec.keywords.some((kw) => lower.includes(kw))) {
      return {
        width_mm: spec.inner_width_mm,
        height_per_tier_mm: spec.inner_height_per_tier_mm,
        depth_mm: spec.inner_depth_mm,
        tiers: tiers ?? spec.default_tiers,
        source: "known_spec",
        confidence: "high",
        reason: `known_spec:${spec.keywords[0]}`,
      };
    }
  }

  let rule = DEFAULT_THICKNESS;
  for (const r of THICKNESS_RULES) {
    if (r.keywords.some((kw) => lower.includes(kw))) {
      rule = r;
      break;
    }
  }

  const usableHeight = outer_height_mm - rule.shelf_plate_mm * (inferredTiers + 1);
  const heightPerTier = Math.max(Math.round(usableHeight / inferredTiers), 50);

  return {
    width_mm: Math.max(outer_width_mm - rule.side_mm, 50),
    height_per_tier_mm: heightPerTier,
    depth_mm: Math.max(outer_depth_mm - rule.back_mm, 50),
    tiers: inferredTiers,
    source: "estimated",
    confidence: rule === DEFAULT_THICKNESS ? "low" : "medium",
    reason: rule === DEFAULT_THICKNESS
      ? "outer_dimensions_default_margin"
      : `outer_dimensions_rule:${rule.keywords[0]}`,
  };
}

// -----------------------------------------------------------------------
// fit 判定
// -----------------------------------------------------------------------

export type FitStatus = "safe_fit" | "tight_fit" | "near_miss" | "miss";

interface FitMarginPolicy {
  label: string;
  hard_width_mm: number;
  hard_depth_mm: number;
  hard_height_mm: number;
  near_miss_width_mm: number;
  near_miss_depth_mm: number;
  near_miss_height_mm: number;
}

export interface FitContext {
  shelf_text?: string;
  storage_text?: string;
  intent_text?: string;
  space_text?: string;
  item_text?: string;
}

export interface FitResult {
  fits: boolean;
  status: FitStatus;
  per_tier_across: number;
  per_tier_deep: number;
  per_tier: number;
  total: number;
  overflow_width_mm: number;
  overflow_depth_mm: number;
  overflow_height_mm: number;
  fit_detail: string;
  used_rotation: boolean;
  failed_axes: Array<"width" | "depth" | "height">;
  safety_margin_mm: { width_mm: number; depth_mm: number; height_mm: number; policy: string };
}

export interface SpaceFitResult {
  fits: boolean;
  status: FitStatus;
  clearance_width_mm: number;
  clearance_depth_mm: number;
  clearance_height_mm: number;
  failed_axes: Array<"width" | "depth" | "height">;
  fit_detail: string;
  safety_margin_mm: { width_mm: number; depth_mm: number; height_mm: number; policy: string };
}

function getFitMarginPolicy(context?: FitContext): FitMarginPolicy {
  const text = [
    context?.shelf_text,
    context?.storage_text,
    context?.intent_text,
    context?.space_text,
    context?.item_text,
  ]
    .filter(Boolean)
    .join(" ")
    .normalize("NFKC")
    .toLowerCase();

  if (/デスク下/.test(text) && /(椅子|チェア)/.test(text)) {
    return {
      label: "desk_chair",
      hard_width_mm: 50,
      hard_depth_mm: 30,
      hard_height_mm: 20,
      near_miss_width_mm: 20,
      near_miss_depth_mm: 15,
      near_miss_height_mm: 10,
    };
  }

  if (/(デスク下|ワゴン|wagon)/.test(text)) {
    return {
      label: "desk_wagon",
      hard_width_mm: 10,
      hard_depth_mm: 30,
      hard_height_mm: 15,
      near_miss_width_mm: 10,
      near_miss_depth_mm: 15,
      near_miss_height_mm: 10,
    };
  }

  if (/(洗面|ランドリー|洗濯機|サニタリー|すき間|隙間)/.test(text)) {
    return {
      label: "washroom_gap",
      hard_width_mm: 8,
      hard_depth_mm: 15,
      hard_height_mm: 10,
      near_miss_width_mm: 12,
      near_miss_depth_mm: 15,
      near_miss_height_mm: 10,
    };
  }

  if (/(クローゼット|衣装|押入)/.test(text)) {
    return {
      label: "closet_storage",
      hard_width_mm: 8,
      hard_depth_mm: 10,
      hard_height_mm: 10,
      near_miss_width_mm: 10,
      near_miss_depth_mm: 15,
      near_miss_height_mm: 10,
    };
  }

  return {
    label: "default_storage",
    hard_width_mm: 5,
    hard_depth_mm: 5,
    hard_height_mm: 5,
    near_miss_width_mm: 10,
    near_miss_depth_mm: 10,
    near_miss_height_mm: 10,
  };
}

function buildFailReasons(
  failedAxes: Array<"width" | "depth" | "height">,
  overflowWidth: number,
  overflowDepth: number,
  overflowHeight: number,
  shelfInner?: EstimatedInner,
  storageHeight?: number,
): string[] {
  const reasons: string[] = [];
  if (failedAxes.includes("height")) {
    reasons.push(
      shelfInner
        ? `高さが${overflowHeight}mm超過（棚1段:${shelfInner.height_per_tier_mm}mm < 収納:${storageHeight ?? 0}mm）`
        : `高さが${overflowHeight}mm超過`,
    );
  }
  if (failedAxes.includes("width")) reasons.push(`幅が${overflowWidth}mm超過`);
  if (failedAxes.includes("depth")) reasons.push(`奥行が${overflowDepth}mm超過`);
  return reasons;
}

function buildInnerFitDetail(
  status: FitStatus,
  perTierAcross: number,
  perTierDeep: number,
  tiers: number,
  total: number,
  usedRotation: boolean,
  reasons: string[],
): string {
  const rotationNote = usedRotation ? "（収納を90度回転）" : "";
  if (status === "safe_fit") {
    return `安全余白あり: 横${perTierAcross}個 x 奥${perTierDeep}個 x ${tiers}段 = ${total}個${rotationNote}`;
  }
  if (status === "tight_fit") {
    return `余白少なめ: 横${perTierAcross}個 x 奥${perTierDeep}個 x ${tiers}段 = ${total}個${rotationNote}`;
  }
  if (status === "near_miss") {
    return `あと少しで入る: ${reasons.join("、")}${rotationNote}`;
  }
  return `${reasons.join("、") || "サイズが合いません"}${rotationNote}`;
}

function buildSpaceFitDetail(
  status: FitStatus,
  clearanceWidth: number,
  clearanceDepth: number,
  clearanceHeight: number,
  reasons: string[],
): string {
  if (status === "safe_fit") {
    return `安全余白あり: 幅${clearanceWidth}mm / 奥行${clearanceDepth}mm / 高さ${clearanceHeight}mm`;
  }
  if (status === "tight_fit") {
    return `入るが余白少なめ: 幅${clearanceWidth}mm / 奥行${clearanceDepth}mm / 高さ${clearanceHeight}mm`;
  }
  if (status === "near_miss") {
    return `あと少しで入る: ${reasons.join("、")}`;
  }
  return reasons.join("、") || "サイズが合いません";
}

export function classifySpaceFit(
  space: { width_mm: number; depth_mm: number; height_mm: number },
  item: { width_mm: number; depth_mm: number; height_mm: number },
  context?: FitContext,
): SpaceFitResult {
  const policy = getFitMarginPolicy(context);

  if (
    space.width_mm <= 0 ||
    space.depth_mm <= 0 ||
    space.height_mm <= 0 ||
    item.width_mm <= 0 ||
    item.depth_mm <= 0 ||
    item.height_mm <= 0
  ) {
    return {
      fits: false,
      status: "miss",
      clearance_width_mm: 0,
      clearance_depth_mm: 0,
      clearance_height_mm: 0,
      failed_axes: [],
      fit_detail: "スペースまたは製品サイズ情報が不明です",
      safety_margin_mm: {
        width_mm: policy.hard_width_mm,
        depth_mm: policy.hard_depth_mm,
        height_mm: policy.hard_height_mm,
        policy: policy.label,
      },
    };
  }

  const clearanceWidth = space.width_mm - item.width_mm;
  const clearanceDepth = space.depth_mm - item.depth_mm;
  const clearanceHeight = space.height_mm - item.height_mm;
  const failedAxes: Array<"width" | "depth" | "height"> = [];

  if (clearanceWidth < 0) failedAxes.push("width");
  if (clearanceDepth < 0) failedAxes.push("depth");
  if (clearanceHeight < 0) failedAxes.push("height");

  let status: FitStatus;
  if (
    clearanceWidth >= policy.hard_width_mm &&
    clearanceDepth >= policy.hard_depth_mm &&
    clearanceHeight >= policy.hard_height_mm
  ) {
    status = "safe_fit";
  } else if (clearanceWidth >= 0 && clearanceDepth >= 0 && clearanceHeight >= 0) {
    status = "tight_fit";
  } else if (
    clearanceWidth >= -policy.near_miss_width_mm &&
    clearanceDepth >= -policy.near_miss_depth_mm &&
    clearanceHeight >= -policy.near_miss_height_mm
  ) {
    status = "near_miss";
  } else {
    status = "miss";
  }

  const reasons = buildFailReasons(
    failedAxes,
    item.width_mm - space.width_mm,
    item.depth_mm - space.depth_mm,
    item.height_mm - space.height_mm,
  );

  return {
    fits: status === "safe_fit" || status === "tight_fit",
    status,
    clearance_width_mm: clearanceWidth,
    clearance_depth_mm: clearanceDepth,
    clearance_height_mm: clearanceHeight,
    failed_axes: failedAxes,
    fit_detail: buildSpaceFitDetail(status, clearanceWidth, clearanceDepth, clearanceHeight, reasons),
    safety_margin_mm: {
      width_mm: policy.hard_width_mm,
      depth_mm: policy.hard_depth_mm,
      height_mm: policy.hard_height_mm,
      policy: policy.label,
    },
  };
}

// -----------------------------------------------------------------------
// 個数計算
// -----------------------------------------------------------------------

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
  context?: FitContext,
): FitResult {
  const policy = getFitMarginPolicy(context);

  if (storageWidth <= 0 || storageHeight <= 0 || storageDepth <= 0) {
    return {
      fits: false,
      status: "miss",
      per_tier_across: 0,
      per_tier_deep: 0,
      per_tier: 0,
      total: 0,
      overflow_width_mm: 0,
      overflow_depth_mm: 0,
      overflow_height_mm: 0,
      fit_detail: "収納ボックスのサイズ情報が不明です",
      used_rotation: false,
      failed_axes: [],
      safety_margin_mm: {
        width_mm: policy.hard_width_mm,
        depth_mm: policy.hard_depth_mm,
        height_mm: policy.hard_height_mm,
        policy: policy.label,
      },
    };
  }

  const evaluateOrientation = (itemWidth: number, itemDepth: number, usedRotation: boolean): FitResult => {
    const across = Math.floor(shelfInner.width_mm / itemWidth);
    const deep = Math.floor(shelfInner.depth_mm / itemDepth);
    const clearanceWidth = shelfInner.width_mm - itemWidth;
    const clearanceDepth = shelfInner.depth_mm - itemDepth;
    const clearanceHeight = shelfInner.height_per_tier_mm - storageHeight;
    const overflowWidth = itemWidth - shelfInner.width_mm;
    const overflowDepth = itemDepth - shelfInner.depth_mm;
    const overflowHeight = storageHeight - shelfInner.height_per_tier_mm;
    const failedAxes: Array<"width" | "depth" | "height"> = [];

    if (clearanceWidth < 0) failedAxes.push("width");
    if (clearanceDepth < 0) failedAxes.push("depth");
    if (clearanceHeight < 0) failedAxes.push("height");

    let status: FitStatus;
    if (
      clearanceWidth >= policy.hard_width_mm &&
      clearanceDepth >= policy.hard_depth_mm &&
      clearanceHeight >= policy.hard_height_mm
    ) {
      status = "safe_fit";
    } else if (clearanceWidth >= 0 && clearanceDepth >= 0 && clearanceHeight >= 0) {
      status = "tight_fit";
    } else if (
      clearanceWidth >= -policy.near_miss_width_mm &&
      clearanceDepth >= -policy.near_miss_depth_mm &&
      clearanceHeight >= -policy.near_miss_height_mm
    ) {
      status = "near_miss";
    } else {
      status = "miss";
    }

    const perTier = status === "safe_fit" || status === "tight_fit"
      ? across * deep
      : 0;
    const total = perTier * shelfInner.tiers;
    const reasons = buildFailReasons(
      failedAxes,
      overflowWidth,
      overflowDepth,
      overflowHeight,
      shelfInner,
      storageHeight,
    );

    return {
      fits: status === "safe_fit" || status === "tight_fit",
      status,
      per_tier_across: across,
      per_tier_deep: deep,
      per_tier: perTier,
      total,
      overflow_width_mm: overflowWidth,
      overflow_depth_mm: overflowDepth,
      overflow_height_mm: overflowHeight,
      fit_detail: buildInnerFitDetail(status, across, deep, shelfInner.tiers, total, usedRotation, reasons),
      used_rotation: usedRotation,
      failed_axes: failedAxes,
      safety_margin_mm: {
        width_mm: policy.hard_width_mm,
        depth_mm: policy.hard_depth_mm,
        height_mm: policy.hard_height_mm,
        policy: policy.label,
      },
    };
  };

  const rank: Record<FitStatus, number> = {
    safe_fit: 3,
    tight_fit: 2,
    near_miss: 1,
    miss: 0,
  };

  const candidates = [evaluateOrientation(storageWidth, storageDepth, false)];
  if (storageWidth !== storageDepth) {
    candidates.push(evaluateOrientation(storageDepth, storageWidth, true));
  }

  candidates.sort((a, b) => {
    if (rank[b.status] !== rank[a.status]) return rank[b.status] - rank[a.status];
    if (b.per_tier !== a.per_tier) return b.per_tier - a.per_tier;
    if (b.total !== a.total) return b.total - a.total;
    return a.failed_axes.length - b.failed_axes.length;
  });

  return candidates[0]!;
}
