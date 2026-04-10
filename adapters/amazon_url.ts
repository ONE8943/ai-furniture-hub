/**
 * Amazon アフィリエイト検索URL生成アダプター
 *
 * PA-API が利用不可（売上実績 10件未達）のため、
 * Amazon検索結果ページへのアフィリエイトリンクを直接生成する。
 *
 * PA-API が利用可能になったら adapters/amazon_api.ts に切り替える。
 */
import "dotenv/config";

const PARTNER_TAG = process.env["AFFILIATE_ID_AMAZON"] ?? "";
const BASE_URL = "https://www.amazon.co.jp";

export interface AmazonSearchUrlParams {
  keyword: string;
  price_min?: number;
  price_max?: number;
  sort?: "price-asc-rank" | "price-desc-rank" | "review-rank" | "date-desc-rank";
}

export interface AmazonSearchUrlResult {
  search_url: string;
  affiliate_url: string;
  keyword: string;
  partner_tag: string;
  note: string;
}

/**
 * Amazon 検索結果ページのURLを生成（アフィリエイトID付き）
 *
 * PA-API不要。ユーザーがこのURLから購入すれば売上実績にカウントされる。
 */
export function buildAmazonSearchUrl(params: AmazonSearchUrlParams): AmazonSearchUrlResult {
  const url = new URL("/s", BASE_URL);
  url.searchParams.set("k", params.keyword);
  url.searchParams.set("i", "kitchen");

  if (params.price_min != null || params.price_max != null) {
    const low = params.price_min ?? 0;
    const high = params.price_max ?? "";
    url.searchParams.set("rh", `p_36:${low}-${high}`);
  }

  if (params.sort) {
    url.searchParams.set("s", params.sort);
  }

  if (PARTNER_TAG) {
    url.searchParams.set("tag", PARTNER_TAG);
    url.searchParams.set("linkCode", "as2");
  }

  const rawUrl = url.toString();
  const affiliateUrl = PARTNER_TAG
    ? rawUrl
    : `${rawUrl}${rawUrl.includes("?") ? "&" : "?"}tag=YOUR_TAG_HERE`;

  return {
    search_url: rawUrl,
    affiliate_url: affiliateUrl,
    keyword: params.keyword,
    partner_tag: PARTNER_TAG || "(未設定)",
    note: PARTNER_TAG
      ? "このURLからの購入でアフィリエイト報酬が発生します。PA-API解禁に向けた売上実績にもカウントされます。"
      : "AFFILIATE_ID_AMAZON が未設定です。.env に設定してください。",
  };
}

/**
 * 単一商品のアフィリエイトURL（ASIN指定）
 */
export function buildAmazonProductUrl(asin: string): string {
  const url = new URL(`/dp/${asin}`, BASE_URL);
  if (PARTNER_TAG) {
    url.searchParams.set("tag", PARTNER_TAG);
    url.searchParams.set("linkCode", "as2");
  }
  return url.toString();
}

/**
 * PA-API が利用可能かどうか
 * 現時点では常に false（売上実績10件到達後に amazon_api.ts に切り替え）
 */
export function isAmazonPaApiAvailable(): boolean {
  return false;
}
