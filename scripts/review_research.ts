/**
 * 軽量AIが調査した製品データを検証・精査するスクリプト
 *
 * 使い方:
 *   1. 軽量AIが staging/research_*.jsonl に調査結果を書き込む
 *   2. Opus (このスクリプト) が内容を精査し、合格分を known_products 追加候補として出力
 *
 *   npx ts-node scripts/review_research.ts                # 全ファイルレビュー
 *   npx ts-node scripts/review_research.ts --approve      # 合格分を approved/ へ移動
 *   npx ts-node scripts/review_research.ts --stats        # ステータス集計
 */
import "dotenv/config";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync, renameSync } from "fs";
import { join } from "path";
import { z } from "zod";

const ROOT = join(__dirname, "..");
const STAGING_DIR = join(ROOT, "staging");
const APPROVED_DIR = join(ROOT, "staging", "approved");
const REJECTED_DIR = join(ROOT, "staging", "rejected");

for (const dir of [STAGING_DIR, APPROVED_DIR, REJECTED_DIR]) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

const ResearchEntrySchema = z.object({
  id: z.string().min(1),
  brand: z.string().min(1),
  series: z.string().min(1),
  model_number: z.string().min(1),
  name: z.string().min(1),
  outer_width_mm: z.number().positive(),
  outer_height_mm: z.number().positive(),
  outer_depth_mm: z.number().positive(),
  inner_width_mm: z.number().nonnegative(),
  inner_height_per_tier_mm: z.number().nonnegative(),
  inner_depth_mm: z.number().nonnegative(),
  tiers: z.number().int().positive(),
  price_range: z.object({ min: z.number().nonnegative(), max: z.number().nonnegative() }),
  colors: z.array(z.string()).min(1),
  material: z.string().min(1),
  weight_kg: z.number().nonnegative(),
  load_capacity_per_tier_kg: z.number().nonnegative(),
  visual_features: z.array(z.string()).min(1),
  category: z.string().optional(),
  source: z.string().optional(),
  source_url: z.string().url().optional(),
});

type ResearchEntry = z.infer<typeof ResearchEntrySchema>;

interface ReviewResult {
  entry: ResearchEntry;
  passed: boolean;
  issues: string[];
  warnings: string[];
}

function validate(raw: unknown): ReviewResult {
  const parseResult = ResearchEntrySchema.safeParse(raw);
  if (!parseResult.success) {
    return {
      entry: raw as ResearchEntry,
      passed: false,
      issues: (parseResult.error.issues ?? []).map((e) => `${String(e.path?.join?.(".") ?? "")}: ${e.message}`),
      warnings: [],
    };
  }
  const entry = parseResult.data;
  const issues: string[] = [];
  const warnings: string[] = [];

  if (entry.outer_width_mm < 50 || entry.outer_width_mm > 3000) {
    issues.push(`幅 ${entry.outer_width_mm}mm が異常値（50-3000mm 範囲外）`);
  }
  if (entry.outer_height_mm < 50 || entry.outer_height_mm > 3000) {
    issues.push(`高さ ${entry.outer_height_mm}mm が異常値`);
  }
  if (entry.outer_depth_mm < 50 || entry.outer_depth_mm > 1500) {
    issues.push(`奥行 ${entry.outer_depth_mm}mm が異常値`);
  }

  if (entry.inner_width_mm > 0 && entry.inner_width_mm >= entry.outer_width_mm) {
    issues.push(`内寸幅(${entry.inner_width_mm}) >= 外寸幅(${entry.outer_width_mm})`);
  }
  if (entry.inner_depth_mm > 0 && entry.inner_depth_mm >= entry.outer_depth_mm) {
    issues.push(`内寸奥行(${entry.inner_depth_mm}) >= 外寸奥行(${entry.outer_depth_mm})`);
  }

  if (entry.price_range.min > 0 && entry.price_range.max > 0) {
    if (entry.price_range.min > entry.price_range.max) {
      issues.push(`価格帯が逆転: min(${entry.price_range.min}) > max(${entry.price_range.max})`);
    }
    if (entry.price_range.max > 500000) {
      warnings.push(`価格が50万円超（${entry.price_range.max}円）— 高額製品の可能性あり、要確認`);
    }
  }

  if (entry.weight_kg > 100) {
    warnings.push(`重量 ${entry.weight_kg}kg — 家具としては重い、要確認`);
  }

  if (entry.inner_width_mm === 0 && entry.inner_depth_mm === 0) {
    warnings.push("内寸が未入力 — coordinate_storage ツールで活用不可");
  }

  if (entry.visual_features.length < 2) {
    warnings.push("visual_features が少ない — identify_product の精度に影響");
  }

  return {
    entry,
    passed: issues.length === 0,
    issues,
    warnings,
  };
}

function reviewFiles(): ReviewResult[] {
  const files = readdirSync(STAGING_DIR).filter(
    (f) => f.startsWith("research_") && f.endsWith(".jsonl")
  );

  if (files.length === 0) {
    console.log("staging/ にレビュー対象のファイルがありません。");
    console.log("");
    console.log("軽量AIが以下のフォーマットで staging/research_[テーマ].jsonl に書き込みます：");
    console.log(JSON.stringify({
      id: "brand-series-variant",
      brand: "ブランド名",
      series: "シリーズ名",
      model_number: "型番",
      name: "製品名",
      outer_width_mm: 0,
      outer_height_mm: 0,
      outer_depth_mm: 0,
      inner_width_mm: 0,
      inner_height_per_tier_mm: 0,
      inner_depth_mm: 0,
      tiers: 1,
      price_range: { min: 0, max: 0 },
      colors: ["色"],
      material: "素材",
      weight_kg: 0,
      load_capacity_per_tier_kg: 0,
      visual_features: ["特徴1", "特徴2"],
      category: "カテゴリ",
      source: "調査元",
      source_url: "https://...",
    }, null, 2));
    return [];
  }

  const allResults: ReviewResult[] = [];

  for (const file of files) {
    console.log(`\n=== Reviewing: ${file} ===\n`);
    const content = readFileSync(join(STAGING_DIR, file), "utf-8");
    const lines = content.split("\n").filter((l) => l.trim());

    let passed = 0;
    let failed = 0;

    for (const line of lines) {
      let parsed: unknown;
      try {
        parsed = JSON.parse(line);
      } catch {
        console.log(`  SKIP: JSON parse error`);
        failed++;
        continue;
      }

      const result = validate(parsed);
      allResults.push(result);

      if (result.passed) {
        passed++;
        if (result.warnings.length > 0) {
          console.log(`  PASS (warnings): ${result.entry.id}`);
          for (const w of result.warnings) console.log(`    ⚠ ${w}`);
        } else {
          console.log(`  PASS: ${result.entry.id}`);
        }
      } else {
        failed++;
        console.log(`  FAIL: ${(result.entry as any)?.id ?? "unknown"}`);
        for (const i of result.issues) console.log(`    ✗ ${i}`);
      }
    }

    console.log(`\n  Result: ${passed} passed, ${failed} failed (total ${lines.length})`);
  }

  return allResults;
}

function approveResults(results: ReviewResult[]): void {
  const approved = results.filter((r) => r.passed);
  const rejected = results.filter((r) => !r.passed);

  if (approved.length > 0) {
    const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const approvedPath = join(APPROVED_DIR, `approved_${ts}.jsonl`);
    const lines = approved.map((r) => JSON.stringify(r.entry));
    writeFileSync(approvedPath, lines.join("\n") + "\n", "utf-8");
    console.log(`\n${approved.length} entries approved → ${approvedPath}`);
  }

  if (rejected.length > 0) {
    const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const rejectedPath = join(REJECTED_DIR, `rejected_${ts}.jsonl`);
    const lines = rejected.map((r) =>
      JSON.stringify({ ...r.entry, _review_issues: r.issues })
    );
    writeFileSync(rejectedPath, lines.join("\n") + "\n", "utf-8");
    console.log(`${rejected.length} entries rejected → ${rejectedPath}`);
  }

  const files = readdirSync(STAGING_DIR).filter(
    (f) => f.startsWith("research_") && f.endsWith(".jsonl")
  );
  for (const file of files) {
    const src = join(STAGING_DIR, file);
    const dst = join(STAGING_DIR, `reviewed_${file}`);
    renameSync(src, dst);
  }
  console.log("Staging files renamed (reviewed_ prefix added).");
}

function printStats(): void {
  console.log("## Review Pipeline Stats\n");
  const approvedFiles = existsSync(APPROVED_DIR) ? readdirSync(APPROVED_DIR) : [];
  const rejectedFiles = existsSync(REJECTED_DIR) ? readdirSync(REJECTED_DIR) : [];
  const pendingFiles = readdirSync(STAGING_DIR).filter(
    (f) => f.startsWith("research_") && f.endsWith(".jsonl")
  );

  let approvedCount = 0;
  for (const f of approvedFiles) {
    approvedCount += readFileSync(join(APPROVED_DIR, f), "utf-8").split("\n").filter((l) => l.trim()).length;
  }
  let rejectedCount = 0;
  for (const f of rejectedFiles) {
    rejectedCount += readFileSync(join(REJECTED_DIR, f), "utf-8").split("\n").filter((l) => l.trim()).length;
  }

  console.log(`- Pending files: ${pendingFiles.length}`);
  console.log(`- Approved entries: ${approvedCount}`);
  console.log(`- Rejected entries: ${rejectedCount}`);
  console.log(`- Approved batches: ${approvedFiles.length}`);
}

// --- Main ---
const args = process.argv.slice(2);

if (args.includes("--stats")) {
  printStats();
} else if (args.includes("--approve")) {
  const results = reviewFiles();
  if (results.length > 0) approveResults(results);
} else {
  reviewFiles();
}
