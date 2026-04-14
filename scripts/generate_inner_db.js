#!/usr/bin/env node
/**
 * ビルド前処理: 環境変数 INNER_DIMENSIONS_DATA から内寸DBファイルを生成する。
 *
 * Render等のCI環境で使用。ローカル開発時はファイルが既にあればスキップ。
 *
 * JSON形式: { "product-id": [width, height_per_tier, depth], ... }
 */
const fs = require("fs");
const path = require("path");

const OUTPUT_DIR = path.join(__dirname, "..", "data", "dimensions");
const OUTPUT_FILE = path.join(OUTPUT_DIR, "inner_dimensions_db.ts");

if (fs.existsSync(OUTPUT_FILE)) {
  console.log("[generate_inner_db] File already exists, skipping generation.");
  process.exit(0);
}

const raw = process.env.INNER_DIMENSIONS_DATA;
if (!raw) {
  console.warn("[generate_inner_db] INNER_DIMENSIONS_DATA not set. Inner dimensions will use estimation only.");
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(OUTPUT_FILE, `export interface InnerDimensions {
  inner_width_mm: number;
  inner_height_per_tier_mm: number;
  inner_depth_mm: number;
}
export const INNER_DIMENSIONS_DB: Record<string, InnerDimensions> = {};
`, "utf-8");
  process.exit(0);
}

let data;
try {
  data = JSON.parse(raw);
} catch (e) {
  console.error("[generate_inner_db] Failed to parse INNER_DIMENSIONS_DATA:", e.message);
  process.exit(1);
}

const entries = [];
for (const [id, dims] of Object.entries(data)) {
  if (!Array.isArray(dims) || dims.length !== 3) continue;
  entries.push(`  "${id}": { inner_width_mm: ${dims[0]}, inner_height_per_tier_mm: ${dims[1]}, inner_depth_mm: ${dims[2]} }`);
}

const output = `/**
 * Auto-generated from INNER_DIMENSIONS_DATA environment variable.
 * Do NOT edit manually. Do NOT commit to Git.
 */
export interface InnerDimensions {
  inner_width_mm: number;
  inner_height_per_tier_mm: number;
  inner_depth_mm: number;
}

export const INNER_DIMENSIONS_DB: Record<string, InnerDimensions> = {
${entries.join(",\n")},
};
`;

fs.mkdirSync(OUTPUT_DIR, { recursive: true });
fs.writeFileSync(OUTPUT_FILE, output, "utf-8");
console.log(`[generate_inner_db] Generated ${entries.length} entries -> ${OUTPUT_FILE}`);
