# 個人向けアプリ（別プロジェクト枠）

MCP家具ハブ本体とは**混在させない**。在庫・自宅寸法・消耗品管理などのUIはこのディレクトリ（または別リポジトリ）で開発する。

## 共通データの参照

製品マスタ・型番・内寸などはリポジトリ直下の **`shared/`** を単一ソースとする。

```typescript
import {
  KNOWN_PRODUCTS_DB,
  findByDimensions,
  findProductByModelNumber,
  findMatchingProducts,
} from "../shared/catalog/known_products";
```

MCPサーバー（`tools/`・`identify_product` 等）も同じモジュールを参照する。

## 次のステップ（実装時）

- ここに `package.json` / フレームワークを置き、`shared` への相対 import でビルドする
- 認証・DB・写真アップロードは MCP 側に置かず、このアプリのみで完結させる
