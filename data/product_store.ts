import "dotenv/config";
import { Product } from "../schemas/product";
import { PRODUCTS as DUMMY_PRODUCTS } from "./products";
import {
  KNOWN_PRODUCTS_DB,
  KnownProduct,
} from "../shared/catalog/known_products";
import { fetchNitoriProducts } from "../adapters/nitori_scraper";
import {
  searchRakutenProducts,
  searchRakutenMultiPage,
  isRakutenApiConfigured,
} from "../adapters/rakuten_api";
import { randomUUID } from "node:crypto";

/**
 * 統合データレイヤー
 *
 * known_products.ts（カタログDB）をベースラインとし、
 * 楽天APIからのリアルタイムデータをマージして提供する。
 *
 * 設計:
 *   - known_products.ts のカタログデータが常にベースライン（300件+）
 *   - 楽天API取得データを追加でマージ（重複はIDで排除）
 *   - API取得失敗時もカタログデータで応答可能
 */

// -----------------------------------------------------------------------
// KnownProduct → Product 変換
// -----------------------------------------------------------------------

function knownToProduct(kp: KnownProduct): Product {
  const urlFromTemplate = kp.url_template.replace("{model_number}", kp.model_number);
  return {
    id: randomUUID(),
    name: kp.name,
    series_id: kp.series || undefined,
    width_mm: kp.outer_width_mm,
    height_mm: kp.outer_height_mm,
    depth_mm: kp.outer_depth_mm,
    inner_dimensions:
      kp.inner_width_mm > 0
        ? {
            width_mm: kp.inner_width_mm,
            height_mm: kp.inner_height_per_tier_mm,
            depth_mm: kp.inner_depth_mm,
          }
        : undefined,
    price: Math.round((kp.price_range.min + kp.price_range.max) / 2),
    in_stock: !kp.discontinued,
    color: kp.colors[0] || undefined,
    material: kp.material,
    category: kp.category || "その他",
    tags: [
      kp.brand,
      kp.series,
      ...(kp.visual_features || []),
      `known_id:${kp.id}`,
    ].filter(Boolean) as string[],
    description: `${kp.brand} ${kp.name}。${kp.visual_features?.slice(0, 2).join("、") || ""}`,
    url: urlFromTemplate.startsWith("http") ? urlFromTemplate : undefined,
    platform_urls: urlFromTemplate.startsWith("http")
      ? { rakuten: urlFromTemplate }
      : undefined,
  };
}

const CATALOG_PRODUCTS: Product[] = KNOWN_PRODUCTS_DB.map(knownToProduct);

// -----------------------------------------------------------------------
// キャッシュ
// -----------------------------------------------------------------------

interface StoreCache {
  products: Product[];
  lastRefreshed: Date | null;
  source: "catalog_only" | "merged";
}

const cache: StoreCache = {
  products: [...CATALOG_PRODUCTS],
  lastRefreshed: null,
  source: "catalog_only",
};

// キャッシュの有効期間（30分）
const CACHE_TTL_MS = 30 * 60 * 1000;

// -----------------------------------------------------------------------
// キャッシュ更新
// -----------------------------------------------------------------------

/**
 * ニトリからデータを取得してキャッシュをリフレッシュする
 * スクレイピング失敗時はダミーデータのみで継続
 */
export async function refreshProductStore(force = false): Promise<void> {
  const now = new Date();
  const cacheAge = cache.lastRefreshed
    ? now.getTime() - cache.lastRefreshed.getTime()
    : Infinity;

  if (!force && cacheAge < CACHE_TTL_MS) return; // キャッシュが新鮮

  try {
    type FetchTask = () => Promise<{ products: Product[]; label: string }>;
    const external: Product[] = [];

    async function runTask(task: FetchTask): Promise<void> {
      try {
        const r = await task();
        external.push(...r.products);
        process.stderr.write(
          `[ProductStore] ${r.label}: ${r.products.length}件取得\n`
        );
      } catch (e) {
        process.stderr.write(`[ProductStore] データ取得失敗: ${e}\n`);
      }
    }

    // ニトリ（モック or スクレイピング）は並列OK
    await Promise.all([
      runTask(() => fetchNitoriProducts("シェルフ", 5).then((r) => ({ products: r.products, label: "nitori-shelf" }))),
      runTask(() => fetchNitoriProducts("カラーボックス", 5).then((r) => ({ products: r.products, label: "nitori-box" }))),
    ]);

    // 楽天API: レートリミット厳守のため1キーワードずつ順次取得
    if (isRakutenApiConfigured()) {
      const RAKUTEN_KEYWORDS = [
        "収納棚",
        "カラーボックス",
        "本棚 シェルフ",
        "食器棚",
        "テレビ台 テレビボード",
        "チェスト 収納",
        "キャビネット",
        "ラック 収納",
        "クローゼット 収納",
        "サイドボード",
        "シューズラック 靴棚",
        "デスク 机",
        "ワゴン キッチン",
        "隙間収納",
        "壁面収納",
        "ニトリ シェルフ",
        "ニトリ カラーボックス",
        "ニトリ 食器棚",
      ];

      for (const kw of RAKUTEN_KEYWORDS) {
        await runTask(() =>
          searchRakutenMultiPage({ keyword: kw, maxPages: 2 }).then((r) => ({
            products: r.products,
            label: `rakuten-${kw}`,
          }))
        );
      }
    }

    // Amazon: PA-API未開放のためスキップ（URL生成方式で対応中）
    // PA-API解禁後に amazon_api.ts の順次取得を再有効化する

    if (external.length > 0) {
      const merged = new Map<string, Product>();
      for (const p of CATALOG_PRODUCTS) merged.set(p.id, p);
      for (const p of external) merged.set(p.id, p);

      cache.products = Array.from(merged.values());
      cache.source = "merged";
    }

    cache.lastRefreshed = now;
    process.stderr.write(
      `[ProductStore] リフレッシュ完了: ${cache.products.length}件 (source: ${cache.source})\n`
    );
  } catch (e) {
    process.stderr.write(`[ProductStore] リフレッシュ失敗（ダミーデータで継続）: ${e}\n`);
    cache.lastRefreshed = now;
  }
}

// -----------------------------------------------------------------------
// CRUD 操作
// -----------------------------------------------------------------------

/** 全商品を取得する */
export function getAllProducts(): Product[] {
  return cache.products;
}

/** IDで商品を検索する */
export function getProductById(id: string): Product | undefined {
  return cache.products.find((p) => p.id === id);
}

/** 商品名の部分一致で検索する（大文字小文字無視） */
export function searchProductsByName(keyword: string): Product[] {
  const lower = keyword.toLowerCase();
  return cache.products.filter(
    (p) =>
      p.name.toLowerCase().includes(lower) ||
      p.tags?.some((t) => t.toLowerCase().includes(lower))
  );
}

/** スクレイピング取得データのみを返す */
export function getScrapedProducts(): Product[] {
  return cache.products.filter(
    (p) => p.tags?.includes("スクレイピング取得")
  );
}

/** キャッシュの状態を返す（デバッグ・管理用） */
export function getStoreStatus(): {
  total: number;
  catalog: number;
  api_fetched: number;
  source: string;
  lastRefreshed: string | null;
} {
  const catalogCount = CATALOG_PRODUCTS.length;
  const apiFetchedCount = cache.products.length - catalogCount;

  return {
    total: cache.products.length,
    catalog: catalogCount,
    api_fetched: Math.max(0, apiFetchedCount),
    source: cache.source,
    lastRefreshed: cache.lastRefreshed?.toISOString() ?? null,
  };
}
