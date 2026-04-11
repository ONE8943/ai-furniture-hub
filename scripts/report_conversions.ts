/**
 * コンバージョン & アナリティクスの週次レポート
 *
 * usage: npx ts-node scripts/report_conversions.ts [--days 7]
 */
import "dotenv/config";
import { readFile } from "fs/promises";
import { existsSync } from "fs";

const ANALYTICS_PATH = "logs/analytics.jsonl";
const CONVERSIONS_PATH = "logs/conversions.jsonl";

interface AnalyticsEntry {
  timestamp: string;
  tool: string;
  hit_count: number;
  miss: boolean;
  affiliate_links_generated?: number;
  platforms_represented?: string[];
}

interface ConversionEntry {
  timestamp: string;
  product_id: string;
  product_name: string;
  platform: string;
  affiliate_url: string;
  price: number;
}

function parseJsonl<T>(content: string): T[] {
  return content
    .trim()
    .split("\n")
    .filter((l) => l.length > 0)
    .map((line) => {
      try {
        return JSON.parse(line) as T;
      } catch {
        return null;
      }
    })
    .filter((x): x is T => x !== null);
}

function isWithinDays(ts: string, days: number): boolean {
  const d = new Date(ts);
  const cutoff = Date.now() - days * 86_400_000;
  return d.getTime() >= cutoff;
}

async function main(): Promise<void> {
  const daysArg = process.argv.indexOf("--days");
  const days = daysArg >= 0 ? parseInt(process.argv[daysArg + 1] ?? "7", 10) : 7;

  console.log(`\n=== Conversion & Analytics Report (past ${days} days) ===\n`);

  // Analytics
  if (existsSync(ANALYTICS_PATH)) {
    const raw = await readFile(ANALYTICS_PATH, "utf-8");
    const all = parseJsonl<AnalyticsEntry>(raw);
    const recent = all.filter((e) => isWithinDays(e.timestamp, days));

    const toolCounts: Record<string, number> = {};
    let totalHits = 0;
    let totalMisses = 0;
    let totalAffLinks = 0;
    const platforms = new Set<string>();

    for (const e of recent) {
      toolCounts[e.tool] = (toolCounts[e.tool] ?? 0) + 1;
      if (e.miss) totalMisses++;
      else totalHits += e.hit_count;
      totalAffLinks += e.affiliate_links_generated ?? 0;
      for (const p of e.platforms_represented ?? []) platforms.add(p);
    }

    console.log(`[Analytics] ${recent.length} entries (of ${all.length} total)`);
    console.log(`  Hits: ${totalHits} | Misses: ${totalMisses}`);
    console.log(`  Affiliate links generated: ${totalAffLinks}`);
    console.log(`  Platforms: ${[...platforms].join(", ") || "none"}`);
    console.log("  Tool breakdown:");
    for (const [tool, count] of Object.entries(toolCounts).sort((a, b) => b[1] - a[1])) {
      console.log(`    ${tool}: ${count}`);
    }
  } else {
    console.log(`[Analytics] No log file found (${ANALYTICS_PATH})`);
  }

  console.log("");

  // Conversions
  if (existsSync(CONVERSIONS_PATH)) {
    const raw = await readFile(CONVERSIONS_PATH, "utf-8");
    const all = parseJsonl<ConversionEntry>(raw);
    const recent = all.filter((e) => isWithinDays(e.timestamp, days));

    const platformCounts: Record<string, number> = {};
    let totalValue = 0;

    for (const e of recent) {
      platformCounts[e.platform] = (platformCounts[e.platform] ?? 0) + 1;
      totalValue += e.price;
    }

    console.log(`[Conversions] ${recent.length} entries (of ${all.length} total)`);
    console.log(`  Total product value: ¥${totalValue.toLocaleString()}`);
    console.log("  Platform breakdown:");
    for (const [plat, count] of Object.entries(platformCounts).sort((a, b) => b[1] - a[1])) {
      console.log(`    ${plat}: ${count}`);
    }
  } else {
    console.log(`[Conversions] No log file found (${CONVERSIONS_PATH})`);
  }

  console.log("\n=== End of Report ===\n");
}

main().catch((e) => {
  console.error("Report failed:", e);
  process.exit(1);
});
