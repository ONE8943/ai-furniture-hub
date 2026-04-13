/**
 * インメモリ レート制限
 *
 * IPアドレスまたはAPIキーに基づいて月間クエリ数を制限する。
 * 本番運用ではRedis等に置換可能だが、初期はインメモリで十分。
 */

export type ApiTier = "anonymous" | "free" | "pro";

export interface TierConfig {
  monthlyLimit: number;
  includesCuratedDimensions: boolean;
  label: string;
}

export const TIER_CONFIGS: Record<ApiTier, TierConfig> = {
  anonymous: { monthlyLimit: 100, includesCuratedDimensions: false, label: "Anonymous (no key)" },
  free:      { monthlyLimit: 500, includesCuratedDimensions: true,  label: "Free (API key)" },
  pro:       { monthlyLimit: Infinity, includesCuratedDimensions: true, label: "Pro" },
};

interface UsageBucket {
  count: number;
  resetAt: number; // epoch ms
}

const usageByIp = new Map<string, UsageBucket>();
const usageByKey = new Map<string, UsageBucket>();

function getMonthEnd(): number {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + 1, 1).getTime();
}

function getBucket(map: Map<string, UsageBucket>, id: string): UsageBucket {
  const now = Date.now();
  let bucket = map.get(id);
  if (!bucket || now >= bucket.resetAt) {
    bucket = { count: 0, resetAt: getMonthEnd() };
    map.set(id, bucket);
  }
  return bucket;
}

export interface RateLimitResult {
  allowed: boolean;
  tier: ApiTier;
  remaining: number;
  limit: number;
  resetAt: number;
}

export function checkRateLimit(ip: string, apiKey?: string, tier?: ApiTier): RateLimitResult {
  const resolvedTier = tier ?? "anonymous";
  const config = TIER_CONFIGS[resolvedTier];

  if (config.monthlyLimit === Infinity) {
    return { allowed: true, tier: resolvedTier, remaining: Infinity, limit: Infinity, resetAt: 0 };
  }

  const trackingId = apiKey ?? ip;
  const map = apiKey ? usageByKey : usageByIp;
  const bucket = getBucket(map, trackingId);

  const remaining = Math.max(0, config.monthlyLimit - bucket.count);
  if (bucket.count >= config.monthlyLimit) {
    return { allowed: false, tier: resolvedTier, remaining: 0, limit: config.monthlyLimit, resetAt: bucket.resetAt };
  }

  bucket.count++;
  return {
    allowed: true,
    tier: resolvedTier,
    remaining: remaining - 1,
    limit: config.monthlyLimit,
    resetAt: bucket.resetAt,
  };
}
