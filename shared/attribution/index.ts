/**
 * Attribution モジュール
 *
 * API呼び出しを一意に追跡するための attribution_id を生成し、
 * レスポンスに付与する。将来の収益化（pay-per-call / rev-share）の基盤。
 */
import { randomBytes } from "crypto";

// -----------------------------------------------------------------------
// 型定義
// -----------------------------------------------------------------------

export interface AttributionMeta {
  /** 一意なリクエスト識別子 (例: "attr_a1b2c3d4") */
  attribution_id: string;
  /** 呼び出し元サービス名 (apify / rapidapi / direct / unknown) */
  source: AttributionSource;
  /** 呼び出されたツール名 */
  tool: string;
  /** ISO 8601 タイムスタンプ */
  timestamp: string;
}

export type AttributionSource =
  | "apify"
  | "rapidapi"
  | "direct"
  | "unknown";

// -----------------------------------------------------------------------
// Attribution ID 生成
// -----------------------------------------------------------------------

/** 衝突確率が十分低いランダムIDを返す */
export function generateAttributionId(): string {
  return `attr_${randomBytes(8).toString("hex")}`;
}

// -----------------------------------------------------------------------
// ソース検出
// -----------------------------------------------------------------------

/**
 * リクエストコンテキストからソースを判定。
 * 環境変数 ATTRIBUTION_SOURCE が設定されていればそれを優先。
 */
export function detectSource(
  headers?: Record<string, string | undefined>,
): AttributionSource {
  const envSource = process.env["ATTRIBUTION_SOURCE"];
  if (envSource && isValidSource(envSource)) return envSource;

  if (headers) {
    if (headers["x-apify-actor-id"]) return "apify";
    if (headers["x-rapidapi-proxy-secret"]) return "rapidapi";
  }

  return "direct";
}

function isValidSource(v: string): v is AttributionSource {
  return ["apify", "rapidapi", "direct", "unknown"].includes(v);
}

// -----------------------------------------------------------------------
// レスポンスへの injection
// -----------------------------------------------------------------------

/**
 * ツールの返却オブジェクトに attribution メタデータを付与して返す。
 * 元のオブジェクトは変更しない（shallow copy）。
 */
export function injectAttribution<T extends Record<string, unknown>>(
  response: T,
  tool: string,
  headers?: Record<string, string | undefined>,
): T & { _attribution: AttributionMeta } {
  const meta: AttributionMeta = {
    attribution_id: generateAttributionId(),
    source: detectSource(headers),
    tool,
    timestamp: new Date().toISOString(),
  };
  return { ...response, _attribution: meta };
}
