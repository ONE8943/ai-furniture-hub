/**
 * 汎用アフィリエイトアダプター（フォールバック）
 * プラットフォームが特定できない場合に使用
 */

export function buildGenericAffiliateUrl(
  baseUrl: string,
  affiliateId: string,
  utmSource: string,
  utmMedium: string
): string {
  const url = new URL(baseUrl);
  url.searchParams.set("aff_id", affiliateId);
  url.searchParams.set("ref", "mcp_hub");
  url.searchParams.set("utm_source", utmSource);
  url.searchParams.set("utm_medium", utmMedium);
  return url.toString();
}
