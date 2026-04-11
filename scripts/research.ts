/**
 * 情報収集サポートスクリプト
 *
 * 軽量AI（Gemini Flash等）が効率よくコンテキストを把握するための
 * プロジェクトサマリーを生成する。
 *
 * usage:
 *   npx ts-node scripts/research.ts               # 全体サマリー
 *   npx ts-node scripts/research.ts --tools        # ツール一覧
 *   npx ts-node scripts/research.ts --catalog      # カタログ統計
 *   npx ts-node scripts/research.ts --logs         # ログ統計
 *   npx ts-node scripts/research.ts --deps         # 依存関係
 *   npx ts-node scripts/research.ts --context      # context.md を生成
 */
import "dotenv/config";
import { readdirSync, readFileSync, existsSync, statSync, writeFileSync } from "fs";
import { join } from "path";
import { KNOWN_PRODUCTS_DB } from "../shared/catalog/known_products";

const ROOT = join(__dirname, "..");

function countLines(path: string): number {
  try {
    return readFileSync(path, "utf-8").split("\n").length;
  } catch {
    return 0;
  }
}

function listDir(dir: string): string[] {
  try {
    return readdirSync(join(ROOT, dir)).filter((f) => !f.startsWith("."));
  } catch {
    return [];
  }
}

function fileSize(path: string): string {
  try {
    const s = statSync(join(ROOT, path)).size;
    if (s < 1024) return `${s}B`;
    if (s < 1024 * 1024) return `${(s / 1024).toFixed(1)}KB`;
    return `${(s / 1024 / 1024).toFixed(1)}MB`;
  } catch {
    return "N/A";
  }
}

function printOverview(): void {
  console.log("# Project Overview\n");

  const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf-8"));
  console.log(`- **Name**: ${pkg.name}`);
  console.log(`- **Version**: ${pkg.version}`);
  console.log(`- **Description**: ${pkg.description}`);
  console.log("");

  console.log("## Directory Structure\n");
  const dirs = [
    "tools", "adapters", "schemas", "services", "utils", "lib",
    "shared/catalog", "data", "scripts", "test", "rules",
    "public", "personal-app/src", ".github/workflows",
  ];
  for (const d of dirs) {
    const files = listDir(d);
    if (files.length > 0) {
      console.log(`- \`${d}/\`: ${files.length} files (${files.join(", ")})`);
    }
  }
  console.log("");
}

function printTools(): void {
  console.log("## MCP Tools (10)\n");
  const toolFiles = listDir("tools").filter((f) => f.endsWith(".ts"));
  for (const f of toolFiles) {
    const content = readFileSync(join(ROOT, "tools", f), "utf-8");
    const lines = content.split("\n").length;
    const hasAffiliate = content.includes("affiliate_url");
    console.log(`- \`${f}\` (${lines} lines) ${hasAffiliate ? "[affiliate]" : "[no-affiliate]"}`);
  }
  console.log("");
}

function printCatalog(): void {
  console.log("## Known Products Catalog\n");
  console.log(`- **Total products**: ${KNOWN_PRODUCTS_DB.length}`);

  const brands: Record<string, number> = {};
  const withCompat: number = KNOWN_PRODUCTS_DB.filter((p) => p.compatible_storage.length > 0).length;
  const withConsumables: number = KNOWN_PRODUCTS_DB.filter((p) => p.consumables.length > 0).length;
  const discontinued: number = KNOWN_PRODUCTS_DB.filter((p) => p.discontinued).length;

  for (const p of KNOWN_PRODUCTS_DB) {
    brands[p.brand] = (brands[p.brand] ?? 0) + 1;
  }

  console.log(`- **Brands**: ${Object.keys(brands).length}`);
  for (const [brand, count] of Object.entries(brands).sort((a, b) => b[1] - a[1])) {
    console.log(`  - ${brand}: ${count}`);
  }
  console.log(`- **With compatible storage**: ${withCompat}`);
  console.log(`- **With consumables**: ${withConsumables}`);
  console.log(`- **Discontinued**: ${discontinued}`);
  console.log("");
}

function printLogs(): void {
  console.log("## Log Statistics\n");
  const logFiles = ["logs/analytics.jsonl", "logs/conversions.jsonl", "logs/requirement_gaps.jsonl"];
  for (const logFile of logFiles) {
    const fullPath = join(ROOT, logFile);
    if (existsSync(fullPath)) {
      const lines = countLines(fullPath) - 1;
      const size = fileSize(logFile);
      console.log(`- \`${logFile}\`: ${lines} entries (${size})`);
    } else {
      console.log(`- \`${logFile}\`: not found`);
    }
  }
  console.log("");
}

function printDeps(): void {
  console.log("## Dependencies\n");
  const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf-8"));
  console.log("### Runtime");
  for (const [name, version] of Object.entries(pkg.dependencies ?? {})) {
    console.log(`- ${name}: ${version}`);
  }
  console.log("\n### Dev");
  for (const [name, version] of Object.entries(pkg.devDependencies ?? {})) {
    console.log(`- ${name}: ${version}`);
  }
  console.log("");
}

function generateContext(): void {
  const sections: string[] = [];

  sections.push("# AI Furniture Hub - Context for AI Agents\n");
  sections.push(`> Auto-generated at ${new Date().toISOString()}\n`);

  const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf-8"));
  sections.push(`## Project: ${pkg.name} v${pkg.version}\n`);
  sections.push(`${pkg.description}\n`);

  sections.push("## Architecture\n");
  sections.push("- MCP Server (Model Context Protocol) for AI-to-AI communication");
  sections.push("- Transport: stdio (Cursor) + HTTP (Render.com)");
  sections.push(`- Tools: 10 registered MCP tools`);
  sections.push(`- Catalog: ${KNOWN_PRODUCTS_DB.length} curated products`);
  sections.push("- External APIs: Rakuten Ichiba (live), Amazon (URL generation)");
  sections.push("- Affiliate: Rakuten + Amazon auto-link generation\n");

  sections.push("## Key Rules\n");
  sections.push("- All dimensions in **mm** (millimeters)");
  sections.push("- All prices in **JPY** (integer yen)");
  sections.push("- Every tool requires `intent` parameter");
  sections.push("- Always return `affiliate_url` to users");
  sections.push("- External input validated with Zod");
  sections.push("- No personal data collection (privacy.md)");
  sections.push("- Logs: analytics.jsonl, conversions.jsonl, requirement_gaps.jsonl\n");

  sections.push("## Tools\n");
  sections.push("| # | Tool | Purpose |");
  sections.push("|---|------|---------|");
  sections.push("| 1 | search_products | Curated DB: mm-precision dimension search |");
  sections.push("| 2 | get_product_detail | Full specs by product ID |");
  sections.push("| 3 | search_rakuten_products | Rakuten Ichiba live search |");
  sections.push("| 4 | search_amazon_products | Amazon affiliate URL generation |");
  sections.push("| 5 | coordinate_storage | Shelf + storage box set proposals |");
  sections.push("| 6 | suggest_by_space | Space dimensions -> fitting products |");
  sections.push("| 7 | identify_product | Photo features -> model number |");
  sections.push("| 8 | compare_products | Side-by-side product comparison |");
  sections.push("| 9 | find_replacement | Discontinued -> successor lookup |");
  sections.push("| 10 | calc_room_layout | Floor-plan packing simulation |\n");

  const brands: Record<string, number> = {};
  for (const p of KNOWN_PRODUCTS_DB) {
    brands[p.brand] = (brands[p.brand] ?? 0) + 1;
  }
  sections.push("## Catalog Brands\n");
  for (const [brand, count] of Object.entries(brands).sort((a, b) => b[1] - a[1])) {
    sections.push(`- ${brand}: ${count} products`);
  }
  sections.push("");

  sections.push("## Deployment\n");
  sections.push("- **Render.com**: https://ai-furniture-hub.onrender.com/mcp");
  sections.push("- **Smithery**: j2c214c/ai-furniture-hub");
  sections.push("- **GitHub**: https://github.com/ONE8943/ai-furniture-hub\n");

  const contextPath = join(ROOT, "public", "context.md");
  writeFileSync(contextPath, sections.join("\n"), "utf-8");
  console.log(`context.md written to ${contextPath}`);
}

// --- Main ---
const args = process.argv.slice(2);
const showAll = args.length === 0;

if (showAll || args.includes("--overview")) printOverview();
if (showAll || args.includes("--tools")) printTools();
if (showAll || args.includes("--catalog")) printCatalog();
if (showAll || args.includes("--logs")) printLogs();
if (args.includes("--deps")) printDeps();
if (args.includes("--context")) generateContext();

if (showAll) {
  console.log("---");
  console.log("Run with --context to generate public/context.md");
  console.log("Run with --deps for dependency info");
}
