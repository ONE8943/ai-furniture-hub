/**
 * 内寸解決レイヤー
 *
 * 内寸データは data/dimensions/inner_dimensions_db.ts に分離されており、
 * npm publish の対象外。このモジュールは実行時に内寸DBを読み込み、
 * なければ inner_size_estimator で推定するフォールバックを提供する。
 */

import { estimateInnerSize, EstimatedInner } from "../../utils/inner_size_estimator";
import type { KnownProduct } from "./types";

interface InnerDimensions {
  inner_width_mm: number;
  inner_height_per_tier_mm: number;
  inner_depth_mm: number;
}

let innerDB: Record<string, InnerDimensions> | null = null;
let loadAttempted = false;

function loadInnerDB(): Record<string, InnerDimensions> | null {
  if (loadAttempted) return innerDB;
  loadAttempted = true;
  try {
    // Dynamic import is not available synchronously; use require for conditional loading.
    // This file may not exist in npm-distributed packages.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require("../../data/dimensions/inner_dimensions_db");
    innerDB = mod.INNER_DIMENSIONS_DB ?? null;
  } catch {
    innerDB = null;
  }
  return innerDB;
}

export interface ResolvedInnerDimensions {
  inner_width_mm: number;
  inner_height_per_tier_mm: number;
  inner_depth_mm: number;
  source: "curated" | "estimated";
}

/**
 * 製品IDから内寸を解決する。
 *
 * 優先順位:
 *  1. 内寸DB（キュレーション済み精密値） → source: "curated"
 *  2. inner_size_estimator（外寸＋板厚ルールから推定） → source: "estimated"
 */
export function resolveInnerDimensions(
  product: KnownProduct,
): ResolvedInnerDimensions | null {
  const db = loadInnerDB();

  if (db && db[product.id]) {
    const entry = db[product.id]!;
    return {
      inner_width_mm: entry.inner_width_mm,
      inner_height_per_tier_mm: entry.inner_height_per_tier_mm,
      inner_depth_mm: entry.inner_depth_mm,
      source: "curated",
    };
  }

  if (product.outer_width_mm > 0 && product.outer_height_mm > 0 && product.outer_depth_mm > 0) {
    const productText = `${product.brand} ${product.name} ${product.series} ${product.category ?? ""}`;
    const est: EstimatedInner = estimateInnerSize(
      product.outer_width_mm,
      product.outer_height_mm,
      product.outer_depth_mm,
      productText,
    );
    return {
      inner_width_mm: est.width_mm,
      inner_height_per_tier_mm: est.height_per_tier_mm,
      inner_depth_mm: est.depth_mm,
      source: "estimated",
    };
  }

  return null;
}

/**
 * 複数製品の内寸を一括解決する。
 */
export function resolveInnerDimensionsBatch(
  products: KnownProduct[],
): Map<string, ResolvedInnerDimensions> {
  const results = new Map<string, ResolvedInnerDimensions>();
  for (const p of products) {
    const resolved = resolveInnerDimensions(p);
    if (resolved) results.set(p.id, resolved);
  }
  return results;
}
