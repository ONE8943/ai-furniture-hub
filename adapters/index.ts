export { buildNitoriAffiliateUrl, isNitoriUrl } from "./nitori";
export { buildRakutenAffiliateUrl, isRakutenUrl } from "./rakuten";
export { buildAmazonAffiliateUrl, isAmazonUrl } from "./amazon";
export { buildGenericAffiliateUrl } from "./generic";

import { isNitoriUrl } from "./nitori";
import { isRakutenUrl } from "./rakuten";
import { isAmazonUrl } from "./amazon";

export type PlatformKey = "nitori" | "rakuten" | "amazon" | "generic";

/**
 * URLからプラットフォームを判定する
 */
export function detectPlatform(url: string): PlatformKey {
  if (isNitoriUrl(url)) return "nitori";
  if (isRakutenUrl(url)) return "rakuten";
  if (isAmazonUrl(url)) return "amazon";
  return "generic";
}
