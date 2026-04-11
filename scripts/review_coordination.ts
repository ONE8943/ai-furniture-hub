/**
 * Gemini Flash が調査したコーディネート・組み合わせデータを検証するスクリプト
 *
 * 対象ファイル: staging/coord_*.jsonl
 *
 *   npx ts-node scripts/review_coordination.ts                # レビュー
 *   npx ts-node scripts/review_coordination.ts --approve      # 合格分を approved/ へ
 *   npx ts-node scripts/review_coordination.ts --stats        # 統計
 *   npx ts-node scripts/review_coordination.ts --sample       # サンプルJSONL出力
 */
import "dotenv/config";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
  renameSync,
} from "fs";
import { join } from "path";
import { z } from "zod";

const ROOT = join(__dirname, "..");
const STAGING_DIR = join(ROOT, "staging");
const APPROVED_DIR = join(ROOT, "staging", "approved");
const REJECTED_DIR = join(ROOT, "staging", "rejected");

for (const dir of [STAGING_DIR, APPROVED_DIR, REJECTED_DIR]) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

// ------------------------------------------------------------------
// スキーマ: コーディネート / 組み合わせ 1件
// ------------------------------------------------------------------
const RelationTypeEnum = z.enum([
  "requires",
  "protects_with",
  "fits_inside",
  "coordinates_with",
  "enhances_with",
  "alternative",
]);

const CoordinationEntrySchema = z.object({
  source_product: z.string().min(1),
  source_brand: z.string().min(1),
  source_product_id: z.string().optional(),

  related_name: z.string().min(1),
  related_brand: z.string().optional(),
  related_product_id: z.string().optional(),

  relation: RelationTypeEnum,
  why: z.string().min(5),
  search_keywords: z.array(z.string().min(1)).min(1),
  price_range_yen: z
    .object({ min: z.number().nonnegative(), max: z.number().nonnegative() })
    .optional(),
  required: z.boolean(),

  source_url: z.string().url().optional(),
  source_type: z.enum(["blog", "sns", "ec", "maker", "review", "other"]),

  scene: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

type CoordinationEntry = z.infer<typeof CoordinationEntrySchema>;

interface ReviewResult {
  entry: CoordinationEntry;
  passed: boolean;
  issues: string[];
  warnings: string[];
}

// ------------------------------------------------------------------
// バリデーション
// ------------------------------------------------------------------
function validate(raw: unknown): ReviewResult {
  const parseResult = CoordinationEntrySchema.safeParse(raw);
  if (!parseResult.success) {
    return {
      entry: raw as CoordinationEntry,
      passed: false,
      issues: (parseResult.error.issues ?? []).map(
        (e) => `${String(e.path?.join?.(".") ?? "")}: ${e.message}`
      ),
      warnings: [],
    };
  }

  const entry = parseResult.data;
  const issues: string[] = [];
  const warnings: string[] = [];

  if (entry.source_product === entry.related_name) {
    issues.push("source_product と related_name が同一");
  }

  if (entry.why.length < 10) {
    warnings.push(`why が短い（${entry.why.length}文字）— AI参照時の情報量不足`);
  }

  if (entry.search_keywords.length < 2) {
    warnings.push("search_keywords が1つ — 楽天検索でヒットしない可能性");
  }

  if (entry.price_range_yen) {
    if (
      entry.price_range_yen.min > 0 &&
      entry.price_range_yen.max > 0 &&
      entry.price_range_yen.min > entry.price_range_yen.max
    ) {
      issues.push(
        `価格帯逆転: min(${entry.price_range_yen.min}) > max(${entry.price_range_yen.max})`
      );
    }
    if (entry.price_range_yen.max > 300000) {
      warnings.push(
        `高額: ${entry.price_range_yen.max}円 — 組み合わせアイテムとしては高い`
      );
    }
  }

  if (entry.relation === "requires" && !entry.required) {
    warnings.push('relation="requires" なのに required=false — 確認推奨');
  }

  const known = [
    "blog",
    "sns",
    "ec",
    "maker",
    "review",
    "other",
  ];
  if (!known.includes(entry.source_type)) {
    issues.push(`不明な source_type: ${entry.source_type}`);
  }

  return { entry, passed: issues.length === 0, issues, warnings };
}

// ------------------------------------------------------------------
// ファイルレビュー
// ------------------------------------------------------------------
function reviewFiles(): ReviewResult[] {
  const files = readdirSync(STAGING_DIR).filter(
    (f) => f.startsWith("coord_") && f.endsWith(".jsonl")
  );

  if (files.length === 0) {
    console.log("staging/ にコーディネート調査ファイル (coord_*.jsonl) がありません。\n");
    console.log("Gemini Flash に以下の形式で書き出させてください：\n");
    printSample();
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
        console.log("  SKIP: JSON parse error");
        failed++;
        continue;
      }

      const result = validate(parsed);
      allResults.push(result);

      if (result.passed) {
        passed++;
        const warn =
          result.warnings.length > 0 ? ` (${result.warnings.length} warnings)` : "";
        console.log(
          `  PASS${warn}: ${result.entry.source_product} → ${result.entry.related_name} [${result.entry.relation}]`
        );
        for (const w of result.warnings) console.log(`    ⚠ ${w}`);
      } else {
        failed++;
        console.log(
          `  FAIL: ${(result.entry as any)?.source_product ?? "?"} → ${(result.entry as any)?.related_name ?? "?"}`
        );
        for (const i of result.issues) console.log(`    ✗ ${i}`);
      }
    }

    console.log(
      `\n  Result: ${passed} passed, ${failed} failed (total ${lines.length})`
    );
  }

  return allResults;
}

// ------------------------------------------------------------------
// 承認処理
// ------------------------------------------------------------------
function approveResults(results: ReviewResult[]): void {
  const approved = results.filter((r) => r.passed);
  const rejected = results.filter((r) => !r.passed);

  if (approved.length > 0) {
    const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const path = join(APPROVED_DIR, `coord_approved_${ts}.jsonl`);
    const lines = approved.map((r) => JSON.stringify(r.entry));
    writeFileSync(path, lines.join("\n") + "\n", "utf-8");
    console.log(`\n${approved.length} entries approved → ${path}`);
  }

  if (rejected.length > 0) {
    const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const path = join(REJECTED_DIR, `coord_rejected_${ts}.jsonl`);
    const lines = rejected.map((r) =>
      JSON.stringify({ ...r.entry, _review_issues: r.issues })
    );
    writeFileSync(path, lines.join("\n") + "\n", "utf-8");
    console.log(`${rejected.length} entries rejected → ${path}`);
  }

  const files = readdirSync(STAGING_DIR).filter(
    (f) => f.startsWith("coord_") && f.endsWith(".jsonl")
  );
  for (const file of files) {
    renameSync(
      join(STAGING_DIR, file),
      join(STAGING_DIR, `reviewed_${file}`)
    );
  }
  console.log("Staging files renamed (reviewed_ prefix added).\n");
}

// ------------------------------------------------------------------
// 統計
// ------------------------------------------------------------------
function printStats(): void {
  console.log("## Coordination Review Pipeline Stats\n");
  const approvedFiles = existsSync(APPROVED_DIR)
    ? readdirSync(APPROVED_DIR).filter((f) => f.startsWith("coord_"))
    : [];
  const rejectedFiles = existsSync(REJECTED_DIR)
    ? readdirSync(REJECTED_DIR).filter((f) => f.startsWith("coord_"))
    : [];
  const pending = readdirSync(STAGING_DIR).filter(
    (f) => f.startsWith("coord_") && f.endsWith(".jsonl")
  );

  let approvedCount = 0;
  for (const f of approvedFiles) {
    approvedCount += readFileSync(join(APPROVED_DIR, f), "utf-8")
      .split("\n")
      .filter((l) => l.trim()).length;
  }
  let rejectedCount = 0;
  for (const f of rejectedFiles) {
    rejectedCount += readFileSync(join(REJECTED_DIR, f), "utf-8")
      .split("\n")
      .filter((l) => l.trim()).length;
  }

  console.log(`- Pending coord files : ${pending.length}`);
  console.log(`- Approved entries    : ${approvedCount}`);
  console.log(`- Rejected entries    : ${rejectedCount}`);
  console.log(`- Approved batches    : ${approvedFiles.length}`);

  if (approvedCount > 0) {
    const relations: Record<string, number> = {};
    for (const f of approvedFiles) {
      const lines = readFileSync(join(APPROVED_DIR, f), "utf-8")
        .split("\n")
        .filter((l) => l.trim());
      for (const line of lines) {
        try {
          const e = JSON.parse(line) as CoordinationEntry;
          relations[e.relation] = (relations[e.relation] ?? 0) + 1;
        } catch { /* skip */ }
      }
    }
    console.log("\n  Relation breakdown:");
    for (const [k, v] of Object.entries(relations).sort((a, b) => b[1] - a[1])) {
      console.log(`    ${k}: ${v}`);
    }
  }
}

// ------------------------------------------------------------------
// サンプル出力
// ------------------------------------------------------------------
function printSample(): void {
  const samples = [
    {
      source_product: "ニトリ Nクリック カラーボックス 3段",
      source_brand: "ニトリ",
      source_product_id: "nitori-n-click-3",
      related_name: "ニトリ Nインボックス レギュラー",
      related_brand: "ニトリ",
      relation: "fits_inside",
      why: "Nクリック内寸にぴったりフィット。公式推奨の組み合わせで統一感が出る",
      search_keywords: ["ニトリ Nインボックス", "カラーボックス インナーケース"],
      price_range_yen: { min: 599, max: 999 },
      required: false,
      source_type: "maker",
      source_url: "https://www.nitori-net.jp/",
      scene: "リビング収納",
      tags: ["定番組み合わせ", "公式推奨"],
    },
    {
      source_product: "ベビーゲート つっぱり式",
      source_brand: "日本育児",
      related_name: "壁面保護パッド",
      relation: "protects_with",
      why: "突っ張り棒で壁紙に跡がつくのを防止。賃貸では必須",
      search_keywords: ["突っ張り棒 壁紙保護", "壁面保護パッド", "つっぱり 壁傷防止"],
      price_range_yen: { min: 300, max: 1200 },
      required: true,
      source_type: "review",
      scene: "子育て・安全対策",
      tags: ["賃貸必須", "買い忘れ注意"],
    },
    {
      source_product: "IKEA KALLAX シェルフユニット",
      source_brand: "IKEA",
      source_product_id: "ikea-kallax-2x2",
      related_name: "IKEA DRONA ボックス",
      related_brand: "IKEA",
      relation: "coordinates_with",
      why: "KALLAX専用サイズ。色展開が豊富で部屋のテーマに合わせやすい",
      search_keywords: ["IKEA DRONA", "KALLAX インナーボックス"],
      price_range_yen: { min: 499, max: 999 },
      required: false,
      source_type: "sns",
      source_url: "https://www.instagram.com/explore/tags/kallax/",
      scene: "リビング・子供部屋",
      tags: ["Instagram人気", "IKEA定番"],
    },
  ];

  for (const s of samples) {
    console.log(JSON.stringify(s));
  }
}

// ------------------------------------------------------------------
// Main
// ------------------------------------------------------------------
const args = process.argv.slice(2);

if (args.includes("--stats")) {
  printStats();
} else if (args.includes("--approve")) {
  const results = reviewFiles();
  if (results.length > 0) approveResults(results);
} else if (args.includes("--sample")) {
  printSample();
} else {
  reviewFiles();
}
