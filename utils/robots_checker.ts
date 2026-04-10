import axios from "axios";

/**
 * robots.txt チェッカー＋レートリミッター
 *
 * 法的ガードレール（rules/self-evolution.md より）:
 *   - スクレイピング前に必ず robots.txt を確認する
 *   - 拒否されているサイトには手を出さない
 *   - レートリミット: 最低3秒/リクエスト（偽計業務妨害防止）
 */

// -----------------------------------------------------------------------
// robots.txt パーサー
// -----------------------------------------------------------------------

interface RobotsRule {
  userAgent: string;
  disallowed: string[];
  allowed: string[];
  crawlDelay?: number;
}

function parseRobotsTxt(content: string): RobotsRule[] {
  const rules: RobotsRule[] = [];
  let current: RobotsRule | null = null;

  for (const rawLine of content.split("\n")) {
    const line = rawLine.trim().replace(/#.*$/, "").trim();
    if (!line) continue;

    if (line.toLowerCase().startsWith("user-agent:")) {
      const ua = line.slice("user-agent:".length).trim();
      current = { userAgent: ua.toLowerCase(), disallowed: [], allowed: [] };
      rules.push(current);
    } else if (line.toLowerCase().startsWith("disallow:") && current) {
      const path = line.slice("disallow:".length).trim();
      if (path) current.disallowed.push(path);
    } else if (line.toLowerCase().startsWith("allow:") && current) {
      const path = line.slice("allow:".length).trim();
      if (path) current.allowed.push(path);
    } else if (line.toLowerCase().startsWith("crawl-delay:") && current) {
      const delay = parseInt(line.slice("crawl-delay:".length).trim(), 10);
      if (!isNaN(delay)) current.crawlDelay = delay;
    }
  }

  return rules;
}

/**
 * robots.txt のルールに基づいて、URLがスクレイピング許可されているか判定する
 */
function isAllowedByRobots(rules: RobotsRule[], targetPath: string, userAgent: string): boolean {
  const ua = userAgent.toLowerCase();

  // 対象のUser-Agentに関するルールを抽出（* 含む）
  const applicable = rules.filter(
    (r) => r.userAgent === "*" || ua.includes(r.userAgent)
  );

  if (applicable.length === 0) return true; // ルールなし = 許可

  for (const rule of applicable) {
    // 明示的に allow されているパスが先にマッチすれば OK
    for (const allowed of rule.allowed) {
      if (targetPath.startsWith(allowed)) return true;
    }
    // disallow にマッチすれば NG
    for (const disallowed of rule.disallowed) {
      if (disallowed && targetPath.startsWith(disallowed)) return false;
    }
  }

  return true;
}

// -----------------------------------------------------------------------
// robots.txt キャッシュ（ドメインごとに1回だけ取得）
// -----------------------------------------------------------------------

const robotsCache = new Map<string, { rules: RobotsRule[]; fetchedAt: number }>();
const CACHE_TTL_MS = 60 * 60 * 1000; // 1時間

export async function checkRobotsTxt(
  targetUrl: string,
  userAgent: string
): Promise<{ allowed: boolean; crawlDelay?: number; reason?: string }> {
  let parsed: URL;
  try {
    parsed = new URL(targetUrl);
  } catch {
    return { allowed: false, reason: "Invalid URL" };
  }

  const origin = `${parsed.protocol}//${parsed.hostname}`;
  const robotsUrl = `${origin}/robots.txt`;
  const targetPath = parsed.pathname + parsed.search;

  // キャッシュ確認
  const cached = robotsCache.get(origin);
  const now = Date.now();

  let rules: RobotsRule[];

  if (cached && now - cached.fetchedAt < CACHE_TTL_MS) {
    rules = cached.rules;
  } else {
    try {
      const resp = await axios.get<string>(robotsUrl, {
        timeout: 5000,
        headers: { "User-Agent": userAgent },
        responseType: "text",
      });
      rules = parseRobotsTxt(resp.data);
      robotsCache.set(origin, { rules, fetchedAt: now });
    } catch {
      // robots.txt が存在しない or 取得失敗 → 許可とみなす（業界慣行）
      return { allowed: true, reason: "robots.txt not found (assuming allowed)" };
    }
  }

  const allowed = isAllowedByRobots(rules, targetPath, userAgent);
  const crawlDelay = rules.find((r) => r.userAgent === "*")?.crawlDelay;

  return {
    allowed,
    ...(crawlDelay && { crawlDelay }),
    ...(!allowed && { reason: `Blocked by robots.txt: ${targetPath}` }),
  };
}

// -----------------------------------------------------------------------
// レートリミッター（ドメインごとのウェイト管理）
// -----------------------------------------------------------------------

const lastRequestTime = new Map<string, number>();

/**
 * ドメインごとに最低 delayMs ミリ秒の間隔を保証してから resolve する
 * デフォルト: SCRAPE_DELAY_MS 環境変数 or 3000ms
 */
export async function waitForRateLimit(
  targetUrl: string,
  delayMs?: number
): Promise<void> {
  const minDelay = delayMs ?? parseInt(process.env["SCRAPE_DELAY_MS"] ?? "3000", 10);

  let domain: string;
  try {
    domain = new URL(targetUrl).hostname;
  } catch {
    domain = targetUrl;
  }

  const last = lastRequestTime.get(domain) ?? 0;
  const now = Date.now();
  const elapsed = now - last;

  if (elapsed < minDelay) {
    await new Promise((resolve) => setTimeout(resolve, minDelay - elapsed));
  }

  lastRequestTime.set(domain, Date.now());
}

/**
 * robots.txt チェック → レートリミット → スクレイピング許可判定
 * スクレイピング前に必ずこの関数を呼ぶこと
 */
export async function guardedRequest(
  targetUrl: string,
  userAgent: string
): Promise<{ allowed: boolean; reason?: string }> {
  const robotsResult = await checkRobotsTxt(targetUrl, userAgent);

  if (!robotsResult.allowed) {
    return { allowed: false, reason: robotsResult.reason };
  }

  // robots.txtにCrawl-Delayが指定されていればそちらを優先
  const delay = robotsResult.crawlDelay
    ? robotsResult.crawlDelay * 1000
    : undefined;

  await waitForRateLimit(targetUrl, delay);

  return { allowed: true };
}
