/**
 * 寸法互換スコア計算
 *
 * 2つの製品の外寸差分から 0-100 のスコアを計算する。
 * 100 = 完全一致、0 = 全く互換性なし
 */

import type { KnownProduct } from "../../shared/catalog/types";
import type { DimensionMatchLevel } from "./types";

export interface FitScoreResult {
  fit_score: number;
  dimension_match: DimensionMatchLevel;
  dimension_diff_mm: {
    width: number;
    height: number;
    depth: number;
  };
}

const MAX_DIFF_MM = 100;

export function calculateFitScore(
  source: KnownProduct,
  candidate: KnownProduct,
): FitScoreResult {
  const dw = candidate.outer_width_mm - source.outer_width_mm;
  const dh = candidate.outer_height_mm - source.outer_height_mm;
  const dd = candidate.outer_depth_mm - source.outer_depth_mm;

  const absDiffs = [Math.abs(dw), Math.abs(dh), Math.abs(dd)];
  const maxDiff = Math.max(...absDiffs);
  const avgDiff = absDiffs.reduce((a, b) => a + b, 0) / 3;

  let fit_score: number;
  let dimension_match: DimensionMatchLevel;

  if (maxDiff === 0) {
    fit_score = 100;
    dimension_match = "exact";
  } else if (maxDiff <= 10) {
    fit_score = 95 - avgDiff;
    dimension_match = "exact";
  } else if (maxDiff <= 30) {
    fit_score = 85 - avgDiff;
    dimension_match = "close";
  } else if (maxDiff <= MAX_DIFF_MM) {
    fit_score = Math.max(0, 70 - avgDiff * 0.7);
    dimension_match = "close";
  } else {
    fit_score = Math.max(0, 40 - avgDiff * 0.3);
    dimension_match = "similar_category";
  }

  fit_score = Math.round(Math.max(0, Math.min(100, fit_score)));

  return {
    fit_score,
    dimension_match,
    dimension_diff_mm: { width: dw, height: dh, depth: dd },
  };
}

/**
 * カタログ全体から寸法が近い製品を探す
 */
export function findDimensionCompatible(
  source: KnownProduct,
  candidates: KnownProduct[],
  minScore: number = 50,
  maxResults: number = 10,
): Array<{ product: KnownProduct } & FitScoreResult> {
  const results: Array<{ product: KnownProduct } & FitScoreResult> = [];

  for (const candidate of candidates) {
    if (candidate.id === source.id) continue;
    if (candidate.discontinued) continue;

    const score = calculateFitScore(source, candidate);
    if (score.fit_score >= minScore) {
      results.push({ product: candidate, ...score });
    }
  }

  results.sort((a, b) => b.fit_score - a.fit_score);
  return results.slice(0, maxResults);
}
