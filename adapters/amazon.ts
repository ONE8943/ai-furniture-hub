/**
 * Amazon アソシエイト用アフィリエイトアダプター
 */

export function buildAmazonAffiliateUrl(
  baseUrl: string,
  associateTag: string,
  utmSource: string,
  utmMedium: string
): string {
  const url = new URL(baseUrl);
  url.searchParams.set("tag", associateTag);
  url.searchParams.set("linkCode", "as2");
  url.searchParams.set("utm_source", utmSource);
  url.searchParams.set("utm_medium", utmMedium);
  return url.toString();
}

export function isAmazonUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      parsed.hostname.includes("amazon.co.jp") ||
      parsed.hostname.includes("amazon.com") ||
      parsed.hostname.includes("amzn")
    );
  } catch {
    return false;
  }
}
