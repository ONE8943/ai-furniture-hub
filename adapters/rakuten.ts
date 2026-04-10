/**
 * 楽天市場用アフィリエイトアダプター
 * 楽天アフィリエイト（hb.afl.rakuten.co.jp/ichiba/）形式でリンクを生成
 *
 * 正式URL形式:
 *   https://hb.afl.rakuten.co.jp/ichiba/{AFFILIATE_ID}/?pc={encodedUrl}
 *
 * AFFILIATE_ID は「52b5b3f6.d649457f.52b5b3f7.c31ecd10」のようなドット区切り4パート形式
 */

export function buildRakutenAffiliateUrl(
  baseUrl: string,
  affiliateId: string,
  utmSource: string,
  utmMedium: string
): string {
  const encodedUrl = encodeURIComponent(baseUrl);
  const affiliateBase = `https://hb.afl.rakuten.co.jp/ichiba/${affiliateId}/`;
  const params = new URLSearchParams({
    pc: encodedUrl,
    m: encodedUrl,
    utm_source: utmSource,
    utm_medium: utmMedium,
    utm_campaign: "mcp_hub_affiliate",
  });
  return `${affiliateBase}?${params.toString()}`;
}

export function isRakutenUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      parsed.hostname.includes("rakuten") ||
      parsed.hostname.includes("item.rakuten")
    );
  } catch {
    return false;
  }
}
