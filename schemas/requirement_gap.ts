import { z } from "zod";

export const RequirementGapSchema = z.object({
  timestamp: z.string(),
  tool: z.string(),
  intent: z.string(),
  detected_attributes: z.array(z.string()),
  keywords_matched: z.array(z.string()),
  search_context: z.object({
    had_results: z.boolean(),
    hit_count: z.number().int().nonnegative(),
  }),
});

export type RequirementGap = z.infer<typeof RequirementGapSchema>;

/**
 * ギャップ検知辞書のエントリ型
 */
export interface GapKeywordEntry {
  attribute_key: string;
  keywords: string[];
  description: string;
}
