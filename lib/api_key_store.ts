/**
 * APIキー管理ストア
 *
 * 初期実装: 環境変数ベースのシンプルなキー管理。
 * 将来的にはDB（SQLite/PostgreSQL）に移行可能。
 *
 * 環境変数:
 *   MCP_API_KEYS_FREE=key1,key2,...  (Free tier keys)
 *   MCP_API_KEYS_PRO=key1,key2,...   (Pro tier keys)
 */

import type { ApiTier } from "./rate_limiter";

interface ApiKeyEntry {
  key: string;
  tier: ApiTier;
  owner?: string;
}

let keyStore: ApiKeyEntry[] | null = null;

function loadKeys(): ApiKeyEntry[] {
  if (keyStore) return keyStore;

  keyStore = [];

  const freeKeys = process.env["MCP_API_KEYS_FREE"]?.split(",").filter(Boolean) ?? [];
  for (const k of freeKeys) {
    keyStore.push({ key: k.trim(), tier: "free" });
  }

  const proKeys = process.env["MCP_API_KEYS_PRO"]?.split(",").filter(Boolean) ?? [];
  for (const k of proKeys) {
    keyStore.push({ key: k.trim(), tier: "pro" });
  }

  return keyStore;
}

export interface KeyValidation {
  valid: boolean;
  tier: ApiTier;
  owner?: string;
}

/**
 * APIキーを検証してティアを返す。
 * キーなし → anonymous、不明キー → invalid扱い。
 */
export function validateApiKey(apiKey: string | undefined): KeyValidation {
  if (!apiKey) {
    return { valid: true, tier: "anonymous" };
  }

  const keys = loadKeys();
  const entry = keys.find((e) => e.key === apiKey);

  if (!entry) {
    return { valid: false, tier: "anonymous" };
  }

  return { valid: true, tier: entry.tier, owner: entry.owner };
}

/**
 * 既存の MCP_API_KEY（旧方式）もProとして扱う互換レイヤー。
 */
export function validateApiKeyCompat(
  apiKey: string | undefined,
  legacyMcpApiKey: string | undefined,
): KeyValidation {
  if (apiKey && legacyMcpApiKey && apiKey === legacyMcpApiKey) {
    return { valid: true, tier: "pro" };
  }
  return validateApiKey(apiKey);
}
