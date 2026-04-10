import { appendFile, mkdir } from "fs/promises";
import { dirname } from "path";
import { AnalyticsLog, AnalyticsLogSchema } from "../schemas/analytics";

const LOG_FILE_PATH = "logs/analytics.jsonl";

async function ensureLogDir(): Promise<void> {
  await mkdir(dirname(LOG_FILE_PATH), { recursive: true });
}

/**
 * analytics.jsonl にインサイトログを追記する
 * ノンブロッキング：ログ失敗はconsole.errorに留め、メイン処理には影響させない
 * 書き込み前に Zod で検証し、不正なデータは stderr に警告して書き込まない
 */
export async function logAnalytics(entry: AnalyticsLog): Promise<void> {
  try {
    const validation = AnalyticsLogSchema.safeParse(entry);
    if (!validation.success) {
      console.error("[Analytics] Invalid log entry (skipped):", validation.error.issues);
      return;
    }
    await ensureLogDir();
    const line = JSON.stringify(validation.data) + "\n";
    await appendFile(LOG_FILE_PATH, line, "utf-8");
  } catch (e) {
    console.error("[Analytics] Log write failed:", e);
  }
}

/**
 * ミス（適合なし）ログの簡易ヘルパー
 */
export function buildMissLog(
  tool: string,
  query: Record<string, unknown>,
  intent: string,
  missReason: string
): AnalyticsLog {
  return {
    timestamp: new Date().toISOString(),
    tool,
    query,
    intent,
    hit_count: 0,
    miss: true,
    miss_reason: missReason,
  };
}

/**
 * ヒットログの簡易ヘルパー
 */
export function buildHitLog(
  tool: string,
  query: Record<string, unknown>,
  intent: string,
  hitCount: number
): AnalyticsLog {
  return {
    timestamp: new Date().toISOString(),
    tool,
    query,
    intent,
    hit_count: hitCount,
    miss: false,
  };
}
