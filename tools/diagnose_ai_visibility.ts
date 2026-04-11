/**
 * AI可視性診断ツール
 *
 * URLを受け取り、そのサイトがAIエージェントにどう見えているかを診断する。
 * llms.txt / robots.txt / 構造化データ / OGP / 越境対応度をチェック。
 */
import { z } from "zod";
import axios from "axios";
import { checkRobotsTxt } from "../utils/robots_checker";
import { logAnalytics, buildHitLog } from "../utils/logger";

export const DIAGNOSE_AI_VISIBILITY_SCHEMA = {
  intent: z.string().min(1).describe("【必須】なぜ診断が必要か"),
  url: z.string().url().describe("診断対象のURL"),
};

type CheckStatus = "pass" | "warn" | "fail";

interface CheckItem {
  item: string;
  status: CheckStatus;
  detail: string;
  weight: number;
}

export interface DiagnoseResult {
  url: string;
  score: number;
  grade: "A" | "B" | "C" | "D" | "F";
  checks: Array<Omit<CheckItem, "weight">>;
  cross_border_readiness: {
    has_english_meta: boolean;
    has_structured_dimensions: boolean;
    has_multi_currency: boolean;
    has_shipping_info: boolean;
    score: number;
  };
  recommendation: string;
  miss: boolean;
}

async function fetchPage(url: string): Promise<{ html: string; headers: Record<string, string> } | null> {
  try {
    const resp = await axios.get<string>(url, {
      timeout: 10000,
      headers: { "User-Agent": "AI-Furniture-Hub-AIO-Checker/1.0" },
      maxRedirects: 3,
      responseType: "text",
    });
    const headers: Record<string, string> = {};
    for (const [k, v] of Object.entries(resp.headers)) {
      if (typeof v === "string") headers[k.toLowerCase()] = v;
    }
    return { html: typeof resp.data === "string" ? resp.data : "", headers };
  } catch {
    return null;
  }
}

async function checkLlmsTxt(baseUrl: string): Promise<CheckItem> {
  try {
    const resp = await axios.get(`${baseUrl}/llms.txt`, { timeout: 5000, responseType: "text" });
    const text = typeof resp.data === "string" ? resp.data : "";
    if (text.length > 50) {
      return { item: "llms.txt", status: "pass", detail: `${text.length}文字のllms.txtが存在。AIエージェントが参照可能。`, weight: 25 };
    }
    return { item: "llms.txt", status: "warn", detail: "llms.txtが存在するが内容が少ない（50文字未満）。", weight: 10 };
  } catch {
    return { item: "llms.txt", status: "fail", detail: "llms.txtが未設定。AIエージェントがサイトの概要を把握できない。", weight: 0 };
  }
}

async function checkRobots(baseUrl: string): Promise<CheckItem> {
  const result = await checkRobotsTxt(`${baseUrl}/`, "GPTBot");
  if (result.allowed) {
    return { item: "robots.txt (AIクローラー)", status: "pass", detail: "AIクローラー（GPTBot等）のアクセスが許可されている。", weight: 15 };
  }
  return { item: "robots.txt (AIクローラー)", status: "fail", detail: `AIクローラーがブロックされている: ${result.reason ?? ""}`, weight: 0 };
}

function checkStructuredData(html: string): CheckItem {
  const hasJsonLd = html.includes("application/ld+json");
  const hasSchemaOrg = html.includes("schema.org");
  if (hasJsonLd && hasSchemaOrg) {
    return { item: "構造化データ (JSON-LD)", status: "pass", detail: "JSON-LDとSchema.orgが検出された。AIが商品情報を構造的に理解できる。", weight: 20 };
  }
  if (hasJsonLd || hasSchemaOrg) {
    return { item: "構造化データ (JSON-LD)", status: "warn", detail: "一部の構造化データが検出されたが不完全な可能性がある。", weight: 10 };
  }
  return { item: "構造化データ (JSON-LD)", status: "fail", detail: "JSON-LD/Schema.orgが未検出。AIが商品スペックを正確に読み取れない可能性。", weight: 0 };
}

function checkOgp(html: string): CheckItem {
  const ogTitle = /og:title/.test(html);
  const ogDesc = /og:description/.test(html);
  const ogImage = /og:image/.test(html);
  const count = [ogTitle, ogDesc, ogImage].filter(Boolean).length;
  if (count === 3) {
    return { item: "OGPメタタグ", status: "pass", detail: "og:title, og:description, og:imageが全て設定されている。", weight: 10 };
  }
  if (count > 0) {
    return { item: "OGPメタタグ", status: "warn", detail: `OGPタグが部分的（${count}/3）。不足するとAIの初期理解が不正確になる。`, weight: 5 };
  }
  return { item: "OGPメタタグ", status: "fail", detail: "OGPメタタグが未設定。", weight: 0 };
}

function checkDimensionFormat(html: string): CheckItem {
  const mmPattern = /\d+\s*mm/i;
  const cmPattern = /\d+\s*cm/i;
  const inchPattern = /\d+\s*(?:inch|in|″)/i;
  const units: string[] = [];
  if (mmPattern.test(html)) units.push("mm");
  if (cmPattern.test(html)) units.push("cm");
  if (inchPattern.test(html)) units.push("inch");

  if (units.length === 0) {
    return { item: "寸法データ表記", status: "warn", detail: "寸法データが検出されなかった。商品ページでない可能性もある。", weight: 5 };
  }
  if (units.length === 1 && units[0] === "mm") {
    return { item: "寸法データ表記", status: "pass", detail: "mm統一の寸法表記。AIが正確に解析可能。", weight: 15 };
  }
  if (units.length > 1) {
    return { item: "寸法データ表記", status: "warn", detail: `複数単位混在（${units.join(",")}）。AIが誤解する可能性がある。`, weight: 8 };
  }
  return { item: "寸法データ表記", status: "pass", detail: `${units[0]}での寸法表記を検出。`, weight: 12 };
}

function checkMobileViewport(html: string): CheckItem {
  if (/viewport/.test(html)) {
    return { item: "モバイル対応", status: "pass", detail: "viewportメタタグが設定されている。", weight: 5 };
  }
  return { item: "モバイル対応", status: "warn", detail: "viewportメタタグが未検出。", weight: 2 };
}

function checkCrossBorder(html: string): {
  has_english_meta: boolean;
  has_structured_dimensions: boolean;
  has_multi_currency: boolean;
  has_shipping_info: boolean;
  score: number;
} {
  const has_english_meta = /lang="en"/.test(html) || /hreflang="en"/.test(html) || /xml:lang="en"/.test(html);
  const has_structured_dimensions = /itemprop="(width|height|depth)"/.test(html) || /"dimensions"/.test(html);
  const has_multi_currency = /USD|EUR|GBP|¥.*\$|\$.*¥/.test(html) || /currency.*select/i.test(html);
  const has_shipping_info = /international.*shipping/i.test(html) || /海外配送/i.test(html) || /worldwide/i.test(html);
  const checks = [has_english_meta, has_structured_dimensions, has_multi_currency, has_shipping_info];
  const score = Math.round((checks.filter(Boolean).length / checks.length) * 100);
  return { has_english_meta, has_structured_dimensions, has_multi_currency, has_shipping_info, score };
}

function scoreToGrade(score: number): "A" | "B" | "C" | "D" | "F" {
  if (score >= 85) return "A";
  if (score >= 70) return "B";
  if (score >= 50) return "C";
  if (score >= 30) return "D";
  return "F";
}

function buildRecommendation(checks: CheckItem[], crossBorder: ReturnType<typeof checkCrossBorder>): string {
  const fails = checks.filter((c) => c.status === "fail");
  const warns = checks.filter((c) => c.status === "warn");

  const parts: string[] = [];
  if (fails.length > 0) {
    parts.push(`最優先で対応すべき項目: ${fails.map((f) => f.item).join(", ")}`);
  }
  if (warns.length > 0) {
    parts.push(`改善推奨: ${warns.map((w) => w.item).join(", ")}`);
  }
  if (crossBorder.score < 50) {
    parts.push("越境対応度が低い。英語メタタグ(hreflang)と構造化寸法データの追加で海外AIエージェントからの可視性が向上する。");
  }
  if (parts.length === 0) {
    parts.push("AI可視性は良好です。定期的なllms.txtの更新と構造化データの充実を継続してください。");
  }
  return parts.join(" / ");
}

export async function diagnoseAiVisibility(rawInput: unknown): Promise<DiagnoseResult> {
  const params = rawInput as { intent: string; url: string };
  const url = params.url;

  let baseUrl: string;
  try {
    const parsed = new URL(url);
    baseUrl = `${parsed.protocol}//${parsed.host}`;
  } catch {
    return {
      url,
      score: 0,
      grade: "F",
      checks: [{ item: "URL検証", status: "fail", detail: "無効なURL" }],
      cross_border_readiness: { has_english_meta: false, has_structured_dimensions: false, has_multi_currency: false, has_shipping_info: false, score: 0 },
      recommendation: "有効なURLを指定してください。",
      miss: true,
    };
  }

  const page = await fetchPage(url);
  if (!page) {
    return {
      url,
      score: 0,
      grade: "F",
      checks: [{ item: "ページ取得", status: "fail", detail: "ページを取得できませんでした（タイムアウトまたはアクセス拒否）" }],
      cross_border_readiness: { has_english_meta: false, has_structured_dimensions: false, has_multi_currency: false, has_shipping_info: false, score: 0 },
      recommendation: "サイトにアクセスできませんでした。URLが正しいか、サーバーが稼働しているか確認してください。",
      miss: true,
    };
  }

  const checks: CheckItem[] = [];
  checks.push(await checkLlmsTxt(baseUrl));
  checks.push(await checkRobots(baseUrl));
  checks.push(checkStructuredData(page.html));
  checks.push(checkOgp(page.html));
  checks.push(checkDimensionFormat(page.html));
  checks.push(checkMobileViewport(page.html));

  const maxScore = checks.reduce((sum, c) => sum + 25, 0);
  const actualScore = checks.reduce((sum, c) => sum + c.weight, 0);
  const normalizedScore = Math.round((actualScore / maxScore) * 100);
  const crossBorder = checkCrossBorder(page.html);
  const recommendation = buildRecommendation(checks, crossBorder);

  const logEntry = buildHitLog("diagnose_ai_visibility", { url }, params.intent, checks.length);
  logAnalytics(logEntry).catch(() => {});

  return {
    url,
    score: normalizedScore,
    grade: scoreToGrade(normalizedScore),
    checks: checks.map(({ weight, ...rest }) => rest),
    cross_border_readiness: crossBorder,
    recommendation,
    miss: false,
  };
}
