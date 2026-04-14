/**
 * レート制限（ファイル永続化対応）
 *
 * IPアドレスまたはAPIキーに基づいて月間クエリ数を制限する。
 * インメモリで高速処理しつつ、定期的にファイルへ永続化。
 * Render再起動でもカウンタを維持（ディスクが揮発しない限り）。
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

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
  resetAt: number;
}

interface PersistedState {
  byIp: Record<string, UsageBucket>;
  byKey: Record<string, UsageBucket>;
  savedAt: number;
}

const PERSIST_DIR = process.env["RATE_LIMIT_DIR"] ?? join(process.cwd(), "logs");
const PERSIST_FILE = join(PERSIST_DIR, ".rate_limits.json");
const SAVE_INTERVAL_MS = 60_000;

const usageByIp = new Map<string, UsageBucket>();
const usageByKey = new Map<string, UsageBucket>();
let dirty = false;
let lastSaved = 0;

function loadState(): void {
  try {
    if (!existsSync(PERSIST_FILE)) return;
    const raw = readFileSync(PERSIST_FILE, "utf-8");
    const state: PersistedState = JSON.parse(raw);
    const now = Date.now();
    for (const [k, v] of Object.entries(state.byIp ?? {})) {
      if (v.resetAt > now) usageByIp.set(k, v);
    }
    for (const [k, v] of Object.entries(state.byKey ?? {})) {
      if (v.resetAt > now) usageByKey.set(k, v);
    }
  } catch {
    // corrupt or missing — start fresh
  }
}

function saveState(): void {
  if (!dirty) return;
  try {
    mkdirSync(PERSIST_DIR, { recursive: true });
    const state: PersistedState = {
      byIp: Object.fromEntries(usageByIp),
      byKey: Object.fromEntries(usageByKey),
      savedAt: Date.now(),
    };
    writeFileSync(PERSIST_FILE, JSON.stringify(state), "utf-8");
    dirty = false;
    lastSaved = Date.now();
  } catch {
    // non-critical: next save will retry
  }
}

function maybeSave(): void {
  if (dirty && Date.now() - lastSaved > SAVE_INTERVAL_MS) {
    saveState();
  }
}

// Load on module init
loadState();

// Periodic save (non-blocking)
const saveTimer = setInterval(saveState, SAVE_INTERVAL_MS);
if (saveTimer.unref) saveTimer.unref();

// Save on process exit
process.on("beforeExit", saveState);
process.on("SIGINT", () => { saveState(); process.exit(0); });
process.on("SIGTERM", () => { saveState(); process.exit(0); });

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
    dirty = true;
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
  dirty = true;
  maybeSave();

  return {
    allowed: true,
    tier: resolvedTier,
    remaining: remaining - 1,
    limit: config.monthlyLimit,
    resetAt: bucket.resetAt,
  };
}
