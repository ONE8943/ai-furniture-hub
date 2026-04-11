/**
 * 寸法互換マッピングの型定義
 *
 * 廃番/旧型製品に対して、寸法的に互換がある現行製品を管理する。
 * メーカー公式のsuccessorsとは異なり、他社製品や非公式代替も含む。
 */

export type DimensionMatchLevel = "exact" | "close" | "similar_category";

export interface CompatibilityEntry {
  discontinued_id: string;
  replacement_id: string;
  dimension_match: DimensionMatchLevel;
  dimension_diff_mm?: {
    width: number;
    height: number;
    depth: number;
  };
  fit_score: number;
  note: string;
  verified: boolean;
}
