import "dotenv/config";
import { Product } from "../schemas/product";
import { PRODUCTS as DUMMY_PRODUCTS } from "./products";
import { fetchNitoriProducts } from "../adapters/nitori_scraper";
import {
  searchRakutenProducts,
  searchRakutenMultiPage,
  isRakutenApiConfigured,
} from "../adapters/rakuten_api";
import {
  searchAmazonProducts,
  isAmazonApiConfigured,
} from "../adapters/amazon_api";

/**
 * 統合データレイヤー
 *
 * ダミーデータ（data/products.ts）とスクレイピングデータを統合して提供する。
 * 同一 id が存在する場合はスクレイピング取得データが優先される。
 *
 * 設計:
 *   - 常に利用可能なダミーデータをベースラインとして使用
 *   - スクレイピングデータは非同期で取得・マージする
 *   - スクレイピング失敗時もダミーデータで応答可能（フォールバック）
 */

// -----------------------------------------------------------------------
// スクレイピングキャッシュ（サーバープロセス内で保持）
// -----------------------------------------------------------------------

interface StoreCache {
  products: Product[];
  lastRefreshed: Date | null;
  source: "dummy_only" | "merged";
}

const cache: StoreCache = {
  products: [...DUMMY_PRODUCTS],
  lastRefreshed: null,
  source: "dummy_only",
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

    // Amazon API: 順次取得（PA-APIもレートリミットあり）
    if (isAmazonApiConfigured()) {
      const AMAZON_KEYWORDS = [
        "収納棚 シェルフ",
        "カラーボックス",
        "本棚",
        "食器棚",
        "テレビ台",
        "チェスト",
        "キャビネット",
        "デスク 学習机",
      ];
      for (const kw of AMAZON_KEYWORDS) {
        await runTask(() =>
          searchAmazonProducts({ keyword: kw, itemCount: 10 }).then((r) => ({
            products: r.products,
            label: `amazon-${kw}`,
          }))
        );
      }
    }

    if (external.length > 0) {
      const merged = new Map<string, Product>();
      for (const p of DUMMY_PRODUCTS) merged.set(p.id, p);
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
  dummy: number;
  scraped: number;
  source: string;
  lastRefreshed: string | null;
} {
  const dummyIds = new Set(DUMMY_PRODUCTS.map((p) => p.id));
  const dummyCount = cache.products.filter((p) => dummyIds.has(p.id)).length;
  const scrapedCount = cache.products.length - dummyCount;

  return {
    total: cache.products.length,
    dummy: dummyCount,
    scraped: scrapedCount,
    source: cache.source,
    lastRefreshed: cache.lastRefreshed?.toISOString() ?? null,
  };
}
