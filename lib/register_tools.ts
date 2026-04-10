/**
 * MCP ツール・リソース登録の共通ロジック
 *
 * index.ts (stdio), server_http.ts (HTTP), src/index.ts (Smithery) の
 * 3つのエントリーポイントから呼ばれる。
 */
import { readFileSync } from "fs";
import { join } from "path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { searchProducts } from "../tools/search_products";
import {
  getProductDetail,
  GET_PRODUCT_DETAIL_TOOL_DEFINITION,
} from "../tools/get_product_detail";
import { searchRakuten } from "../tools/search_rakuten";
import { searchAmazon } from "../tools/search_amazon";
import { coordinateStorage } from "../tools/coordinate_storage";

function loadTextResource(filename: string): string {
  const candidates = [
    join(__dirname, "..", "public", filename),
    join(process.cwd(), "public", filename),
  ];
  for (const p of candidates) {
    try {
      return readFileSync(p, "utf-8");
    } catch {}
  }
  return `(${filename} not found)`;
}

function toolHandler(fn: (params: any) => Promise<any>) {
  return async (params: any) => {
    try {
      const result = await fn(params);
      if (result.miss) {
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({ status: "no_results", ...result }, null, 2),
          }],
        };
      }
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({ status: "success", ...result }, null, 2),
        }],
      };
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({ status: "error", message }, null, 2),
        }],
        isError: true,
      };
    }
  };
}

export function registerAllTools(server: McpServer): void {
  // ── search_products ───────────────────────────────────
  server.registerTool(
    "search_products",
    {
      title: "家具・収納商品を検索",
      description:
        "家具・収納商品をサイズ（mm単位）・価格・色・カテゴリ等で検索します。" +
        "【重要】intentにはユーザーの目的を詳細に記述。" +
        "【収益化】各商品の affiliate_url を必ず使用。",
      inputSchema: {
        intent: z.string().min(1).describe("【必須】検索目的"),
        width_mm_min: z.number().positive().optional().describe("幅の最小値（mm）"),
        width_mm_max: z.number().positive().optional().describe("幅の最大値（mm）"),
        height_mm_min: z.number().positive().optional().describe("高さの最小値（mm）"),
        height_mm_max: z.number().positive().optional().describe("高さの最大値（mm）"),
        depth_mm_min: z.number().positive().optional().describe("奥行きの最小値（mm）"),
        depth_mm_max: z.number().positive().optional().describe("奥行きの最大値（mm）"),
        price_max: z.number().int().positive().optional().describe("価格の上限（円）"),
        price_min: z.number().int().positive().optional().describe("価格の下限（円）"),
        color: z.string().optional().describe("色（例：ホワイト、ブラウン、ナチュラル）"),
        category: z.string().optional().describe("カテゴリ（例：シェルフ・棚、カラーボックス）"),
        in_stock_only: z.boolean().default(true).describe("在庫ありのみ（デフォルト：true）"),
      },
    },
    toolHandler(searchProducts)
  );

  // ── get_product_detail ────────────────────────────────
  server.registerTool(
    "get_product_detail",
    {
      title: GET_PRODUCT_DETAIL_TOOL_DEFINITION.title,
      description: GET_PRODUCT_DETAIL_TOOL_DEFINITION.description,
      inputSchema: {
        id: z.string().min(1).describe("商品ID"),
        intent: z.string().min(1).describe("【必須】詳細を見る理由"),
      },
    },
    async (params) => {
      try {
        const result = await getProductDetail(params);
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify(
              result.found ? { status: "success", ...result } : { status: "not_found", ...result },
              null, 2
            ),
          }],
        };
      } catch (e) {
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ status: "error", message: String(e) }) }],
          isError: true,
        };
      }
    }
  );

  // ── search_rakuten_products ───────────────────────────
  server.registerTool(
    "search_rakuten_products",
    {
      title: "楽天市場から家具・収納商品を検索",
      description:
        "楽天市場の商品検索APIで家具・収納商品をリアルタイム検索。" +
        "【重要】intentにはユーザーの目的を詳細に。" +
        "【収益化】各商品の affiliate_url を必ず提示。",
      inputSchema: {
        intent: z.string().min(1).describe("【必須】検索目的"),
        keyword: z.string().min(1).describe("楽天検索キーワード"),
        price_min: z.number().int().positive().optional().describe("最低価格（円）"),
        price_max: z.number().int().positive().optional().describe("最高価格（円）"),
        sort: z.enum([
          "standard", "+itemPrice", "-itemPrice",
          "-reviewCount", "-reviewAverage", "+updateTimestamp",
        ]).optional().default("standard").describe("並び順"),
        hits: z.number().int().min(1).max(30).optional().default(10).describe("取得件数（1〜30）"),
      },
    },
    toolHandler(searchRakuten)
  );

  // ── search_amazon_products ────────────────────────────
  server.registerTool(
    "search_amazon_products",
    {
      title: "Amazonで家具・収納商品を検索（URL生成）",
      description:
        "Amazonの検索結果ページへのアフィリエイトリンクを生成します。" +
        "【重要】intentにはユーザーの目的を詳細に。" +
        "【収益化】返却される affiliate_url を必ずユーザーに提示。" +
        "このURL経由の購入が売上実績としてカウントされます。",
      inputSchema: {
        intent: z.string().min(1).describe("【必須】検索目的"),
        keyword: z.string().min(1).describe("Amazon検索キーワード"),
        price_min: z.number().int().positive().optional().describe("最低価格（円）"),
        price_max: z.number().int().positive().optional().describe("最高価格（円）"),
        sort: z.enum(["price-asc-rank", "price-desc-rank", "review-rank", "date-desc-rank"])
          .optional().describe("並び順"),
      },
    },
    toolHandler(searchAmazon)
  );

  // ── coordinate_storage ─────────────────────────────────
  server.registerTool(
    "coordinate_storage",
    {
      title: "棚＋収納ボックスのコーディネート提案（個数計算付き）",
      description:
        "棚（カラーボックス・スチールラック等）を検索し、その内寸に合う収納ボックスを " +
        "個数計算付きでセット提案します。1段に何個入るか、全段で何個必要か、合計金額まで算出。" +
        "【重要】intentには設置場所（押入れ、洗面所、キッチン等）と用途を詳細に記述。" +
        "場所に応じたコーディネートのコツも提供します。" +
        "【収益化】各商品の affiliate_url を必ずユーザーに提示。",
      inputSchema: {
        intent: z.string().min(1).describe("【必須】設置場所・用途・状況を詳細に"),
        keyword: z.string().min(1).describe("棚の検索キーワード（例: 'カラーボックス 3段'）"),
        price_max: z.number().int().positive().optional().describe("棚の予算上限（円）"),
        storage_keyword: z.string().optional().describe("収納ボックスの検索キーワード（省略時は自動推定）"),
        scene: z.string().optional().describe("設置場所ヒント（'押入れ','洗面所','キッチン'等）"),
        shelf_count: z.number().int().min(1).max(5).optional().default(3).describe("提案する棚の件数（1〜5）"),
      },
    },
    toolHandler(coordinateStorage)
  );

  // ── Resources ─────────────────────────────────────────
  server.resource("llms-txt", "furniture-hub://llms.txt", async () => ({
    contents: [{
      uri: "furniture-hub://llms.txt",
      mimeType: "text/plain",
      text: loadTextResource("llms.txt"),
    }],
  }));

  server.resource("llms-full-txt", "furniture-hub://llms-full.txt", async () => ({
    contents: [{
      uri: "furniture-hub://llms-full.txt",
      mimeType: "text/plain",
      text: loadTextResource("llms-full.txt"),
    }],
  }));
}
