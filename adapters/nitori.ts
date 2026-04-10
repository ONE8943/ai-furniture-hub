/**
 * ニトリ公式サイト用アフィリエイトアダプター
 * バリューコマース経由のアフィリエイトリンク生成
 */

export function buildNitoriAffiliateUrl(
  baseUrl: string,
  affiliateId: string,
  utmSource: string,
  utmMedium: string
): string {
  const url = new URL(baseUrl);
  url.searchParams.set("uid", affiliateId);
  url.searchParams.set("utm_source", utmSource);
  url.searchParams.set("utm_medium", utmMedium);
  url.searchParams.set("utm_campaign", "mcp_hub_affiliate");
  return url.toString();
}

export function isNitoriUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      parsed.hostname.includes("nitori") ||
      parsed.hostname.includes("nitori-net")
    );
  } catch {
    return false;
  }
}
