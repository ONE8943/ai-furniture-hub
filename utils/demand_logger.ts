import { appendFile, mkdir } from "fs/promises";
import { dirname } from "path";
import { DemandSignal, DemandSignalSchema } from "../schemas/demand_signal";

const DEMAND_LOG_FILE_PATH = "logs/demand_signals.jsonl";

async function ensureDemandLogDir(): Promise<void> {
  await mkdir(dirname(DEMAND_LOG_FILE_PATH), { recursive: true });
}

export async function logDemandSignal(entry: DemandSignal): Promise<void> {
  try {
    const validation = DemandSignalSchema.safeParse(entry);
    if (!validation.success) {
      console.error("[DemandSignal] Invalid log entry (skipped):", validation.error.issues);
      return;
    }
    await ensureDemandLogDir();
    const line = JSON.stringify(validation.data) + "\n";
    await appendFile(DEMAND_LOG_FILE_PATH, line, "utf-8");
  } catch (e) {
    console.error("[DemandSignal] Log write failed:", e);
  }
}

export function inferSafetyFlags(text: string): string[] {
  const normalized = text.normalize("NFKC").toLowerCase();
  const flags = new Set<string>();

  if (/(子供|子ども|赤ちゃん|幼児|乳児|ベビー)/.test(normalized)) {
    flags.add("child_reach_zone");
  }
  if (/(扉|引き出し|引出し|ヒンジ|蝶番|可動)/.test(normalized)) {
    flags.add("pinch_risk");
  }
  if (/(デスク|机|pc|モニター|配線|ケーブル|クランプ)/.test(normalized)) {
    flags.add("cable_clearance");
  }

  return Array.from(flags);
}
