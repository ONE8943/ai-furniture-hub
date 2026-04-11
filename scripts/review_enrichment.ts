/**
 * 既存製品のデータ充実（内寸・related_items・compatible_storage 等）を検証するスクリプト
 *
 * 対象ファイル: staging/enrich_*.jsonl
 *
 *   npx ts-node scripts/review_enrichment.ts                # レビュー
 *   npx ts-node scripts/review_enrichment.ts --approve      # 合格分を approved/ へ
 *   npx ts-node scripts/review_enrichment.ts --stats        # 統計
 *   npx ts-node scripts/review_enrichment.ts --gaps         # 穴リスト出力（エージェント用）
 *   npx ts-node scripts/review_enrichment.ts --sample       # サンプル出力
 */
import "dotenv/config";
import {
  existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync, renameSync,
} from "fs";
import { join } from "path";
import { z } from "zod";
import { KNOWN_PRODUCTS_DB } from "../shared/catalog/known_products";

const ROOT = join(__dirname, "..");
const STAGING = join(ROOT, "staging");
const APPROVED = join(ROOT, "staging", "approved");
const REJECTED = join(ROOT, "staging", "rejected");

for (const d of [STAGING, APPROVED, REJECTED]) {
  if (!existsSync(d)) mkdirSync(d, { recursive: true });
}

const SourceSchema = z.object({
  url: z.string().url(),
  type: z.enum(["official", "rakuten", "amazon", "kakaku", "blog", "manual", "other"]),
  accessed: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

const CompatStorageSchema = z.object({
  name: z.string().min(1),
  model_number: z.string(),
  width_mm: z.number().positive(),
  height_mm: z.number().positive(),
  depth_mm: z.number().positive(),
  fits_per_tier: z.number().int().positive(),
  note: z.string(),
});

const RelatedItemSchema = z.object({
  relation: z.enum(["requires", "protects_with", "fits_inside", "coordinates_with", "enhances_with", "alternative"]),
  name: z.string().min(1),
  category: z.string().min(1),
  why: z.string().min(10),
  product_id: z.string().optional(),
  search_keywords: z.array(z.string()).min(1),
  price_range: z.object({ min: z.number().nonnegative(), max: z.number().nonnegative() }).optional(),
  required: z.boolean(),
});

const EnrichEntrySchema = z.object({
  product_id: z.string().min(1),
  source: SourceSchema,

  inner_width_mm: z.number().nonnegative().optional(),
  inner_height_per_tier_mm: z.number().nonnegative().optional(),
  inner_depth_mm: z.number().nonnegative().optional(),

  weight_kg: z.number().nonnegative().optional(),
  load_capacity_per_tier_kg: z.number().nonnegative().optional(),

  compatible_storage: z.array(CompatStorageSchema).optional(),
  related_items: z.array(RelatedItemSchema).optional(),

  price_range: z.object({ min: z.number().nonnegative(), max: z.number().nonnegative() }).optional(),
});

type EnrichEntry = z.infer<typeof EnrichEntrySchema>;

interface ReviewResult {
  entry: EnrichEntry;
  passed: boolean;
  issues: string[];
  warnings: string[];
}

function validate(raw: unknown): ReviewResult {
  const parsed = EnrichEntrySchema.safeParse(raw);
  if (!parsed.success) {
    return {
      entry: raw as EnrichEntry,
      passed: false,
      issues: parsed.error.issues.map(e => `${String(e.path?.join?.(".") ?? "")}: ${e.message}`),
      warnings: [],
    };
  }

  const entry = parsed.data;
  const issues: string[] = [];
  const warnings: string[] = [];

  const existing = KNOWN_PRODUCTS_DB.find(p => p.id === entry.product_id);
  if (!existing) {
    issues.push(`product_id "${entry.product_id}" がカタログに存在しない`);
    return { entry, passed: false, issues, warnings };
  }

  if (entry.inner_width_mm && entry.inner_width_mm >= existing.outer_width_mm) {
    issues.push(`内寸幅(${entry.inner_width_mm}) >= 外寸幅(${existing.outer_width_mm})`);
  }
  if (entry.inner_depth_mm && entry.inner_depth_mm >= existing.outer_depth_mm) {
    issues.push(`内寸奥行(${entry.inner_depth_mm}) >= 外寸奥行(${existing.outer_depth_mm})`);
  }

  if (entry.compatible_storage) {
    for (const cs of entry.compatible_storage) {
      const iw = entry.inner_width_mm ?? existing.inner_width_mm;
      const id = entry.inner_depth_mm ?? existing.inner_depth_mm;
      if (iw > 0 && cs.width_mm > iw) {
        warnings.push(`compatible_storage "${cs.name}" 幅(${cs.width_mm}) > 内寸幅(${iw})`);
      }
      if (id > 0 && cs.depth_mm > id) {
        warnings.push(`compatible_storage "${cs.name}" 奥行(${cs.depth_mm}) > 内寸奥行(${id})`);
      }
    }
  }

  if (entry.price_range) {
    if (entry.price_range.min > entry.price_range.max) {
      issues.push(`価格帯逆転: min(${entry.price_range.min}) > max(${entry.price_range.max})`);
    }
  }

  return { entry, passed: issues.length === 0, issues, warnings };
}

function reviewFiles(): ReviewResult[] {
  const files = readdirSync(STAGING).filter(f => f.startsWith("enrich_") && f.endsWith(".jsonl"));

  if (files.length === 0) {
    console.log("staging/ にデータ充実ファイル (enrich_*.jsonl) がありません。\n");
    console.log("--gaps オプションで穴リストを出力し、エージェントに渡してください。\n");
    return [];
  }

  const results: ReviewResult[] = [];

  for (const file of files) {
    console.log(`\n=== Reviewing: ${file} ===\n`);
    const lines = readFileSync(join(STAGING, file), "utf-8").split("\n").filter(l => l.trim());
    let pass = 0, fail = 0;

    for (const line of lines) {
      let parsed: unknown;
      try { parsed = JSON.parse(line); } catch { console.log("  SKIP: JSON parse error"); fail++; continue; }

      const r = validate(parsed);
      results.push(r);
      if (r.passed) {
        pass++;
        const warn = r.warnings.length > 0 ? ` (${r.warnings.length} warnings)` : "";
        console.log(`  PASS${warn}: ${r.entry.product_id}`);
        for (const w of r.warnings) console.log(`    ⚠ ${w}`);
      } else {
        fail++;
        console.log(`  FAIL: ${(r.entry as any)?.product_id ?? "?"}`);
        for (const i of r.issues) console.log(`    ✗ ${i}`);
      }
    }
    console.log(`\n  Result: ${pass} passed, ${fail} failed (total ${lines.length})`);
  }
  return results;
}

function approve(results: ReviewResult[]): void {
  const ok = results.filter(r => r.passed);
  const ng = results.filter(r => !r.passed);

  if (ok.length > 0) {
    const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const path = join(APPROVED, `enrich_approved_${ts}.jsonl`);
    writeFileSync(path, ok.map(r => JSON.stringify(r.entry)).join("\n") + "\n", "utf-8");
    console.log(`\n${ok.length} entries approved → ${path}`);
  }
  if (ng.length > 0) {
    const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const path = join(REJECTED, `enrich_rejected_${ts}.jsonl`);
    writeFileSync(path, ng.map(r => JSON.stringify({ ...r.entry, _issues: r.issues })).join("\n") + "\n", "utf-8");
    console.log(`${ng.length} entries rejected → ${path}`);
  }

  for (const f of readdirSync(STAGING).filter(f => f.startsWith("enrich_") && f.endsWith(".jsonl"))) {
    renameSync(join(STAGING, f), join(STAGING, `reviewed_${f}`));
  }
  console.log("Staging files renamed.\n");
}

function printGaps(): void {
  console.log("## データ充実が必要な製品リスト\n");

  const gaps: Array<{ id: string; brand: string; name: string; missing: string[] }> = [];

  for (const p of KNOWN_PRODUCTS_DB) {
    const missing: string[] = [];
    if (p.inner_width_mm === 0 && p.inner_depth_mm === 0) missing.push("inner_dims");
    if (!p.related_items || p.related_items.length === 0) missing.push("related_items");
    if (p.compatible_storage.length === 0) missing.push("compatible_storage");
    if (p.load_capacity_per_tier_kg === 0) missing.push("load_capacity");
    if (missing.length > 0) {
      gaps.push({ id: p.id, brand: p.brand, name: p.name, missing });
    }
  }

  gaps.sort((a, b) => b.missing.length - a.missing.length);

  console.log(`Total gaps: ${gaps.length} / ${KNOWN_PRODUCTS_DB.length} products\n`);

  const byMissing: Record<string, number> = {};
  for (const g of gaps) {
    for (const m of g.missing) byMissing[m] = (byMissing[m] ?? 0) + 1;
  }
  console.log("| 不足項目 | 件数 |");
  console.log("|---|---|");
  for (const [k, v] of Object.entries(byMissing).sort((a, b) => b[1] - a[1])) {
    console.log(`| ${k} | ${v} |`);
  }

  console.log("\n### 優先度HIGH（3項目以上不足）\n");
  const high = gaps.filter(g => g.missing.length >= 3);
  for (const g of high.slice(0, 30)) {
    console.log(`- **${g.id}** (${g.brand} ${g.name}) → ${g.missing.join(", ")}`);
  }
  if (high.length > 30) console.log(`  ... and ${high.length - 30} more`);

  console.log("\n### JSONL出力（エージェント用）\n");
  console.log("以下をエージェントに渡すと、各製品のデータ充実ができます：\n");
  for (const g of gaps.slice(0, 5)) {
    console.log(JSON.stringify({
      product_id: g.id,
      brand: g.brand,
      name: g.name,
      missing: g.missing,
      outer_width_mm: KNOWN_PRODUCTS_DB.find(p => p.id === g.id)!.outer_width_mm,
      outer_height_mm: KNOWN_PRODUCTS_DB.find(p => p.id === g.id)!.outer_height_mm,
      outer_depth_mm: KNOWN_PRODUCTS_DB.find(p => p.id === g.id)!.outer_depth_mm,
    }));
  }
  if (gaps.length > 5) console.log(`... (${gaps.length - 5} more)`);
}

function printSample(): void {
  console.log(JSON.stringify({
    product_id: "nitori-nclick-regular-3",
    source: { url: "https://www.nitori-net.jp/ec/product/8841424/", type: "official", accessed: "2026-04-11" },
    inner_width_mm: 380,
    inner_height_per_tier_mm: 270,
    inner_depth_mm: 260,
    compatible_storage: [
      { name: "Nインボックス レギュラー", model_number: "8422031", width_mm: 389, height_mm: 236, depth_mm: 266, fits_per_tier: 1, note: "純正" },
    ],
    related_items: [
      { relation: "fits_inside", name: "Nインボックス", category: "収納ケース", why: "Nクリック内寸にぴったりフィットする純正インナー", search_keywords: ["ニトリ Nインボックス"], price_range: { min: 390, max: 1290 }, required: false },
    ],
  }, null, 2));
}

function printStats(): void {
  console.log("## Enrichment Pipeline Stats\n");
  const aFiles = existsSync(APPROVED) ? readdirSync(APPROVED).filter(f => f.startsWith("enrich_")) : [];
  const rFiles = existsSync(REJECTED) ? readdirSync(REJECTED).filter(f => f.startsWith("enrich_")) : [];
  const pending = readdirSync(STAGING).filter(f => f.startsWith("enrich_") && f.endsWith(".jsonl"));

  let ac = 0, rc = 0;
  for (const f of aFiles) ac += readFileSync(join(APPROVED, f), "utf-8").split("\n").filter(l => l.trim()).length;
  for (const f of rFiles) rc += readFileSync(join(REJECTED, f), "utf-8").split("\n").filter(l => l.trim()).length;

  console.log(`- Pending: ${pending.length} files`);
  console.log(`- Approved: ${ac} entries`);
  console.log(`- Rejected: ${rc} entries`);
}

// --- Main ---
const args = process.argv.slice(2);
if (args.includes("--gaps")) printGaps();
else if (args.includes("--stats")) printStats();
else if (args.includes("--sample")) printSample();
else if (args.includes("--approve")) { const r = reviewFiles(); if (r.length > 0) approve(r); }
else reviewFiles();
