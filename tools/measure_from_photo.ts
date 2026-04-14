/**
 * measure_from_photo MCP ツール
 *
 * 写真に参照物（名刺・ペットボトル等）と対象物が写っている状態で、
 * AIが読み取ったピクセル寸法から実寸を逆算し、
 * そのまま suggest_by_space / coordinate_storage に接続できる検索用寸法を返す。
 */

import { logAnalytics, buildHitLog } from "../utils/logger";
import { measureFromPhoto, PhotoMeasureInputSchema, type MeasuredDimensions } from "../utils/photo_measure";
import { listReferenceNames } from "../utils/reference_objects";
import { parseOrThrow } from "../utils/validation";

export interface MeasureFromPhotoResult {
  measured: MeasuredDimensions;
  next_steps: string[];
  miss: boolean;
}

export async function measureFromPhotoTool(rawInput: unknown): Promise<MeasureFromPhotoResult> {
  const params = parseOrThrow(PhotoMeasureInputSchema, rawInput);
  const measured = measureFromPhoto(params);

  const sd = measured.search_dimensions;
  const next_steps: string[] = [
    `推定寸法: ${measured.width_mm}×${measured.height_mm}×${measured.depth_mm}mm（信頼度: ${measured.confidence}）`,
    `検索用寸法（マージン±${measured.margin_applied_mm}mm込み）: 幅${sd.width_mm_min}-${sd.width_mm_max}mm / 高さ${sd.height_mm_min}-${sd.height_mm_max}mm / 奥行${sd.depth_mm_min}-${sd.depth_mm_max}mm`,
  ];

  if (measured.confidence === "low") {
    next_steps.push("⚠ 精度が低いです。可能であればメジャーで実測してください");
    next_steps.push(`対応参照物: ${listReferenceNames().join("、")}`);
  }

  next_steps.push(
    "→ suggest_by_space にこの寸法を渡すと、このスペースに入る商品を提案できます",
    "→ coordinate_storage に渡すと、棚+収納ボックスのコーディネートを提案できます",
    "→ identify_product に特徴テキストを渡すと、写真の製品を特定できます",
  );

  if (measured.confidence !== "high") {
    next_steps.push(
      "💡 精度を上げるには: ①定規を横に置いて撮影 ②参照物と対象物を同じ距離で撮影 ③正面から撮影",
    );
  }

  const hitLog = buildHitLog(
    "measure_from_photo",
    {
      reference: params.reference_object,
      target: params.target_description.slice(0, 50),
      confidence: measured.confidence,
    },
    params.intent,
    1,
  );
  logAnalytics(hitLog).catch(() => {});

  return {
    measured,
    next_steps,
    miss: false,
  };
}
