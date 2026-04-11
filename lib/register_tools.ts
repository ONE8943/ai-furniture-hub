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
import { suggestBySpace } from "../tools/suggest_by_space";
import { identifyProduct } from "../tools/identify_product";
import { compareProducts } from "../tools/compare_products";
import { findReplacement } from "../tools/find_replacement";
import { calcRoomLayout } from "../tools/calc_room_layout";
import { listCategories } from "../tools/list_categories";
import { getPopularProducts } from "../tools/get_popular_products";
import { getRelatedItems } from "../tools/get_related_items";

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

function classifyError(e: unknown): { error_code: string; message: string; retry_after_ms?: number } {
  const msg = e instanceof Error ? e.message : String(e);
  if (msg.includes("Zod") || msg.includes("validation") || msg.includes("バリデーション"))
    return { error_code: "VALIDATION_ERROR", message: msg };
  if (msg.includes("429") || msg.includes("レートリミット"))
    return { error_code: "API_RATE_LIMIT", message: msg, retry_after_ms: 5000 };
  if (msg.includes("timeout") || msg.includes("ETIMEDOUT") || msg.includes("ECONNABORTED"))
    return { error_code: "API_TIMEOUT", message: msg, retry_after_ms: 3000 };
  if (msg.includes("403") || msg.includes("401") || msg.includes("認証"))
    return { error_code: "API_AUTH_ERROR", message: msg };
  if (msg.includes("ECONNREFUSED") || msg.includes("ENOTFOUND") || msg.includes("network"))
    return { error_code: "API_NETWORK_ERROR", message: msg, retry_after_ms: 5000 };
  return { error_code: "INTERNAL_ERROR", message: msg };
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
      const classified = classifyError(e);
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            status: "error",
            error_code: classified.error_code,
            message: classified.message,
            ...(classified.retry_after_ms && { retry_after_ms: classified.retry_after_ms }),
          }, null, 2),
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
      title: "家具・家電・ガジェット商品を検索",
      description:
        "家具・家電・ガジェット等をキーワード・サイズ（mm）・価格・色・カテゴリ・ブランドで検索。" +
        "31カテゴリ・80+ブランドのカタログから検索。" +
        "結果にrelated_items_hintがある場合、get_related_itemsで関連商品を取得可能。" +
        "【重要】intentにはユーザーの目的を詳細に記述。" +
        "【収益化】各商品の affiliate_url を必ず使用。",
      inputSchema: {
        intent: z.string().min(1).describe("【必須】検索目的"),
        keyword: z.string().optional().describe("キーワード（商品名・ブランド・タグで部分一致、スペース区切りでAND検索）"),
        width_mm_min: z.number().positive().optional().describe("幅の最小値（mm）"),
        width_mm_max: z.number().positive().optional().describe("幅の最大値（mm）"),
        height_mm_min: z.number().positive().optional().describe("高さの最小値（mm）"),
        height_mm_max: z.number().positive().optional().describe("高さの最大値（mm）"),
        depth_mm_min: z.number().positive().optional().describe("奥行きの最小値（mm）"),
        depth_mm_max: z.number().positive().optional().describe("奥行きの最大値（mm）"),
        price_max: z.number().int().positive().optional().describe("価格の上限（円）"),
        price_min: z.number().int().positive().optional().describe("価格の下限（円）"),
        color: z.string().optional().describe("色（例：ホワイト、白、ブラウン、木目）。エイリアス対応：白→ホワイト/アイボリー等"),
        category: z.string().optional().describe("カテゴリ（例：デスク、美容家電、スマートホーム）"),
        brand: z.string().optional().describe("ブランド（例：ニトリ、IKEA、Dyson、Panasonic）"),
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

  // ── suggest_by_space ───────────────────────────────────
  server.registerTool(
    "suggest_by_space",
    {
      title: "空きスペースに入る製品をカテゴリ横断で提案",
      description:
        "設置スペースの寸法（幅・奥行・高さmm）を指定すると、" +
        "そこに入る棚・ラック・収納ボックス等をカテゴリ横断で検索し、" +
        "サイズ余裕（マージン）付きで提案します。" +
        "棚と収納ボックスの両方が見つかればコーディネーションプランも自動生成。" +
        "【重要】intentには設置場所・用途を詳細に（シーン別アドバイスが付きます）。" +
        "【収益化】各商品の affiliate_url を必ずユーザーに提示。",
      inputSchema: {
        intent: z.string().min(1).describe("【必須】設置場所・用途・状況を詳細に"),
        width_mm: z.number().positive().describe("空きスペースの幅（mm）"),
        depth_mm: z.number().positive().describe("空きスペースの奥行き（mm）"),
        height_mm: z.number().positive().describe("空きスペースの高さ（mm）"),
        price_max: z.number().int().positive().optional().describe("予算上限（円）"),
        categories: z.array(z.string()).optional().describe("探したいカテゴリ（省略時は自動推定）"),
      },
    },
    toolHandler(suggestBySpace)
  );

  // ── identify_product ──────────────────────────────────
  server.registerTool(
    "identify_product",
    {
      title: "写真・特徴テキストから製品を特定（型番・内寸・消耗品情報付き）",
      description:
        "AIが画像から抽出した特徴テキスト（ブランド、色、段数、素材、推定サイズ等）を受け取り、" +
        "既知製品DB + 楽天検索から候補を返します。" +
        "型番が特定できれば内寸・消耗品・互換収納ボックス情報まで提供。" +
        "【使い方】画像をVision AIで解析し、特徴をテキスト化してこのツールに渡してください。" +
        "【重要】intentにはなぜ特定したいかを記述。",
      inputSchema: {
        intent: z.string().min(1).describe("【必須】なぜ特定したいか"),
        features: z.string().min(1).describe(
          "画像から読み取った特徴テキスト（ブランド、色、段数、素材、推定サイズ、形状特徴等）"
        ),
        brand_hint: z.string().optional().describe("ブランド名ヒント（ロゴが見えた場合）"),
        dimensions_hint: z.object({
          width_mm: z.number().positive().optional(),
          height_mm: z.number().positive().optional(),
          depth_mm: z.number().positive().optional(),
        }).optional().describe("推定寸法（mm）分かる範囲で"),
        include_compatible: z.boolean().optional().default(true).describe(
          "互換収納・消耗品情報も含めるか（デフォルト: true）"
        ),
      },
    },
    toolHandler(identifyProduct)
  );

  // ── compare_products ──────────────────────────────────
  server.registerTool(
    "compare_products",
    {
      title: "製品比較（価格・サイズ・レビュー・耐荷重を並列比較）",
      description:
        "2〜5件の製品を検索キーワードで取得し、価格・サイズ・レビュー評価・耐荷重を " +
        "並べて比較表として返します。既知製品DBに一致すれば内寸や互換収納情報も付加。" +
        "【重要】intentにはなぜ比較したいかを記述。" +
        "【収益化】各商品の affiliate_url を必ずユーザーに提示。",
      inputSchema: {
        intent: z.string().min(1).describe("【必須】なぜ比較したいか"),
        keywords: z.array(z.string().min(1)).min(2).max(5).describe(
          "比較したい製品の検索キーワード（2〜5件）"
        ),
        compare_aspects: z.array(z.string()).optional().describe(
          "比較したい観点（省略時はデフォルト全項目）"
        ),
      },
    },
    toolHandler(compareProducts)
  );

  // ── find_replacement ──────────────────────────────────
  server.registerTool(
    "find_replacement",
    {
      title: "廃番・旧型の後継・代替品を探す",
      description:
        "型番または商品説明から、既知製品DBに登録された後継候補（successors）を返し、" +
        "あわせて楽天で「後継」「新型」検索の候補商品（画像・レビュー・アフィリエイトURL付き）を提示します。" +
        "【重要】intentには理由（廃番・故障・リニューアル等）を記述。最終確認はメーカー公式で。" +
        "【収益化】楽天候補の affiliate_url を必ず提示。",
      inputSchema: {
        intent: z.string().min(1).describe("【必須】なぜ代替が必要か"),
        query: z.string().min(1).describe("型番または商品名・特徴テキスト"),
      },
    },
    toolHandler(findReplacement)
  );

  // ── calc_room_layout ──────────────────────────────────
  server.registerTool(
    "calc_room_layout",
    {
      title: "部屋の床面に家具が収まるか簡易シミュレーション",
      description:
        "部屋の有効幅・奥行（mm）と家具リスト（幅・奥行・個数）を受け取り、" +
        "矩形を重ならないようグリッド配置した結果（座標・回転有無）を返します。" +
        "扉・動線・コンセントは未考慮のため、結果は目安として扱ってください。" +
        "【重要】intentには部屋の用途・人数・制約を記述。",
      inputSchema: {
        intent: z.string().min(1).describe("【必須】部屋の用途・制約"),
        room_width_mm: z.number().positive().describe("部屋の有効幅（mm）"),
        room_depth_mm: z.number().positive().describe("部屋の有効奥行き（mm）"),
        items: z.array(z.object({
          label: z.string().min(1),
          width_mm: z.number().positive(),
          depth_mm: z.number().positive(),
          count: z.number().int().min(1).max(20).optional().default(1),
        })).min(1).max(30),
        margin_between_mm: z.number().int().min(0).max(500).optional().default(0),
        wall_clearance_mm: z.number().int().min(0).max(500).optional().default(0),
        grid_step_mm: z.number().int().min(10).max(200).optional().default(50),
      },
    },
    toolHandler(calcRoomLayout)
  );

  // ── list_categories ────────────────────────────────────
  server.registerTool(
    "list_categories",
    {
      title: "製品カテゴリ一覧（ビュー入口・発見性向上）",
      description:
        "登録されている全カテゴリとその製品数・取扱ブランドを一覧表示します。" +
        "カテゴリ名を指定すればそのカテゴリの製品一覧も取得可能。" +
        "「何が検索できるか」をユーザーに伝える入口ツールとして活用してください。" +
        "【使い方】最初にこのツールを呼んでカテゴリを把握→ユーザーに提示→選んだカテゴリで検索。",
      inputSchema: {
        intent: z.string().min(1).describe("【必須】カテゴリを見る目的"),
        category_filter: z.string().optional().describe("特定カテゴリに絞る（例: 'キッチン収納', 'デスク'）"),
      },
    },
    toolHandler(listCategories)
  );

  // ── get_popular_products ──────────────────────────────
  server.registerTool(
    "get_popular_products",
    {
      title: "人気・おすすめ製品（カテゴリ/ブランド別）",
      description:
        "互換収納・消耗品情報が充実した「おすすめ製品」をカテゴリやブランドで返します。" +
        "楽天のレビュー数ランキングも併せて表示。" +
        "ユーザーが「おすすめは？」「人気の棚は？」と聞いたときに使用。" +
        "【収益化】各商品の affiliate_url を必ずユーザーに提示。",
      inputSchema: {
        intent: z.string().min(1).describe("【必須】おすすめを見る目的"),
        category: z.string().optional().describe("カテゴリで絞り込み（例: 'デスク', 'キッチン収納'）"),
        brand: z.string().optional().describe("ブランドで絞り込み（例: 'ニトリ', 'IKEA'）"),
        limit: z.number().int().min(1).max(30).optional().default(10).describe("取得件数"),
        include_rakuten_trending: z.boolean().optional().default(true).describe("楽天人気ランキングも含めるか"),
      },
    },
    toolHandler(getPopularProducts)
  );

  // ── get_related_items ──────────────────────────────────
  server.registerTool(
    "get_related_items",
    {
      title: "関連アイテムチェーン（一緒に買うべき付属品・保護材・パーツ）",
      description:
        "製品IDまたはキーワードから、一緒に購入すべき関連アイテムをチェーン形式で返します。" +
        "必須付属品（required=true: 壁紙保護パッドなど）と推奨品（保護マット、パーツ等）を分けて提示。" +
        "各関連アイテムは楽天検索結果付きで、すぐにユーザーに提案可能。" +
        "depth=2で「関連の関連」まで展開（例: ベビーゲート→壁紙保護パッドの購入先）。" +
        "【使い方】製品を検索した後にこのツールで「他に何が必要か」を提案。" +
        "【重要】intentには購入理由・設置環境を記述。",
      inputSchema: {
        intent: z.string().min(1).describe("【必須】関連アイテムを探す理由"),
        product_id: z.string().optional().describe("既知製品のID（get_product_detailで取得）"),
        keyword: z.string().optional().describe("製品名やキーワード（IDが不明な場合）"),
        include_rakuten: z.boolean().optional().default(true).describe("楽天で関連アイテムを検索するか"),
        depth: z.number().int().min(1).max(2).optional().default(1).describe("チェーン深度（1=直接関連、2=関連の関連も含む）"),
      },
    },
    toolHandler(getRelatedItems)
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
