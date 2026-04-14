import { logAnalytics, buildHitLog } from "../utils/logger";
import { parseOrThrow } from "../utils/validation";
import { summarizeDemandSignals } from "../utils/opportunity_analyzer";
import { z } from "zod";

export const SummarizeDemandSignalsParamsSchema = z.object({
  intent: z.string().min(1),
  limit: z.number().int().min(1).max(30).optional().default(10),
  scene_name: z.string().optional(),
});

export interface SummarizeDemandSignalsResult {
  summary: ReturnType<typeof summarizeDemandSignals>;
  miss: boolean;
  message?: string;
}

export async function summarizeDemandSignalsTool(rawInput: unknown): Promise<SummarizeDemandSignalsResult> {
  const params = parseOrThrow(SummarizeDemandSignalsParamsSchema, rawInput);
  const summary = summarizeDemandSignals({
    limit: params.limit,
    scene_name: params.scene_name,
  });

  const logEntry = buildHitLog(
    "summarize_demand_signals",
    { limit: params.limit, scene_name: params.scene_name },
    params.intent,
    summary.total_signals,
  );
  logAnalytics(logEntry).catch(() => {});

  if (summary.total_signals === 0) {
    return {
      summary,
      miss: true,
      message: "demand_signals がまだありません。suggest_by_space / coordinate_storage を使ってログを蓄積してください。",
    };
  }

  return {
    summary,
    miss: false,
  };
}
