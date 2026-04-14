/**
 * 写真寸法推定エンジン
 *
 * AIのVision解析結果（テキスト）+ 参照物のピクセル情報から
 * 対象物の実寸をスケーリング逆算する。
 *
 * フロー:
 *   1. AI が写真を見て参照物と対象物のピクセル寸法を報告
 *   2. 参照物の既知実寸からスケール(mm/px)を算出
 *   3. 対象物のピクセル寸法にスケールを掛けて実寸推定
 *   4. 信頼度と安全マージンを付与
 */

import { z } from "zod";
import { findReferenceObject, REFERENCE_OBJECTS, type ReferenceObject } from "./reference_objects";

// -----------------------------------------------------------------------
// スキーマ
// -----------------------------------------------------------------------

export const PhotoMeasureInputSchema = z.object({
  intent: z.string().min(1).describe("【必須】写真から何を測りたいか"),

  reference_object: z.string().min(1).describe(
    "写真に写っている参照物の名前（例: '名刺', 'ペットボトル', 'A4用紙', 'クレジットカード'）",
  ),
  reference_px: z.object({
    width_px: z.number().positive().describe("参照物の画像上の幅（ピクセル）"),
    height_px: z.number().positive().describe("参照物の画像上の高さ（ピクセル）"),
  }).describe("参照物のピクセル寸法（AIが画像から読み取る）"),

  target_description: z.string().min(1).describe("測定対象の説明（例: '白い3段カラーボックス'）"),
  target_px: z.object({
    width_px: z.number().positive().describe("対象物の画像上の幅（ピクセル）"),
    height_px: z.number().positive().describe("対象物の画像上の高さ（ピクセル）"),
    depth_px: z.number().positive().optional().describe("対象物の画像上の奥行き（ピクセル、斜め視点で見える場合）"),
  }).describe("対象物のピクセル寸法（AIが画像から読み取る）"),

  estimated_depth_mm: z.number().positive().optional().describe(
    "AIが推定した奥行き（mm）。写真から奥行きが読めない場合にVision LLMの推定値を入れる",
  ),
  manual_dimensions_mm: z.object({
    width_mm: z.number().positive().optional(),
    height_mm: z.number().positive().optional(),
    depth_mm: z.number().positive().optional(),
  }).optional().describe("ユーザーがメジャー/AR等で実測した値があれば上書き（最高精度）"),
});

export type PhotoMeasureInput = z.infer<typeof PhotoMeasureInputSchema>;

// -----------------------------------------------------------------------
// 出力型
// -----------------------------------------------------------------------

export type MeasureConfidence = "high" | "medium" | "low";

export interface MeasuredDimensions {
  width_mm: number;
  height_mm: number;
  depth_mm: number;
  confidence: MeasureConfidence;
  method: "reference_scaling" | "manual_override" | "hybrid";
  scale_mm_per_px: number | null;
  reference_used: {
    name: string;
    known_width_mm: number;
    known_height_mm: number;
  } | null;
  margin_applied_mm: number;
  notes: string[];
  search_dimensions: {
    width_mm_max: number;
    height_mm_max: number;
    depth_mm_max: number;
    width_mm_min: number;
    height_mm_min: number;
    depth_mm_min: number;
  };
}

// -----------------------------------------------------------------------
// 信頼度とマージンの決定
// -----------------------------------------------------------------------

interface ConfidenceFactors {
  hasReference: boolean;
  hasManualOverride: boolean;
  hasDepthPx: boolean;
  referenceQuality: "exact" | "approximate";
  scaleConsistency: number;
}

function determineConfidence(factors: ConfidenceFactors): MeasureConfidence {
  if (factors.hasManualOverride) return "high";
  if (factors.hasReference && factors.scaleConsistency > 0.85) return "medium";
  return "low";
}

function marginForConfidence(confidence: MeasureConfidence): number {
  switch (confidence) {
    case "high": return 10;
    case "medium": return 30;
    case "low": return 50;
  }
}

// -----------------------------------------------------------------------
// スケール計算
// -----------------------------------------------------------------------

interface ScaleResult {
  scale_w: number;
  scale_h: number;
  avg_scale: number;
  consistency: number;
}

function calcScale(
  ref: ReferenceObject,
  refPx: { width_px: number; height_px: number },
): ScaleResult {
  const scale_w = ref.width_mm / refPx.width_px;
  const scale_h = ref.height_mm / refPx.height_px;
  const avg_scale = (scale_w + scale_h) / 2;
  const consistency = 1 - Math.abs(scale_w - scale_h) / Math.max(scale_w, scale_h);
  return { scale_w, scale_h, avg_scale, consistency };
}

// -----------------------------------------------------------------------
// メイン処理
// -----------------------------------------------------------------------

export function measureFromPhoto(input: PhotoMeasureInput): MeasuredDimensions {
  const notes: string[] = [];

  const ref = findReferenceObject(input.reference_object);
  if (!ref) {
    const available = REFERENCE_OBJECTS.map((r) => r.names[0]).join("、");
    throw new Error(
      `参照物「${input.reference_object}」が見つかりません。対応する参照物: ${available}`,
    );
  }

  notes.push(`参照物: ${ref.names[0]}（${ref.width_mm}×${ref.height_mm}mm / ${ref.note}）`);

  const scale = calcScale(ref, input.reference_px);
  notes.push(
    `スケール: ${scale.avg_scale.toFixed(3)} mm/px（整合性: ${(scale.consistency * 100).toFixed(1)}%）`,
  );

  if (scale.consistency < 0.7) {
    notes.push(
      "⚠ 参照物のアスペクト比がピクセル比率と大きくずれています。" +
      "参照物が斜めに写っている、または誤検出の可能性があります",
    );
  }

  let width_mm = Math.round(input.target_px.width_px * scale.avg_scale);
  let height_mm = Math.round(input.target_px.height_px * scale.avg_scale);
  let depth_mm: number;
  let method: MeasuredDimensions["method"] = "reference_scaling";

  if (input.target_px.depth_px) {
    depth_mm = Math.round(input.target_px.depth_px * scale.avg_scale);
    notes.push("奥行き: 写真のピクセル比率から算出");
  } else if (input.estimated_depth_mm) {
    depth_mm = Math.round(input.estimated_depth_mm);
    notes.push("奥行き: AIのVision推定値を使用（精度は低め）");
  } else {
    depth_mm = Math.round(Math.min(width_mm, height_mm) * 0.5);
    notes.push("奥行き: 幅/高さの短い方×50%で仮推定（実測を推奨）");
  }

  if (input.manual_dimensions_mm) {
    const m = input.manual_dimensions_mm;
    if (m.width_mm) { width_mm = Math.round(m.width_mm); notes.push(`幅: ユーザー実測値 ${m.width_mm}mm で上書き`); }
    if (m.height_mm) { height_mm = Math.round(m.height_mm); notes.push(`高さ: ユーザー実測値 ${m.height_mm}mm で上書き`); }
    if (m.depth_mm) { depth_mm = Math.round(m.depth_mm); notes.push(`奥行き: ユーザー実測値 ${m.depth_mm}mm で上書き`); }
    method = m.width_mm && m.height_mm && m.depth_mm ? "manual_override" : "hybrid";
  }

  const factors: ConfidenceFactors = {
    hasReference: true,
    hasManualOverride: method === "manual_override",
    hasDepthPx: !!input.target_px.depth_px,
    referenceQuality: scale.consistency > 0.85 ? "exact" : "approximate",
    scaleConsistency: scale.consistency,
  };

  const confidence = determineConfidence(factors);
  const margin = marginForConfidence(confidence);

  notes.push(`信頼度: ${confidence}（安全マージン: ±${margin}mm）`);

  return {
    width_mm,
    height_mm,
    depth_mm,
    confidence,
    method,
    scale_mm_per_px: Math.round(scale.avg_scale * 1000) / 1000,
    reference_used: {
      name: ref.names[0]!,
      known_width_mm: ref.width_mm,
      known_height_mm: ref.height_mm,
    },
    margin_applied_mm: margin,
    notes,
    search_dimensions: {
      width_mm_max: width_mm + margin,
      height_mm_max: height_mm + margin,
      depth_mm_max: depth_mm + margin,
      width_mm_min: Math.max(0, width_mm - margin),
      height_mm_min: Math.max(0, height_mm - margin),
      depth_mm_min: Math.max(0, depth_mm - margin),
    },
  };
}
