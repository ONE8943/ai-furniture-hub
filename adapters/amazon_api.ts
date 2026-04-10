import "dotenv/config";
import * as crypto from "node:crypto";
import axios from "axios";
import { z } from "zod";
import { Product } from "../schemas/product";
import { extractDimensions } from "./rakuten_api";

// -----------------------------------------------------------------------
// 環境変数
// -----------------------------------------------------------------------
const AMAZON_ACCESS_KEY = process.env["AMAZON_PA_ACCESS_KEY"] ?? "";
const AMAZON_SECRET_KEY = process.env["AMAZON_PA_SECRET_KEY"] ?? "";
const AMAZON_PARTNER_TAG = process.env["AFFILIATE_ID_AMAZON"] ?? "";
const AMAZON_MOCK = process.env["AMAZON_API_MOCK"] !== "false";

const HOST = "webservices.amazon.co.jp";
const REGION = "us-west-2";
const SERVICE = "ProductAdvertisingAPI";
const ENDPOINT = `https://${HOST}/paapi5/searchitems`;

// レート制限: PA-API は1秒1リクエスト程度が安全
let lastRequestTime = 0;
const MIN_INTERVAL_MS = 1100;

// -----------------------------------------------------------------------
// AWS Signature V4 (PA-API 5.0 認証)
// -----------------------------------------------------------------------

function hmacSha256(key: Buffer | string, data: string): Buffer {
  return crypto.createHmac("sha256", key).update(data, "utf8").digest();
}

function sha256Hex(data: string): string {
  return crypto.createHash("sha256").update(data, "utf8").digest("hex");
}

function getSignatureKey(
  secretKey: string,
  dateStamp: string,
  region: string,
  service: string
): Buffer {
  const kDate = hmacSha256(`AWS4${secretKey}`, dateStamp);
  const kRegion = hmacSha256(kDate, region);
  const kService = hmacSha256(kRegion, service);
  return hmacSha256(kService, "aws4_request");
}

function signRequest(payload: string): {
  headers: Record<string, string>;
} {
  const now = new Date();
  const amzDate = now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const dateStamp = amzDate.slice(0, 8);

  const canonicalUri = "/paapi5/searchitems";
  const canonicalQuerystring = "";
  const payloadHash = sha256Hex(payload);

  const headers: Record<string, string> = {
    "content-encoding": "amz-1.0",
    "content-type": "application/json; charset=utf-8",
    host: HOST,
    "x-amz-date": amzDate,
    "x-amz-target": "com.amazon.paapi5.v1.ProductAdvertisingAPIv1.SearchItems",
  };

  const signedHeaders = Object.keys(headers).sort().join(";");
  const canonicalHeaders = Object.keys(headers)
    .sort()
    .map((k) => `${k}:${headers[k]}\n`)
    .join("");

  const canonicalRequest = [
    "POST",
    canonicalUri,
    canonicalQuerystring,
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n");

  const credentialScope = `${dateStamp}/${REGION}/${SERVICE}/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    sha256Hex(canonicalRequest),
  ].join("\n");

  const signingKey = getSignatureKey(AMAZON_SECRET_KEY, dateStamp, REGION, SERVICE);
  const signature = hmacSha256(signingKey, stringToSign).toString("hex");

  const authorization =
    `AWS4-HMAC-SHA256 Credential=${AMAZON_ACCESS_KEY}/${credentialScope}, ` +
    `SignedHeaders=${signedHeaders}, Signature=${signature}`;

  return {
    headers: {
      ...headers,
      Authorization: authorization,
    },
  };
}

// -----------------------------------------------------------------------
// レスポンス型
// -----------------------------------------------------------------------
const AmazonItemSchema = z.object({
  ASIN: z.string(),
  DetailPageURL: z.string(),
  ItemInfo: z
    .object({
      Title: z.object({ DisplayValue: z.string() }).optional(),
      Features: z.object({ DisplayValues: z.array(z.string()) }).optional(),
      ProductInfo: z
        .object({
          ItemDimensions: z
            .object({
              Width: z.object({ DisplayValue: z.number(), Unit: z.string() }).optional(),
              Height: z.object({ DisplayValue: z.number(), Unit: z.string() }).optional(),
              Length: z.object({ DisplayValue: z.number(), Unit: z.string() }).optional(),
            })
            .optional(),
        })
        .optional(),
      Classifications: z
        .object({
          Binding: z.object({ DisplayValue: z.string() }).optional(),
        })
        .optional(),
    })
    .optional(),
  Offers: z
    .object({
      Listings: z
        .array(
          z.object({
            Price: z
              .object({
                DisplayAmount: z.string().optional(),
                Amount: z.number().optional(),
              })
              .optional(),
            Availability: z
              .object({ Message: z.string().optional() })
              .optional(),
          })
        )
        .optional(),
    })
    .optional(),
  Images: z
    .object({
      Primary: z
        .object({
          Medium: z.object({ URL: z.string() }).optional(),
        })
        .optional(),
    })
    .optional(),
});

type AmazonItem = z.infer<typeof AmazonItemSchema>;

const AmazonSearchResponseSchema = z.object({
  SearchResult: z.object({
    TotalResultCount: z.number(),
    Items: z.array(AmazonItemSchema),
  }),
});

// -----------------------------------------------------------------------
// モックデータ
// -----------------------------------------------------------------------
const MOCK_AMAZON_PRODUCTS: Product[] = [
  {
    id: "mock-amazon-shelf-001",
    name: "【Amazon】アイリスオーヤマ カラーボックス 3段 幅41.5cm",
    width_mm: 415,
    height_mm: 880,
    depth_mm: 290,
    price: 1780,
    in_stock: true,
    stock_count: true,
    color: "ホワイト",
    category: "カラーボックス",
    tags: ["Amazon", "アイリスオーヤマ"],
    description: "A4サイズ対応。3段カラーボックス。",
    url: "https://www.amazon.co.jp/dp/B00K6PMXUY",
    platform_urls: { amazon: "https://www.amazon.co.jp/dp/B00K6PMXUY" },
  },
  {
    id: "mock-amazon-rack-001",
    name: "【Amazon】山善 収納ラック 幅60cm 4段 ウォルナット",
    width_mm: 600,
    height_mm: 1200,
    depth_mm: 300,
    price: 4980,
    in_stock: true,
    stock_count: true,
    color: "ウォルナット",
    category: "ラック",
    tags: ["Amazon", "山善", "YAMAZEN"],
    description: "リビング・書斎に。オープン4段ラック。",
    url: "https://www.amazon.co.jp/dp/B07EXAMPLE1",
    platform_urls: { amazon: "https://www.amazon.co.jp/dp/B07EXAMPLE1" },
  },
  {
    id: "mock-amazon-cabinet-001",
    name: "【Amazon】不二貿易 食器棚 幅60cm ナチュラル",
    width_mm: 600,
    height_mm: 1200,
    depth_mm: 400,
    price: 8980,
    in_stock: true,
    stock_count: true,
    color: "ナチュラル",
    category: "キャビネット",
    tags: ["Amazon", "不二貿易"],
    description: "ガラス扉付き。キッチン・ダイニングに。",
    url: "https://www.amazon.co.jp/dp/B08EXAMPLE2",
    platform_urls: { amazon: "https://www.amazon.co.jp/dp/B08EXAMPLE2" },
  },
];

// -----------------------------------------------------------------------
// 変換・API呼び出し
// -----------------------------------------------------------------------

function amazonDimToMm(value: number, unit: string): number {
  const u = unit.toLowerCase();
  if (u === "ミリメートル" || u === "millimeters" || u === "mm") return Math.round(value);
  if (u === "センチメートル" || u === "centimeters" || u === "cm") return Math.round(value * 10);
  if (u === "メートル" || u === "meters" || u === "m") return Math.round(value * 1000);
  if (u === "インチ" || u === "inches" || u === "in") return Math.round(value * 25.4);
  return Math.round(value * 10);
}

function amazonItemToProduct(item: AmazonItem): Product {
  const title = item.ItemInfo?.Title?.DisplayValue ?? "不明な商品";
  const features = item.ItemInfo?.Features?.DisplayValues?.join(" ") ?? "";
  const combinedText = `${title} ${features}`;

  const apiDims = item.ItemInfo?.ProductInfo?.ItemDimensions;
  let width_mm = 0;
  let height_mm = 0;
  let depth_mm = 0;

  if (apiDims) {
    if (apiDims.Width) width_mm = amazonDimToMm(apiDims.Width.DisplayValue, apiDims.Width.Unit);
    if (apiDims.Height) height_mm = amazonDimToMm(apiDims.Height.DisplayValue, apiDims.Height.Unit);
    if (apiDims.Length) depth_mm = amazonDimToMm(apiDims.Length.DisplayValue, apiDims.Length.Unit);
  }

  // APIの寸法情報が不完全な場合、テキストからパース
  if (width_mm === 0 || height_mm === 0 || depth_mm === 0) {
    const parsed = extractDimensions(combinedText);
    if (!width_mm && parsed.width_mm) width_mm = parsed.width_mm;
    if (!height_mm && parsed.height_mm) height_mm = parsed.height_mm;
    if (!depth_mm && parsed.depth_mm) depth_mm = parsed.depth_mm;
  }

  const listing = item.Offers?.Listings?.[0];
  const price = listing?.Price?.Amount ?? 0;
  const inStock = listing?.Availability?.Message !== "在庫切れ";

  return {
    id: `amazon-${item.ASIN}`,
    name: title,
    width_mm,
    height_mm,
    depth_mm,
    price: Math.round(price),
    in_stock: inStock,
    stock_count: inStock,
    color: undefined,
    category: item.ItemInfo?.Classifications?.Binding?.DisplayValue ?? "家具・収納",
    tags: ["Amazon"],
    description: features.slice(0, 200) || undefined,
    url: item.DetailPageURL,
    platform_urls: { amazon: item.DetailPageURL },
  };
}

export interface AmazonSearchParams {
  keyword: string;
  minPrice?: number;
  maxPrice?: number;
  itemCount?: number;
  itemPage?: number;
  sortBy?: string;
}

export interface AmazonSearchResult {
  products: Product[];
  source: "mock" | "amazon_api";
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

export async function searchAmazonProducts(
  params: AmazonSearchParams
): Promise<AmazonSearchResult> {
  const fetchedAt = new Date().toISOString();

  if (AMAZON_MOCK) {
    const filtered = MOCK_AMAZON_PRODUCTS.filter((p) => {
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

  if (!AMAZON_ACCESS_KEY || !AMAZON_SECRET_KEY || !AMAZON_PARTNER_TAG) {
    process.stderr.write(
      "[AmazonAPI] PA-API認証情報が未設定です。AMAZON_PA_ACCESS_KEY, AMAZON_PA_SECRET_KEY, AFFILIATE_ID_AMAZON を設定してください。モックにフォールバックします。\n"
    );
    return {
      products: MOCK_AMAZON_PRODUCTS,
      source: "mock",
      fetched_at: fetchedAt,
      total_api_count: MOCK_AMAZON_PRODUCTS.length,
      keyword: params.keyword,
    };
  }

  await waitForRateLimit();

  const payload: Record<string, unknown> = {
    PartnerTag: AMAZON_PARTNER_TAG,
    PartnerType: "Associates",
    Keywords: params.keyword,
    SearchIndex: "HomeAndKitchen",
    ItemCount: params.itemCount ?? 10,
    Resources: [
      "ItemInfo.Title",
      "ItemInfo.Features",
      "ItemInfo.ProductInfo",
      "ItemInfo.Classifications",
      "Offers.Listings.Price",
      "Offers.Listings.Availability.Message",
      "Images.Primary.Medium",
    ],
    Marketplace: "www.amazon.co.jp",
  };

  if (params.minPrice) payload["MinPrice"] = params.minPrice;
  if (params.maxPrice) payload["MaxPrice"] = params.maxPrice;
  if (params.itemPage) payload["ItemPage"] = params.itemPage;
  if (params.sortBy) payload["SortBy"] = params.sortBy;

  const body = JSON.stringify(payload);
  const { headers } = signRequest(body);

  try {
    const resp = await axios.post(ENDPOINT, body, {
      headers,
      timeout: 10000,
    });

    const parsed = AmazonSearchResponseSchema.safeParse(resp.data);
    if (!parsed.success) {
      throw new Error(`PA-APIレスポンスのパースに失敗: ${JSON.stringify(parsed.error.issues)}`);
    }

    const products = parsed.data.SearchResult.Items.map(amazonItemToProduct);
    return {
      products,
      source: "amazon_api",
      fetched_at: fetchedAt,
      total_api_count: parsed.data.SearchResult.TotalResultCount,
      keyword: params.keyword,
    };
  } catch (e: any) {
    const status = e?.response?.status;
    process.stderr.write(
      `[AmazonAPI] リクエスト失敗 (HTTP ${status ?? "unknown"}): ${e.message}。モックにフォールバック。\n`
    );
    return {
      products: MOCK_AMAZON_PRODUCTS,
      source: "mock",
      fetched_at: fetchedAt,
      total_api_count: MOCK_AMAZON_PRODUCTS.length,
      keyword: params.keyword,
    };
  }
}

export function isAmazonApiConfigured(): boolean {
  if (AMAZON_MOCK) return true;
  return Boolean(AMAZON_ACCESS_KEY && AMAZON_SECRET_KEY && AMAZON_PARTNER_TAG);
}
