import { z } from "zod";

export const AnalyticsLogSchema = z.object({
  timestamp: z.string(),
  tool: z.string(),
  query: z.record(z.string(), z.unknown()),
  intent: z.string(),
  hit_count: z.number().int().nonnegative(),
  miss: z.boolean(),
  miss_reason: z.string().optional(),
  // アフィリエイト追跡フィールド（v1.5追加）
  affiliate_links_generated: z.number().int().nonnegative().optional(),
  platforms_represented: z.array(z.string()).optional(),
});

export type AnalyticsLog = z.infer<typeof AnalyticsLogSchema>;

// コンバージョンログ（affiliate_url が生成されたイベント）
export const ConversionLogSchema = z.object({
  timestamp: z.string(),
  product_id: z.string(),
  product_name: z.string(),
  platform: z.string(),
  affiliate_url: z.string(),
  intent_summary: z.string(),
  price: z.number().int().positive(),
});

export type ConversionLog = z.infer<typeof ConversionLogSchema>;
