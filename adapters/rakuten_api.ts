import "dotenv/config";
import axios from "axios";
import { z } from "zod";
import { Product } from "../schemas/product";

// -----------------------------------------------------------------------
// 環境変数
// -----------------------------------------------------------------------
const RAKUTEN_APP_ID = process.env["RAKUTEN_APP_ID"] ?? "";
const RAKUTEN_ACCESS_KEY = process.env["RAKUTEN_ACCESS_KEY"] ?? "";
const RAKUTEN_AFFILIATE_ID = process.env["AFFILIATE_ID_RAKUTEN"] ?? "";
const RAKUTEN_MOCK = process.env["RAKUTEN_API_MOCK"] !== "false";

const API_ENDPOINT =
  "https://openapi.rakuten.co.jp/ichibams/api/IchibaItem/Search/20260401";

// レート制限：楽天APIは短時間の大量アクセスを禁止
let lastRequestTime = 0;
const MIN_INTERVAL_MS = 1200;

// -----------------------------------------------------------------------
// 楽天APIレスポンス型 (formatVersion=2)
// -----------------------------------------------------------------------
const RakutenItemSchema = z.object({
  itemName: z.string(),
  catchcopy: z.string().optional().default(""),
  itemCode: z.string(),
  itemPrice: z.number(),
  itemCaption: z.string().optional().default(""),
  itemUrl: z.string(),
  affiliateUrl: z.string().optional().default(""),
  availability: z.number(),
  mediumImageUrls: z.union([
    z.array(z.string()),
    z.array(z.object({ imageUrl: z.string() })),
  ]).optional().default([]),
  shopName: z.string().optional().default(""),
  shopCode: z.string().optional().default(""),
  reviewCount: z.number().optional().default(0),
  reviewAverage: z.number().optional().default(0),
  genreId: z.string().or(z.number()).optional(),
});

const RakutenSearchResponseSchema = z.object({
  count: z.number(),
  page: z.number(),
  hits: z.number(),
  pageCount: z.number(),
  Items: z.array(RakutenItemSchema),
});

type RakutenItem = z.infer<typeof RakutenItemSchema>;

// -----------------------------------------------------------------------
// 寸法パーサー（商品名やキャプションから mm 寸法を推定）
// -----------------------------------------------------------------------

interface ParsedDimensions {
  width_mm: number | null;
  height_mm: number | null;
  depth_mm: number | null;
}

/**
 * 商品名・キャプションから寸法を抽出する
 *
 * 対応パターン:
 *   - 「幅41.9×奥行29.8×高さ87.8cm」(ニトリ楽天店の標準形式)
 *   - 「幅90cm」「高さ180cm」「奥行40cm」(個別表記)
 *   - 「W90×D40×H180cm」(英字ラベル)
 *   - 「約 90×40×180 cm」(ラベルなし連結)
 */
function extractDimensions(text: string): ParsedDimensions {
  const result: ParsedDimensions = { width_mm: null, height_mm: null, depth_mm: null };

  const normalized = text.normalize("NFKC");

  function toMm(value: string, unit: string): number {
    const num = parseFloat(value);
    return unit.toLowerCase() === "mm" ? Math.round(num) : Math.round(num * 10);
  }

  // パターン1（最優先）: 「幅41.9×奥行29.8×高さ87.8cm」
  // ニトリ楽天店の「外寸：幅×奥行×高さ」形式
  const jpLabeledMatch = normalized.match(
    /幅\s*(\d+(?:\.\d+)?)\s*[×xX]\s*奥行[きケ]?\s*(\d+(?:\.\d+)?)\s*[×xX]\s*高さ?\s*(\d+(?:\.\d+)?)\s*(cm|mm)/i
  );
  if (jpLabeledMatch) {
    const unit = jpLabeledMatch[4]!;
    result.width_mm = toMm(jpLabeledMatch[1]!, unit);
    result.depth_mm = toMm(jpLabeledMatch[2]!, unit);
    result.height_mm = toMm(jpLabeledMatch[3]!, unit);
    return result;
  }

  // パターン2: 「幅90cm」「高さ180cm」「奥行40cm」個別表記
  const wm = normalized.match(/(?:幅|W)\s*[:：]?\s*(?:約\s*)?(\d+(?:\.\d+)?)\s*(cm|mm)/i);
  const hm = normalized.match(/(?:高さ?|H)\s*[:：]?\s*(?:約\s*)?(\d+(?:\.\d+)?)\s*(cm|mm)/i);
  const dm = normalized.match(/(?:奥行[きケ]?|D)\s*[:：]?\s*(?:約\s*)?(\d+(?:\.\d+)?)\s*(cm|mm)/i);

  if (wm) result.width_mm = toMm(wm[1]!, wm[2]!);
  if (hm) result.height_mm = toMm(hm[1]!, hm[2]!);
  if (dm) result.depth_mm = toMm(dm[1]!, dm[2]!);

  // パターン3: 「90×40×180cm」ラベルなし連結（まだ埋まっていない場合のフォールバック）
  if (!result.width_mm || !result.height_mm || !result.depth_mm) {
    const tripleMatch = normalized.match(
      /(?:約\s*)?(\d+(?:\.\d+)?)\s*[×xX]\s*(\d+(?:\.\d+)?)\s*[×xX]\s*(\d+(?:\.\d+)?)\s*(cm|mm)?/i
    );
    if (tripleMatch) {
      const unit = tripleMatch[4] ?? "cm";
      const v1 = toMm(tripleMatch[1]!, unit);
      const v2 = toMm(tripleMatch[2]!, unit);
      const v3 = toMm(tripleMatch[3]!, unit);
      const sorted = [v1, v2, v3].sort((a, b) => a - b);
      if (!result.width_mm) result.width_mm = sorted[1]!;
      if (!result.depth_mm) result.depth_mm = sorted[0]!;
      if (!result.height_mm) result.height_mm = sorted[2]!;
    }
  }

  return result;
}

// -----------------------------------------------------------------------
// モックデータ
// -----------------------------------------------------------------------
const MOCK_RAKUTEN_PRODUCTS: Product[] = [
  {
    id: "mock-rakuten-shelf-001",
    name: "【楽天API取得】ニトリ Nクリック ボックス レギュラー2段 ホワイト",
    series_id: "n-click",
    width_mm: 420,
    height_mm: 870,
    depth_mm: 290,
    price: 4490,
    in_stock: true,
    stock_count: true,
    color: "ホワイト",
    category: "カラーボックス",
    tags: ["楽天API取得", "Nクリック", "ニトリ"],
    description: "工具不要で組み立て簡単。1段あたり耐荷重約10kg。【モックデータ】",
    url: "https://item.rakuten.co.jp/nitori/8841069-/",
    platform_urls: {
      rakuten: "https://item.rakuten.co.jp/nitori/8841069-/",
    },
  },
  {
    id: "mock-rakuten-shelf-002",
    name: "【楽天API取得】ニトリ Nクリック シェルフ ワイド5段 ホワイトウォッシュ",
    series_id: "n-click",
    width_mm: 900,
    height_mm: 1810,
    depth_mm: 290,
    price: 17990,
    in_stock: true,
    stock_count: true,
    color: "ホワイトウォッシュ",
    category: "シェルフ・棚",
    tags: ["楽天API取得", "Nクリック", "ニトリ", "ワイド"],
    description: "リビングの壁面収納に最適。可動棚あり。【モックデータ】",
    url: "https://item.rakuten.co.jp/nitori/8842174-/",
    platform_urls: {
      rakuten: "https://item.rakuten.co.jp/nitori/8842174-/",
    },
  },
  {
    id: "mock-rakuten-cabinet-001",
    name: "【楽天API取得】食器棚 ロータイプ 幅60cm ナチュラル",
    width_mm: 600,
    height_mm: 900,
    depth_mm: 400,
    price: 12990,
    in_stock: true,
    stock_count: true,
    color: "ナチュラル",
    category: "キャビネット",
    tags: ["楽天API取得", "食器棚", "ロータイプ"],
    description: "キッチンカウンター下にも置ける食器棚。【モックデータ】",
    url: "https://item.rakuten.co.jp/nitori/2160600-/",
    platform_urls: {
      rakuten: "https://item.rakuten.co.jp/nitori/2160600-/",
    },
  },
];

// -----------------------------------------------------------------------
// API呼び出し
// -----------------------------------------------------------------------

export interface RakutenSearchParams {
  keyword: string;
  genreId?: number;
  minPrice?: number;
  maxPrice?: number;
  hits?: number;
  page?: number;
  sort?: string;
  availability?: 0 | 1;
}

export interface RakutenSearchResult {
  products: Product[];
  source: "mock" | "rakuten_api";
  fetched_at: string;
  total_api_count: number;
  keyword: string;
}

async function waitForRateLimit(): Promise<void> {
  const now = Date.now();
  const elapsed = now - lastRequestTime;
  if (elapsed < MIN_INTERVAL_MS) {
    await new Promise((r) => setTimeout(r, MIN_INTERVAL_MS - elapsed));
  }
  lastRequestTime = Date.now();
}

function rakutenItemToProduct(item: RakutenItem, index: number): Product {
  const combinedText = `${item.itemName} ${item.catchcopy} ${item.itemCaption}`;
  const dims = extractDimensions(combinedText);

  return {
    id: `rakuten-${item.itemCode}-${index}`,
    name: item.itemName,
    width_mm: dims.width_mm ?? 0,
    height_mm: dims.height_mm ?? 0,
    depth_mm: dims.depth_mm ?? 0,
    price: item.itemPrice,
    in_stock: item.availability === 1,
    stock_count: item.availability === 1,
    color: undefined,
    category: "家具・収納",
    tags: ["楽天API取得", item.shopName].filter(Boolean),
    description: item.catchcopy || item.itemCaption.slice(0, 200) || undefined,
    url: item.itemUrl,
    affiliate_url: item.affiliateUrl || undefined,
    platform_urls: {
      rakuten: item.itemUrl,
    },
  };
}

/**
 * 楽天商品検索APIから商品データを取得する
 *
 * RAKUTEN_API_MOCK=true  → モックデータを即時返却（テスト/開発用）
 * RAKUTEN_API_MOCK=false → 実際に楽天APIを呼び出し
 */
export async function searchRakutenProducts(
  params: RakutenSearchParams
): Promise<RakutenSearchResult> {
  const fetchedAt = new Date().toISOString();

  if (RAKUTEN_MOCK) {
    const filtered = MOCK_RAKUTEN_PRODUCTS.filter((p) => {
      if (params.minPrice && p.price < params.minPrice) return false;
      if (params.maxPrice && p.price > params.maxPrice) return false;
      if (params.keyword) {
        const kw = params.keyword.toLowerCase();
        const haystack = `${p.name} ${p.description ?? ""} ${p.tags?.join(" ") ?? ""}`.toLowerCase();
        return haystack.includes(kw);
      }
      return true;
    });
    return {
      products: filtered,
      source: "mock",
      fetched_at: fetchedAt,
      total_api_count: filtered.length,
      keyword: params.keyword,
    };
  }

  if (!RAKUTEN_APP_ID || !RAKUTEN_ACCESS_KEY) {
    throw new Error(
      "楽天API認証情報が未設定です。.env に RAKUTEN_APP_ID と RAKUTEN_ACCESS_KEY を設定してください。"
    );
  }

  await waitForRateLimit();

  const queryParams: Record<string, string | number> = {
    applicationId: RAKUTEN_APP_ID,
    accessKey: RAKUTEN_ACCESS_KEY,
    keyword: params.keyword,
    formatVersion: 2,
    hits: params.hits ?? 20,
    page: params.page ?? 1,
    availability: params.availability ?? 1,
    imageFlag: 1,
  };

  if (RAKUTEN_AFFILIATE_ID) {
    queryParams["affiliateId"] = RAKUTEN_AFFILIATE_ID;
  }
  if (params.genreId) queryParams["genreId"] = params.genreId;
  if (params.minPrice) queryParams["minPrice"] = params.minPrice;
  if (params.maxPrice) queryParams["maxPrice"] = params.maxPrice;
  if (params.sort) queryParams["sort"] = params.sort;

  const resp = await axios.get(API_ENDPOINT, {
    params: queryParams,
    timeout: 10000,
  });

  const parsed = RakutenSearchResponseSchema.safeParse(resp.data);
  if (!parsed.success) {
    throw new Error(`楽天APIレスポンスのパースに失敗: ${JSON.stringify(parsed.error.issues)}`);
  }

  const products = parsed.data.Items.map((item, i) => rakutenItemToProduct(item, i));

  // 寸法が取得できた商品のみ（0のものは寸法不明）
  const withDimensions = products.filter(
    (p) => p.width_mm > 0 && p.height_mm > 0 && p.depth_mm > 0
  );

  return {
    products: withDimensions.length > 0 ? withDimensions : products,
    source: "rakuten_api",
    fetched_at: fetchedAt,
    total_api_count: parsed.data.count,
    keyword: params.keyword,
  };
}

/**
 * 楽天APIが利用可能かどうかを返す
 */
export function isRakutenApiConfigured(): boolean {
  if (RAKUTEN_MOCK) return true;
  return Boolean(RAKUTEN_APP_ID && RAKUTEN_ACCESS_KEY);
}
