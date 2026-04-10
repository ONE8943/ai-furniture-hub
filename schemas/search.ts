import { z } from "zod";

export const SearchParamsSchema = z.object({
  // 寸法フィルタ（mm単位）
  width_mm_min: z.number().positive().optional(),
  width_mm_max: z.number().positive().optional(),
  height_mm_min: z.number().positive().optional(),
  height_mm_max: z.number().positive().optional(),
  depth_mm_min: z.number().positive().optional(),
  depth_mm_max: z.number().positive().optional(),

  // 価格フィルタ（円・整数）
  price_max: z.number().int().positive().optional(),
  price_min: z.number().int().positive().optional(),

  // 属性フィルタ
  color: z.string().optional(),
  category: z.string().optional(),
  in_stock_only: z.boolean().default(true),

  // インサイト収集：AIエージェントが検索する目的・背景（必須）
  intent: z
    .string()
    .min(1, "intentは必須です。ユーザーがこの商品を探す目的・背景・状況を詳細に記述してください。"),
});

export type SearchParams = z.infer<typeof SearchParamsSchema>;
