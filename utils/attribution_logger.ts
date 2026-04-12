/**
 * Attribution ログ記録
 *
 * 各API呼び出しの attribution_id, source, tool, 結果件数を
 * logs/attribution.jsonl に追記する。
 * 将来 pay-per-call 集計やパートナー別レポートに利用。
 */
import { appendFile, mkdir } from "fs/promises";
import { dirname } from "path";
import { z } from "zod";
import type { AttributionMeta } from "../shared/attribution/index";

const ATTRIBUTION_LOG_PATH = "logs/attribution.jsonl";

const AttributionLogSchema = z.object({
  attribution_id: z.string(),
  source: z.enum(["apify", "rapidapi", "direct", "unknown"]),
  tool: z.string(),
  timestamp: z.string(),
  result_count: z.number().int().nonnegative(),
  /** 呼び出し時のパラメータ要約（PII不可） */
  query_summary: z.record(z.string(), z.unknown()).optional(),
});

export type AttributionLogEntry = z.infer<typeof AttributionLogSchema>;

async function ensureDir(): Promise<void> {
  await mkdir(dirname(ATTRIBUTION_LOG_PATH), { recursive: true });
}

/**
 * attribution.jsonl に追記（ノンブロッキング）
 */
export async function logAttribution(
  meta: AttributionMeta,
  resultCount: number,
  querySummary?: Record<string, unknown>,
): Promise<void> {
  try {
    const entry: AttributionLogEntry = {
      attribution_id: meta.attribution_id,
      source: meta.source,
      tool: meta.tool,
      timestamp: meta.timestamp,
      result_count: resultCount,
      query_summary: querySummary,
    };
    const validation = AttributionLogSchema.safeParse(entry);
    if (!validation.success) {
      console.error("[Attribution] Invalid log entry (skipped):", validation.error.issues);
      return;
    }
    await ensureDir();
    await appendFile(ATTRIBUTION_LOG_PATH, JSON.stringify(validation.data) + "\n", "utf-8");
  } catch (e) {
    console.error("[Attribution] Log write failed:", e);
  }
}
