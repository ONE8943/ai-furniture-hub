import "dotenv/config";
import { randomUUID } from "node:crypto";
import axios from "axios";
import * as cheerio from "cheerio";
import { Product } from "../schemas/product";
import { parseDimensionString, parsePriceJpy } from "../utils/unit_converter";
import { guardedRequest } from "../utils/robots_checker";

// -----------------------------------------------------------------------
// 設定
// -----------------------------------------------------------------------
const SCRAPE_MOCK = process.env["SCRAPE_MOCK"] !== "false"; // デフォルトはモック
const USER_AGENT =
  process.env["SCRAPE_USER_AGENT"] ??
  "Mozilla/5.0 (compatible; MCPHubBot/1.0; +https://example.com/bot)";

// ニトリの実際のURL（本番使用時）
// 注意: ニトリのToSを確認し、事前に許可を得ること
const NITORI_SEARCH_BASE = "https://www.nitori-net.jp/store/ja/ec/Search";
const NITORI_BASE = "https://www.nitori-net.jp";

// -----------------------------------------------------------------------
// CSS セレクター（ニトリ商品ページ用）
// ⚠️ 実際のページ構造に応じて調整が必要
// ページを検証して確認すること（DevTools → 要素を選択）
// -----------------------------------------------------------------------
const SELECTORS = {
  // 検索結果ページ
  productList: ".js-search-item-list .item",          // 商品リストのアイテム
  productName: ".item-name",                           // 商品名
  productPrice: ".item-price .price",                  // 価格
  productUrl: "a.item-image",                          // 商品リンク
  productImage: "img.item-image",                      // 商品画像

  // 商品詳細ページ
  detailName: "h1.item-name",
  detailPrice: ".item-price .price",
  detailSpecTable: ".item-spec tr",
  detailStock: ".js-item-stock",
  detailCategory: ".breadcrumb li:last-child",
  detailDescription: ".item-description",
  detailColor: ".color-name.selected, .item-color .selected",
  detailSizeAlt: ".spec-table .size",
};

// -----------------------------------------------------------------------
// モックデータ（SCRAPE_MOCK=true の場合に返す）
// テスト環境でニトリのサーバーに負荷をかけないための仕組み
// -----------------------------------------------------------------------
const MOCK_SCRAPED_PRODUCTS: Product[] = [
  {
    id: "mock-nitori-shelf-001",
    name: "【スクレイピング取得】Nクリック シェルフ 幅90cm",
    series_id: "n-click",
    width_mm: 900,
    height_mm: 1790,
    depth_mm: 290,
    inner_dimensions: { width_mm: 876, height_mm: 270, depth_mm: 265 },
    price: 16990,
    in_stock: true,
    stock_count: true,
    color: "ホワイト",
    material: "パーティクルボード（プリント紙化粧）",
    category: "シェルフ・棚",
    tags: ["Nクリック", "組み立て式", "ワイド", "スクレイピング取得"],
    description:
      "幅90cmの大型シェルフ。リビングや寝室の壁面収納に。【このデータはモック取得です】",
    url: "https://www.nitori-net.jp/store/ja/ec/NitroBag/8209679s",
    platform_urls: {
      nitori: "https://www.nitori-net.jp/store/ja/ec/NitroBag/8209679s",
    },
  },
  {
    id: "mock-nitori-box-001",
    name: "【スクレイピング取得】カラーボックス 4段 幅42cm",
    series_id: "color-box",
    width_mm: 420,
    height_mm: 1420,
    depth_mm: 290,
    inner_dimensions: { width_mm: 393, height_mm: 330, depth_mm: 265 },
    price: 3490,
    in_stock: true,
    stock_count: true,
    color: "ホワイト",
    material: "MDF（プリント紙化粧）",
    category: "カラーボックス",
    tags: ["カラーボックス", "4段", "低価格", "スクレイピング取得"],
    description:
      "4段カラーボックス。A4ファイルが収まる奥行。【このデータはモック取得です】",
    url: "https://www.nitori-net.jp/store/ja/ec/ColorBox/8204179s",
    platform_urls: {
      nitori: "https://www.nitori-net.jp/store/ja/ec/ColorBox/8204179s",
    },
  },
];

// -----------------------------------------------------------------------
// 実際のスクレイピング（SCRAPE_MOCK=false の場合）
// -----------------------------------------------------------------------

export interface ScrapedProduct {
  name: string;
  price: number | null;
  url: string;
  width_mm: number | null;
  height_mm: number | null;
  depth_mm: number | null;
  in_stock: boolean;
  color: string | null;
  description: string | null;
  category: string | null;
  material: string | null;
}

/**
 * ニトリ検索結果ページから商品一覧を取得する（実際のスクレイピング）
 * robots.txt チェックとレートリミットを適用済み
 *
 * @param keyword 検索キーワード（例: "シェルフ", "カラーボックス"）
 * @param maxItems 最大取得件数
 */
async function scrapeNitoriSearch(
  keyword: string,
  maxItems = 10
): Promise<ScrapedProduct[]> {
  const searchUrl = `${NITORI_SEARCH_BASE}?q=${encodeURIComponent(keyword)}&limit=${maxItems}`;

  // ① robots.txt チェック + レートリミット
  const guard = await guardedRequest(searchUrl, USER_AGENT);
  if (!guard.allowed) {
    throw new Error(`robots.txt によりスクレイピング禁止: ${guard.reason}`);
  }

  // ② HTTPリクエスト
  const resp = await axios.get<string>(searchUrl, {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "text/html,application/xhtml+xml",
      "Accept-Language": "ja,en-US;q=0.9",
      Referer: NITORI_BASE,
    },
    timeout: 10000,
    responseType: "text",
  });

  // ③ HTML解析
  const $ = cheerio.load(resp.data);
  const results: ScrapedProduct[] = [];

  $(SELECTORS.productList).each((_, el) => {
    if (results.length >= maxItems) return false; // break

    const name = $(el).find(SELECTORS.productName).text().trim();
    const priceText = $(el).find(SELECTORS.productPrice).text().trim();
    const relativeUrl = $(el).find(SELECTORS.productUrl).attr("href") ?? "";
    const productUrl = relativeUrl.startsWith("http")
      ? relativeUrl
      : `${NITORI_BASE}${relativeUrl}`;

    if (!name || !productUrl) return;

    results.push({
      name,
      price: parsePriceJpy(priceText),
      url: productUrl,
      // 寸法は詳細ページから取得（以下は検索結果では取れないことが多い）
      width_mm: null,
      height_mm: null,
      depth_mm: null,
      in_stock: true, // 検索結果に表示されていれば在庫ありとみなす
      color: null,
      description: null,
      category: null,
      material: null,
    });
  });

  return results;
}

/**
 * 商品詳細ページから完全なスペックを取得する
 */
async function scrapeNitoriProductDetail(
  productUrl: string
): Promise<Partial<ScrapedProduct>> {
  const guard = await guardedRequest(productUrl, USER_AGENT);
  if (!guard.allowed) {
    throw new Error(`robots.txt によりスクレイピング禁止: ${guard.reason}`);
  }

  const resp = await axios.get<string>(productUrl, {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "text/html",
      "Accept-Language": "ja",
    },
    timeout: 10000,
    responseType: "text",
  });

  const $ = cheerio.load(resp.data);

  const priceText = $(SELECTORS.detailPrice).first().text().trim();

  // spec テーブルをループして key-value を収集（:contains を使わない）
  let dimensionText = "";
  let materialText: string | null = null;
  $(SELECTORS.detailSpecTable).each((_, tr) => {
    const cells = $(tr).find("td, th");
    if (cells.length < 2) return;
    const key = $(cells[0]).text().trim();
    const val = $(cells[1]).text().trim();
    if (key.includes("幅") || key.includes("サイズ") || key.includes("寸法")) {
      dimensionText = val;
    }
    if (key.includes("材質") || key.includes("素材")) {
      materialText = val;
    }
  });
  // フォールバック: 別セレクターで寸法を取得
  if (!dimensionText) {
    dimensionText = $(SELECTORS.detailSizeAlt).first().text().trim();
  }

  const parsed = dimensionText ? parseDimensionString(dimensionText) : null;

  // 在庫判定
  const stockEl = $(SELECTORS.detailStock).first().text().trim();
  const inStock = stockEl ? !stockEl.includes("在庫なし") && !stockEl.includes("品切れ") : true;

  return {
    price: parsePriceJpy(priceText),
    width_mm: parsed?.width_mm ?? null,
    height_mm: parsed?.height_mm ?? null,
    depth_mm: parsed?.depth_mm ?? null,
    in_stock: inStock,
    color: $(SELECTORS.detailColor).first().text().trim() || null,
    description: $(SELECTORS.detailDescription).first().text().trim().slice(0, 200) || null,
    category: $(SELECTORS.detailCategory).first().text().trim() || null,
    material: materialText,
  };
}

// -----------------------------------------------------------------------
// 公開API（モックと実スクレイピングの切り替え）
// -----------------------------------------------------------------------

export interface NitoriScrapeResult {
  products: Product[];
  source: "mock" | "scraped";
  scraped_at: string;
  keyword: string;
}

/**
 * ニトリから商品データを取得する（モック or 実スクレイピング）
 *
 * SCRAPE_MOCK=true  → モックデータを即時返却（テスト用）
 * SCRAPE_MOCK=false → 実際にニトリのサイトをスクレイピング
 */
export async function fetchNitoriProducts(
  keyword = "シェルフ",
  maxItems = 5
): Promise<NitoriScrapeResult> {
  const scrapedAt = new Date().toISOString();

  // ── モックモード ──
  if (SCRAPE_MOCK) {
    return {
      products: MOCK_SCRAPED_PRODUCTS.slice(0, maxItems),
      source: "mock",
      scraped_at: scrapedAt,
      keyword,
    };
  }

  // ── 実スクレイピングモード ──
  const rawResults = await scrapeNitoriSearch(keyword, maxItems);
  const products: Product[] = [];

  for (const raw of rawResults) {
    // 詳細ページも取得して寸法を補完（レートリミット適用済み）
    let detail: Partial<ScrapedProduct> = {};
    if (raw.url && (raw.width_mm === null || raw.height_mm === null)) {
      try {
        detail = await scrapeNitoriProductDetail(raw.url);
      } catch (e) {
        console.error(`[NitoriScraper] 詳細取得失敗: ${raw.url}`, e);
      }
    }

    const merged = { ...raw, ...detail };

    // スキーマに適合するか確認（必須フィールドが揃っている場合のみ追加）
    if (
      merged.name &&
      merged.price &&
      merged.width_mm &&
      merged.height_mm &&
      merged.depth_mm
    ) {
      products.push({
        id: randomUUID(),
        name: merged.name,
        width_mm: merged.width_mm,
        height_mm: merged.height_mm,
        depth_mm: merged.depth_mm,
        price: merged.price,
        in_stock: merged.in_stock ?? true,
        stock_count: true,
        color: merged.color ?? undefined,
        material: merged.material ?? undefined,
        category: merged.category ?? "シェルフ・棚",
        tags: ["スクレイピング取得", keyword],
        description: merged.description ?? undefined,
        url: merged.url,
        platform_urls: { nitori: merged.url },
      });
    }
  }

  return { products, source: "scraped", scraped_at: scrapedAt, keyword };
}
