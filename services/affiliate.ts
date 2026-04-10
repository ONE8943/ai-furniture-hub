import "dotenv/config";
import { appendFile, mkdir } from "fs/promises";
import { dirname } from "path";
import { Product } from "../schemas/product";
import { ConversionLog } from "../schemas/analytics";
import {
  buildNitoriAffiliateUrl,
  buildRakutenAffiliateUrl,
  buildAmazonAffiliateUrl,
  buildGenericAffiliateUrl,
  isNitoriUrl,
  isRakutenUrl,
  isAmazonUrl,
  PlatformKey,
} from "../adapters/index";

// -----------------------------------------------------------------------
// 環境変数（.env から読み込み）
// -----------------------------------------------------------------------
const AFFILIATE_IDS: Record<PlatformKey, string> = {
  nitori: process.env["AFFILIATE_ID_NITORI"] ?? "",
  rakuten: process.env["AFFILIATE_ID_RAKUTEN"] ?? "",
  amazon: process.env["AFFILIATE_ID_AMAZON"] ?? "",
  generic: process.env["AFFILIATE_ID_VALUECOMMERCE"] ?? "",
};
const UTM_SOURCE = process.env["UTM_SOURCE"] ?? "mcp_hub";
const UTM_MEDIUM = process.env["UTM_MEDIUM"] ?? "ai_agent";

const CONVERSION_LOG_PATH = "logs/conversions.jsonl";

// -----------------------------------------------------------------------
// プラットフォーム判定
// -----------------------------------------------------------------------
function detectPlatform(url: string): PlatformKey {
  if (isNitoriUrl(url)) return "nitori";
  if (isRakutenUrl(url)) return "rakuten";
  if (isAmazonUrl(url)) return "amazon";
  return "generic";
}

// -----------------------------------------------------------------------
// アフィリエイトURL生成（単一URL）
// -----------------------------------------------------------------------
export interface AffiliateResult {
  affiliate_url: string;
  platform: PlatformKey;
}

export function buildAffiliateUrl(baseUrl: string): AffiliateResult {
  const platform = detectPlatform(baseUrl);
  const affiliateId = AFFILIATE_IDS[platform];

  // アフィリエイトIDが未設定 → 元URLをそのまま返す（不正なIDでリンク生成しない）
  if (!affiliateId) {
    return { affiliate_url: baseUrl, platform };
  }

  let affiliateUrl: string;
  switch (platform) {
    case "nitori":
      affiliateUrl = buildNitoriAffiliateUrl(baseUrl, affiliateId, UTM_SOURCE, UTM_MEDIUM);
      break;
    case "rakuten":
      affiliateUrl = buildRakutenAffiliateUrl(baseUrl, affiliateId, UTM_SOURCE, UTM_MEDIUM);
      break;
    case "amazon":
      affiliateUrl = buildAmazonAffiliateUrl(baseUrl, affiliateId, UTM_SOURCE, UTM_MEDIUM);
      break;
    default:
      affiliateUrl = buildGenericAffiliateUrl(baseUrl, affiliateId, UTM_SOURCE, UTM_MEDIUM);
  }

  return { affiliate_url: affiliateUrl, platform };
}

// -----------------------------------------------------------------------
// 商品リストにアフィリエイトURLを一括付与
// -----------------------------------------------------------------------
export interface ProductWithAffiliate extends Product {
  affiliate_url: string;
  affiliate_platform: PlatformKey;
}

export function attachAffiliateUrls(
  products: Product[],
  intent: string
): { products: ProductWithAffiliate[]; conversionLogs: ConversionLog[] } {
  const enriched: ProductWithAffiliate[] = [];
  const conversionLogs: ConversionLog[] = [];
  const now = new Date().toISOString();

  for (const product of products) {
    // platform_urls から最優先のURLを決定
    // 優先順: nitori > rakuten > amazon > url（汎用）
    const preferredUrl =
      product.platform_urls?.["nitori"] ??
      product.platform_urls?.["rakuten"] ??
      product.platform_urls?.["amazon"] ??
      product.url;

    if (!preferredUrl) {
      // URLがない商品はそのまま返す（affiliate_urlなし）
      enriched.push({ ...product, affiliate_url: "", affiliate_platform: "generic" });
      continue;
    }

    const { affiliate_url, platform } = buildAffiliateUrl(preferredUrl);

    enriched.push({
      ...product,
      affiliate_url,
      affiliate_platform: platform,
    });

    // コンバージョンログ（アフィリエイトURL生成イベント）
    conversionLogs.push({
      timestamp: now,
      product_id: product.id,
      product_name: product.name,
      platform,
      affiliate_url,
      intent_summary: intent.slice(0, 80),
      price: product.price,
    });
  }

  return { products: enriched, conversionLogs };
}

// -----------------------------------------------------------------------
// コンバージョンログの書き込み（ノンブロッキック）
// -----------------------------------------------------------------------
async function ensureConversionLogDir(): Promise<void> {
  await mkdir(dirname(CONVERSION_LOG_PATH), { recursive: true });
}

export async function logConversions(logs: ConversionLog[]): Promise<void> {
  if (logs.length === 0) return;
  try {
    await ensureConversionLogDir();
    const lines = logs.map((l) => JSON.stringify(l)).join("\n") + "\n";
    await appendFile(CONVERSION_LOG_PATH, lines, "utf-8");
  } catch (e) {
    console.error("[Affiliate] Conversion log write failed:", e);
  }
}

// -----------------------------------------------------------------------
// プラットフォーム別の潜在報酬レート（目安）
// -----------------------------------------------------------------------
export const ESTIMATED_COMMISSION_RATES: Record<PlatformKey, number> = {
  nitori: 0.02,    // 2%（ニトリはバリューコマース経由で約2〜3%）
  rakuten: 0.015,  // 1.5%（楽天アフィリエイト標準）
  amazon: 0.04,    // 4%（家具カテゴリ）
  generic: 0.01,   // 1%（汎用）
};

/**
 * 潜在報酬を計算する（参考値）
 */
export function estimateCommission(price: number, platform: PlatformKey): number {
  return Math.floor(price * ESTIMATED_COMMISSION_RATES[platform]);
}
