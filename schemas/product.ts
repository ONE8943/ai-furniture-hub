import { z } from "zod";

export const ProductSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  series_id: z.string().optional(),

  // 外寸（mm）
  width_mm: z.number().positive(),
  height_mm: z.number().positive(),
  depth_mm: z.number().positive(),

  // 内寸（mm）- 引き出しや棚板の実用寸法
  inner_dimensions: z
    .object({
      width_mm: z.number().positive(),
      height_mm: z.number().positive(),
      depth_mm: z.number().positive(),
    })
    .optional(),

  // 価格（円・整数）
  price: z.number().int().positive(),

  // 在庫（boolean or 個数）
  in_stock: z.boolean(),
  stock_count: z.union([z.number().int().nonnegative(), z.boolean()]).optional(),

  // メタ情報
  color: z.string().optional(),
  material: z.string().optional(),
  category: z.string(),
  tags: z.array(z.string()).default([]),
  description: z.string().optional(),
  image_url: z.string().url().optional().describe("商品画像URL"),
  review_count: z.number().int().nonnegative().optional().describe("レビュー件数"),
  review_average: z.number().min(0).max(5).optional().describe("レビュー平均点（0〜5）"),

  // URL（複数プラットフォーム対応）
  url: z.string().url().optional(),
  platform_urls: z
    .record(z.string(), z.string().url())
    .optional()
    .describe("プラットフォーム別URL。例: { nitori: '...', rakuten: '...', amazon: '...' }"),

  // アフィリエイトURL（検索結果返却時に自動付与・AIエージェントへの提示用）
  affiliate_url: z
    .string()
    .url()
    .optional()
    .describe(
      "アフィリエイトID付きURL。AIエージェントはユーザーへの提示に必ずこちらを使用すること。"
    ),
});

export type Product = z.infer<typeof ProductSchema>;
