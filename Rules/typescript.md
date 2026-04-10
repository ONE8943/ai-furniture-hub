# TypeScript 開発規約

## 基本方針

- TypeScript 厳格モード（`strict: true`）を使用すること
- 外部入力は必ずZodでバリデーションすること
- `any` 型の使用を禁止（`unknown` を使用すること）

---

## スキーマ定義（Zod）

### 単位の統一
- 寸法は**mm（ミリメートル）単位**で統一すること
- 価格は**円（整数）**で統一すること

### 商品スキーマの必須フィールド

```typescript
// schemas/product.ts
import { z } from "zod";

export const ProductSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  series_id: z.string().optional(),

  // 外寸（mm）
  width_mm: z.number().positive(),
  height_mm: z.number().positive(),
  depth_mm: z.number().positive(),

  // 内寸（mm）- オプション
  inner_width_mm: z.number().positive().optional(),
  inner_height_mm: z.number().positive().optional(),
  inner_depth_mm: z.number().positive().optional(),

  // 価格（円）
  price: z.number().int().positive(),

  // 在庫
  in_stock: z.boolean(),
  stock_count: z.number().int().nonnegative().optional(),

  // メタ情報
  color: z.string().optional(),
  material: z.string().optional(),
  category: z.string(),
  tags: z.array(z.string()).default([]),
});

export type Product = z.infer<typeof ProductSchema>;
```

---

## MCPツールの実装パターン

### 検索ツールの引数スキーマ

```typescript
// intentを必ず含めること
const SearchParamsSchema = z.object({
  width_mm_max: z.number().positive().optional(),
  width_mm_min: z.number().positive().optional(),
  height_mm_max: z.number().positive().optional(),
  depth_mm_max: z.number().positive().optional(),
  price_max: z.number().int().positive().optional(),
  color: z.string().optional(),
  in_stock_only: z.boolean().default(true),
  intent: z.string().min(1, "intentは必須です。ユーザーの目的を記述してください。"),
});
```

### エラー処理

```typescript
// ✅ GOOD: 型安全なエラー処理
try {
  const params = SearchParamsSchema.parse(rawInput);
} catch (e) {
  if (e instanceof z.ZodError) {
    return { error: "Invalid parameters", details: e.errors };
  }
  throw e;
}

// ❌ BAD: 型なしエラー
} catch (e: any) {
  return { error: e.message };
}
```

---

## ファイル構成規約

```
schemas/
  product.ts      # 商品スキーマ
  search.ts       # 検索パラメータスキーマ
  analytics.ts    # ログスキーマ

tools/
  search_products.ts    # 検索ツール実装
  get_product.ts        # 詳細取得ツール実装

utils/
  logger.ts       # analytics.jsonl への書き込みユーティリティ
  filter.ts       # 商品フィルタリングロジック
```

---

## 命名規約

| 対象 | 規約 | 例 |
|------|------|-----|
| ファイル | スネークケース | `search_products.ts` |
| クラス・型 | パスカルケース | `ProductSchema`, `SearchParams` |
| 関数・変数 | キャメルケース | `searchProducts`, `hitCount` |
| MCPツール名 | スネークケース | `search_products` |
| 定数 | アッパースネーク | `LOG_FILE_PATH` |

---

## 禁止事項

- `any` 型の使用（`unknown` + 型ガードを使うこと）
- `console.log` を本番コードに残すこと（ログは `utils/logger.ts` 経由で）
- Zodバリデーションを省略すること
- mm以外の単位でサイズを扱うこと
