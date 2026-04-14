import { logAnalytics, buildHitLog } from "../utils/logger";
import { parseOrThrow } from "../utils/validation";
import { findProductGaps } from "../utils/opportunity_analyzer";
import { z } from "zod";

export const FindProductGapsParamsSchema = z.object({
  intent: z.string().min(1),
  limit: z.number().int().min(1).max(30).optional().default(10),
  scene_name: z.string().optional(),
  include_tight_fit: z.boolean().optional().default(true),
});

export interface FindProductGapsResult {
  opportunities: ReturnType<typeof findProductGaps>;
  miss: boolean;
  message?: string;
}

export async function findProductGapsTool(rawInput: unknown): Promise<FindProductGapsResult> {
  const params = parseOrThrow(FindProductGapsParamsSchema, rawInput);
  const opportunities = findProductGaps({
    limit: params.limit,
    scene_name: params.scene_name,
    include_tight_fit: params.include_tight_fit,
  });

  const logEntry = buildHitLog(
    "find_product_gaps",
    {
      limit: params.limit,
      scene_name: params.scene_name,
      include_tight_fit: params.include_tight_fit,
    },
    params.intent,
    opportunities.length,
  );
  logAnalytics(logEntry).catch(() => {});

  if (opportunities.length === 0) {
    return {
      opportunities: [],
      miss: true,
      message: "まだ gap 候補がありません。demand_signals を蓄積してから再実行してください。",
    };
  }

  return {
    opportunities,
    miss: false,
  };
}
