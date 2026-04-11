/**
 * 後方互換のための再エクスポート
 *
 * 実体は以下に分離済み:
 *   types.ts          -- 型定義（ProductCategory, KnownProduct, RelatedItem 等）
 *   products_db.ts    -- KNOWN_PRODUCTS_DB（製品データ配列）
 *   product_helpers.ts -- 検索・マッチング関数
 *
 * 新しいコードは各ファイルを直接importしても良いが、
 * 既存の import { ... } from "../shared/catalog/known_products" は
 * このファイル経由で全て動作する。
 */
export * from "./types";
export * from "./products_db";
export * from "./product_helpers";
