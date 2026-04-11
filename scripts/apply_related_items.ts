/**
 * 承認済みコーディネートデータを known_products.ts の related_items に自動反映するスクリプト
 *
 *   npx ts-node scripts/apply_related_items.ts [jsonl_path]
 *
 * jsonl_path を省略すると staging/approved/ 内の最新 coord_approved_*.jsonl を使用
 */
import { readFileSync, readdirSync, writeFileSync } from "fs";
import { join } from "path";
import { KNOWN_PRODUCTS_DB } from "../shared/catalog/known_products";

const ROOT = join(__dirname, "..");
const CATALOG_PATH = join(ROOT, "shared", "catalog", "known_products.ts");

interface CoordEntry {
  product_id?: string;
  source_product: string;
  source_brand: string;
  related_name: string;
  relation: string;
  why: string;
  search_keywords: string[];
  price_range_yen?: { min: number; max: number };
  required: boolean;
  source_type: string;
  source_url?: string;
  scene?: string;
  tags?: string[];
}

function normalize(s: string): string {
  return s.replace(/[\s　・×x]/g, "").replace(/[（()）]/g, "").toLowerCase();
}

const ID_LOOKUP = new Map<string, string>();
for (const p of KNOWN_PRODUCTS_DB) {
  ID_LOOKUP.set(normalize(p.brand + p.name), p.id);
}

function resolveProductId(entry: CoordEntry): string | null {
  if (entry.product_id) {
    if (KNOWN_PRODUCTS_DB.some(p => p.id === entry.product_id)) return entry.product_id;
  }

  const brand = entry.source_brand;
  let name = entry.source_product;
  name = name.replace(new RegExp(`^${brand.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*`, "i"), "").trim();

  const key = normalize(brand + name);
  const direct = ID_LOOKUP.get(key);
  if (direct) return direct;

  for (const [k, id] of ID_LOOKUP) {
    if (key.includes(k) || k.includes(key)) return id;
  }

  for (const p of KNOWN_PRODUCTS_DB) {
    if (p.brand !== brand) continue;
    const pNorm = normalize(p.name);
    const nameNorm = normalize(name);
    const overlap = pNorm.split("").filter((_, i) => nameNorm.includes(pNorm.slice(i, i + 3))).length;
    if (overlap > pNorm.length * 0.5) return p.id;
  }

  return null;
}

function loadApprovedData(path?: string): CoordEntry[] {
  if (!path) {
    const dir = join(ROOT, "staging", "approved");
    const files = readdirSync(dir)
      .filter(f => f.startsWith("coord_approved_") && f.endsWith(".jsonl"))
      .sort()
      .reverse();
    if (!files.length) {
      console.error("No approved coordination files found.");
      process.exit(1);
    }
    path = join(dir, files[0]);
    console.log(`Using: ${files[0]}`);
  }
  return readFileSync(path, "utf-8")
    .split("\n")
    .filter(l => l.trim())
    .map(l => JSON.parse(l) as CoordEntry);
}

function guessCategory(relation: string, name: string): string {
  if (/キャスター/.test(name)) return "パーツ・アクセサリ";
  if (/棚板/.test(name)) return "パーツ・アクセサリ";
  if (/転倒防止|耐震|固定|金具/.test(name)) return "保護・補修材";
  if (/マット|シート|パッド|カバー|保護/.test(name)) return "保護・補修材";
  if (/ボックス|ケース|バスケット|インボックス|ドローナ|カゴ/.test(name)) return "収納ケース";
  if (/フック|ホルダー|ラベル|テープ|バンド|タグ/.test(name)) return "パーツ・アクセサリ";
  if (/トレー|仕切り|引き出し|チェスト/.test(name)) return "収納ケース";
  if (/モニター|USB|ハブ/.test(name)) return "デスク";
  if (/ケーブル|電源/.test(name)) return "パーツ・アクセサリ";
  if (relation === "alternative") return "その他";
  return "その他";
}

function toRelatedItemLiteral(e: CoordEntry): string {
  const cat = guessCategory(e.relation, e.related_name);
  const priceStr = e.price_range_yen
    ? `, price_range: { min: ${e.price_range_yen.min}, max: ${e.price_range_yen.max} }`
    : "";
  const req = e.relation === "requires" || e.required;
  const keywords = e.search_keywords.map(k => `"${k}"`).join(", ");
  const why = e.why.replace(/"/g, '\\"');

  return `      { relation: "${e.relation}", name: "${e.related_name}", category: "${cat}", why: "${why}", search_keywords: [${keywords}]${priceStr}, required: ${req} }`;
}

function main() {
  const customPath = process.argv[2];
  const entries = loadApprovedData(customPath);

  const byProduct = new Map<string, CoordEntry[]>();
  let unresolved = 0;
  for (const e of entries) {
    const pid = resolveProductId(e);
    if (!pid) {
      unresolved++;
      if (unresolved <= 10) console.warn(`  UNRESOLVED: "${e.source_brand} ${e.source_product}"`);
      continue;
    }
    e.product_id = pid;
    if (!byProduct.has(pid)) byProduct.set(pid, []);
    byProduct.get(pid)!.push(e);
  }
  if (unresolved > 10) console.warn(`  ... and ${unresolved - 10} more unresolved`);
  console.log(`Unresolved entries: ${unresolved}`);

  console.log(`Products to update: ${byProduct.size}`);
  console.log(`Total entries: ${entries.length}`);

  let src = readFileSync(CATALOG_PATH, "utf-8");
  let applied = 0;
  let skipped = 0;

  for (const [pid, items] of byProduct) {
    const idPattern = new RegExp(`id:\\s*"${pid.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`, "g");
    const idx = src.search(idPattern);
    if (idx === -1) {
      console.warn(`  SKIP: product_id "${pid}" not found in catalog`);
      skipped += items.length;
      continue;
    }

    const afterId = src.slice(idx);
    const existingRelated = afterId.match(/related_items:\s*\[[\s\S]*?\],/);

    const relatedLiterals = items.map(e => toRelatedItemLiteral(e)).join(",\n");
    const newBlock = `related_items: [\n${relatedLiterals},\n    ],`;

    if (existingRelated) {
      const existingContent = existingRelated[0];
      if (existingContent.includes("relation:")) {
        const mergedBlock = existingContent.replace(/\],\s*$/, `,\n${relatedLiterals},\n    ],`);
        src = src.slice(0, idx) + afterId.replace(existingContent, mergedBlock);
      } else {
        src = src.slice(0, idx) + afterId.replace(existingContent, newBlock);
      }
    } else {
      const urlTemplateMatch = afterId.match(/url_template:\s*"[^"]*",/);
      if (urlTemplateMatch) {
        const insertPoint = urlTemplateMatch[0];
        src = src.slice(0, idx) + afterId.replace(
          insertPoint,
          insertPoint + "\n    " + newBlock
        );
      } else {
        console.warn(`  SKIP: Cannot find insertion point for "${pid}"`);
        skipped += items.length;
        continue;
      }
    }
    applied += items.length;
  }

  writeFileSync(CATALOG_PATH, src, "utf-8");
  console.log(`\nDone! Applied: ${applied}, Skipped: ${skipped}`);
}

main();
