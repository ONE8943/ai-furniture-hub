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
import { summarizeDemandSignalsTool } from "../tools/summarize_demand_signals";
import { findProductGapsTool } from "../tools/find_product_gaps";
import { getCuratedSets, GET_CURATED_SETS_SCHEMA } from "../tools/get_curated_sets";
import { diagnoseAiVisibility, DIAGNOSE_AI_VISIBILITY_SCHEMA } from "../tools/diagnose_ai_visibility";
import { measureFromPhotoTool } from "../tools/measure_from_photo";

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
        "ユーザーが「棚が欲しい」「Dysonのドライヤー」「幅40cmに入るもの」と言ったときに呼ぶ。" +
        "31カテゴリ・80+ブランドのカタログをキーワード・サイズ(mm)・価格・色・ブランドで横断検索。" +
        "結果にrelated_items_hintがある場合はget_related_itemsで付属品チェーンを取得できる。" +
        "buy_guideがある場合はbest_for/avoid_ifをユーザーに伝えて購入判断を助けること。" +
        "seasonal_hints/active_salesがある場合はセール情報を伝えること。" +
        "色はエイリアス対応（白→ホワイト/アイボリー等）。" +
        "各商品のaffiliate_urlをユーザーに提示すること。",
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
        "カタログにない商品や最新価格・在庫が必要なときに呼ぶ。" +
        "楽天市場APIでリアルタイム検索し、価格・レビュー・画像付きで返す。" +
        "各商品のaffiliate_urlをユーザーに提示すること。",
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
        "ユーザーがAmazonで買いたい場合や楽天で見つからない場合に呼ぶ。" +
        "Amazonの検索結果ページへのアフィリエイトURLを生成する（商品データは返さない）。" +
        "SearchIndexはカテゴリから自動選択。affiliate_urlをユーザーに提示すること。",
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
        "「この棚に合うボックスは？」「カラーボックスの整理方法」のときに呼ぶ。" +
        "棚の内寸から収納ボックスの入り数を計算し、1段あたり何個×全段＝合計個数・合計金額を算出。" +
        "設置場所(押入れ/洗面所/キッチン等)に応じたコーディネートのコツ+ペルソナ別推薦(persona_hints)も提供。" +
        "大型棚にはcarry_in(搬入経路チェック)が付く。risk=warning/criticalならユーザーに搬入注意を伝えること。" +
        "各商品のaffiliate_urlをユーザーに提示すること。",
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
        "「洗面所の幅45cm×奥行30cmの隙間に何か置きたい」のようにスペース起点で探すときに呼ぶ。" +
        "寸法(mm)を指定すると、そこに収まる製品をカテゴリ横断で返す。回転フィット対応（幅と奥行を入れ替えても判定）。" +
        "棚＋ボックスの両方が見つかればコーディネーションプランも自動生成。" +
        "大型品にはcarry_in(搬入経路チェック)が付く。risk=warning/criticalならユーザーに搬入注意を伝えること。" +
        "各商品のaffiliate_urlをユーザーに提示すること。",
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

  // ── measure_from_photo ────────────────────────────────
  server.registerTool(
    "measure_from_photo",
    {
      title: "写真＋参照物から家具・スペースの寸法を推定",
      description:
        "「写真を撮ったので寸法を測りたい」「この隙間に合う棚を探したい」のときに呼ぶ。\n" +
        "ユーザーが写真に名刺・ペットボトル・A4用紙・クレジットカード等の参照物を一緒に写すと、\n" +
        "ピクセル比率から対象物の実寸(mm)を逆算する。\n\n" +
        "【AIの役割】写真をVisionで解析し、参照物と対象物それぞれのピクセル幅・高さを読み取ってこのツールに渡す。\n" +
        "対応参照物: 名刺(91×55mm)、クレジットカード(85.6×54mm)、ペットボトル500ml(65×205mm)、" +
        "A4用紙(210×297mm)、500円玉(∅26.5mm)、1円玉(∅20mm)、スマホ(71.5×147mm)、ティッシュ箱(240×115mm)、30cm定規、ボールペン(140mm)\n\n" +
        "結果のsearch_dimensionsをそのままsuggest_by_spaceやcoordinate_storageに渡せば、写真→寸法→商品マッチングが完結する。\n" +
        "信頼度が低い場合は「メジャーで実測を」と伝えること。",
      inputSchema: {
        intent: z.string().min(1).describe("【必須】写真から何を測りたいか"),
        reference_object: z.string().min(1).describe(
          "写真に写っている参照物の名前（名刺/ペットボトル/A4用紙/クレジットカード/500円玉/1円玉/スマホ/ティッシュ箱/30cm定規/ボールペン）",
        ),
        reference_px: z.object({
          width_px: z.number().positive().describe("参照物の画像上の幅（ピクセル）"),
          height_px: z.number().positive().describe("参照物の画像上の高さ（ピクセル）"),
        }).describe("参照物のピクセル寸法（AIがVisionで画像から読み取る）"),
        target_description: z.string().min(1).describe("測定対象の説明（例: '白い3段カラーボックス', '洗面台横の隙間'）"),
        target_px: z.object({
          width_px: z.number().positive().describe("対象物の画像上の幅（ピクセル）"),
          height_px: z.number().positive().describe("対象物の画像上の高さ（ピクセル）"),
          depth_px: z.number().positive().optional().describe("対象物の画像上の奥行き（ピクセル、斜め視点で見える場合）"),
        }).describe("対象物のピクセル寸法（AIがVisionで画像から読み取る）"),
        estimated_depth_mm: z.number().positive().optional().describe(
          "AIが推定した奥行き（mm）。写真から奥行きが読めない場合にVision LLMの推定値を入れる",
        ),
        manual_dimensions_mm: z.object({
          width_mm: z.number().positive().optional(),
          height_mm: z.number().positive().optional(),
          depth_mm: z.number().positive().optional(),
        }).optional().describe("ユーザーがメジャー/AR等で実測した値があれば上書き（最高精度）"),
      },
    },
    toolHandler(measureFromPhotoTool),
  );

  // ── identify_product ──────────────────────────────────
  server.registerTool(
    "identify_product",
    {
      title: "写真・特徴テキストから製品を特定（型番・内寸・消耗品情報付き）",
      description:
        "「この写真の棚は何？」「持ってる棚に合うボックスを知りたい」のときに呼ぶ。" +
        "Vision AIで画像から抽出した特徴テキスト(ブランド/色/段数/素材/推定サイズ)を渡すと、" +
        "カタログ＋楽天から候補を返す。型番特定時は内寸・消耗品・互換ボックス情報付き。",
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
        "「NクリックとKALLAXどっちがいい？」のように2〜5製品を比較するときに呼ぶ。" +
        "価格・サイズ・レビュー・耐荷重を並列比較表で返す。カタログ一致時は内寸・互換収納・buy_guide(best_for/avoid_if)も付加。" +
        "buy_guideのdecision_hintは比較recommendationにも反映済み。" +
        "各商品のaffiliate_urlをユーザーに提示すること。",
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
        "「この型番が売ってない」「生産終了した棚の代わり」のときに呼ぶ。" +
        "カタログの後継候補(successors)と楽天の「後継」「新型」検索結果を返す。" +
        "最終確認はメーカー公式で。楽天候補のaffiliate_urlをユーザーに提示すること。",
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
        "「この部屋にベッドとデスクは入る？」のように家具の配置可否を確認するときに呼ぶ。" +
        "部屋の有効寸法(mm)と家具リスト(幅/奥行/個数)からグリッド配置シミュレーションを実行。" +
        "座標と回転有無を返す。扉・動線は未考慮のため目安として扱うこと。" +
        "大型家具にはcarry_in_warnings(搬入経路チェック)が付く。risk=warning/criticalならユーザーに搬入注意を伝えること。",
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
      title: "製品カテゴリ一覧",
      description:
        "「何が検索できる？」「どんなカテゴリがある？」のときに呼ぶ入口ツール。" +
        "全31カテゴリと製品数・取扱ブランドを返す。カテゴリ名指定でそのカテゴリの製品一覧も取得可能。" +
        "まずこのツールでカテゴリを把握→ユーザーに提示→選んだカテゴリでsearch_productsに進む。",
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
        "「おすすめの棚は？」「人気のキッチン家電は？」のときに呼ぶ。" +
        "カテゴリ/ブランドで絞って、互換収納・消耗品情報が充実したおすすめ製品を返す。" +
        "楽天のレビュー数トレンドも付加。各商品のaffiliate_urlをユーザーに提示すること。",
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

  // ── summarize_demand_signals ───────────────────────────
  server.registerTool(
    "summarize_demand_signals",
    {
      title: "寸法需要ログの要約",
      description:
        "suggest_by_space / coordinate_storage から蓄積された demand_signals を要約する。" +
        "どのシーン・どの fit 状態・どの安全フラグが多いかを把握したいときに呼ぶ。" +
        "分析・週次レポート・自社商品企画の優先順位付けに使う。",
      inputSchema: {
        intent: z.string().min(1).describe("【必須】なぜ需要サマリーを見たいか"),
        limit: z.number().int().min(1).max(30).optional().default(10).describe("上位何件まで見るか"),
        scene_name: z.string().optional().describe("特定シーンに絞る（例: '洗面所・脱衣所'）"),
      },
    },
    toolHandler(summarizeDemandSignalsTool)
  );

  // ── find_product_gaps ──────────────────────────────────
  server.registerTool(
    "find_product_gaps",
    {
      title: "未充足需要・きつい寸法帯の抽出",
      description:
        "demand_signals から miss と tight_fit を束ねて、どのシーン・寸法帯・カテゴリに商品ギャップがあるかを返す。" +
        "Amazon出品候補、自社開発候補、優先して集める寸法データ帯の発見に使う。",
      inputSchema: {
        intent: z.string().min(1).describe("【必須】なぜギャップ候補を抽出したいか"),
        limit: z.number().int().min(1).max(30).optional().default(10).describe("返す候補数"),
        scene_name: z.string().optional().describe("特定シーンに絞る（例: '押入れ・クローゼット'）"),
        include_tight_fit: z.boolean().optional().default(true).describe("tight_fit も改善候補として含めるか"),
      },
    },
    toolHandler(findProductGapsTool)
  );

  // ── get_related_items ──────────────────────────────────
  server.registerTool(
    "get_related_items",
    {
      title: "関連アイテムチェーン（一緒に買うべき付属品・保護材・パーツ）",
      description:
        "search_productsで商品を見つけた後、「他に何が必要？」を提案するために呼ぶ。" +
        "必須付属品(required=true: フィルター/ケーブル等)と推奨品(保護マット/パーツ等)を分けて返す。" +
        "各関連アイテムは楽天検索結果付きで即提案可能。depth=2で「関連の関連」まで展開。" +
        "required=trueのアイテムは必ずユーザーに伝えること。",
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

  // ── diagnose_ai_visibility ────────────────────────────
  server.registerTool(
    "diagnose_ai_visibility",
    {
      title: "AI可視性診断（AIO診断）",
      description:
        "URLを指定すると、そのサイトがAIエージェント（GPT/Claude/Gemini等）からどの程度「見えている」かを診断する。" +
        "llms.txt、robots.txt(AIクローラー許可)、構造化データ(JSON-LD)、OGPメタタグ、寸法データ表記、越境対応度をチェックし、" +
        "0-100のスコアとA-Fグレードを返す。越境対応度(cross_border_readiness)は海外AIエージェントへの可視性を評価。" +
        "AIOエージェンシーのデモとして「御社の商品、AIからこう見えています」と提示できる。",
      inputSchema: DIAGNOSE_AI_VISIBILITY_SCHEMA,
    },
    toolHandler(diagnoseAiVisibility)
  );

  // ── get_curated_sets ──────────────────────────────────
  server.registerTool(
    "get_curated_sets",
    {
      title: "キュレーション済みセット提案（バンドル/ルームプリセット/インフルエンサーPick/ハックセット）",
      description:
        "「新生活に必要なもの一式」「YouTuberのデスクツアーで紹介された商品」「予算5万で書斎を作りたい」のような" +
        "セット提案・キュレーション情報を返す。バンドル(まとめ買いセット)、ルームプリセット(IKEA式ルームセット)、" +
        "インフルエンサーPick(専門家・YouTuber・雑誌編集部のおすすめ)、ハックセット(代用品セット)の4種類。" +
        "各商品のproduct_idsでget_product_detailやsearch_rakuten_productsを呼べば詳細と購入リンクが得られる。",
      inputSchema: GET_CURATED_SETS_SCHEMA,
    },
    toolHandler(getCuratedSets)
  );

  server.prompt(
    "photo_to_furniture",
    {
      target: z.string().describe("測りたいもの（例: '洗面台横の隙間', 'リビングの壁面'）"),
      reference: z.string().optional().describe("参照物（例: '名刺', 'ペットボトル'。省略時は推奨参照物を案内）"),
    },
    async ({ target, reference }) => ({
      messages: [{
        role: "user" as const,
        content: {
          type: "text" as const,
          text: [
            `「${target}」の寸法を写真から測定し、ぴったり合う家具・収納を提案してください。`,
            "",
            reference
              ? `参照物: ${reference} を一緒に写した写真を渡します。`
              : "【まず参照物を案内してください】写真と一緒に写すと精度が上がる参照物: 名刺(91×55mm)、クレジットカード、ペットボトル500ml、A4用紙、500円玉",
            "",
            "以下の手順で進めてください：",
            "1. ユーザーの写真をVisionで解析し、参照物と対象物のピクセル寸法を読み取る",
            "2. measure_from_photo で実寸を逆算",
            "3. 結果のsearch_dimensionsを使って suggest_by_space でフィットする商品を検索",
            "4. 良い候補があれば coordinate_storage で棚+収納ボックスのコーディネート提案",
            "5. 大型品なら搬入経路チェック(carry_in_warnings)も伝える",
            "",
            "信頼度がlow/mediumの場合は「メジャーで実測するとより正確です」と伝えてください。",
            "各商品のaffiliate_urlを必ず含めてください。",
          ].filter(Boolean).join("\n"),
        },
      }],
    }),
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

  // ── Prompts ──────────────────────────────────────────
  server.prompt(
    "room_coordinator",
    {
      room: z.string().describe("部屋の種類（例: リビング、寝室、子供部屋、キッチン、洗面所、玄関）"),
      width_mm: z.string().describe("空きスペースの幅（mm）"),
      depth_mm: z.string().describe("空きスペースの奥行き（mm）"),
      height_mm: z.string().describe("空きスペースの高さ（mm）"),
      budget: z.string().optional().describe("予算（円、省略可）"),
    },
    async ({ room, width_mm, depth_mm, height_mm, budget }) => ({
      messages: [{
        role: "user" as const,
        content: {
          type: "text" as const,
          text: [
            `${room}の空きスペース（幅${width_mm}mm × 奥行${depth_mm}mm × 高さ${height_mm}mm）に最適な収納ソリューションを提案してください。`,
            budget ? `予算は${budget}円以内です。` : "",
            "",
            "以下の手順で進めてください：",
            "1. suggest_by_space で空きスペースに入る商品を検索",
            "2. 候補が見つかったら get_related_items で必要な付属品・保護材を確認",
            "3. coordinate_storage で棚＋収納ボックスのセット提案（個数・合計金額付き）",
            "4. 最終的に「棚＋ボックス＋保護材」の完全なコーディネートプランとして提示",
            "",
            "各商品のaffiliate_urlを必ず含めてください。",
            "required=trueの関連アイテムは必ず言及してください。",
          ].filter(Boolean).join("\n"),
        },
      }],
    })
  );

  server.prompt(
    "moving_checklist",
    {
      room_type: z.string().describe("引越し先の間取り（例: 1K、1LDK、2LDK、3LDK）"),
      priority: z.string().optional().describe("優先カテゴリ（例: キッチン、リビング、寝室）"),
    },
    async ({ room_type, priority }) => ({
      messages: [{
        role: "user" as const,
        content: {
          type: "text" as const,
          text: [
            `${room_type}への引越しで必要な家具・家電・収納用品の購入チェックリストを作成してください。`,
            priority ? `特に${priority}を優先してください。` : "",
            "",
            "以下の手順で進めてください：",
            "1. list_categories でカテゴリ一覧を取得し、引越しに必要なカテゴリを特定",
            "2. 各カテゴリから get_popular_products でおすすめ商品を取得",
            "3. 主要な商品には get_related_items で必要な付属品をリストアップ",
            "4. 以下の3フェーズに分けてチェックリストを出力：",
            "",
            "   【フェーズ1: 初日必須（引越し当日に絶対必要）】",
            "   - カーテン（防犯・プライバシー確保。採寸は内見時に必須）",
            "   - 寝具（布団/マットレス＋枕＋シーツ）",
            "   - 照明（物件に付属していない場合）",
            "   - トイレットペーパー、タオル、洗面用具",
            "   - スマホ充電器、ハサミ・カッター",
            "",
            "   【フェーズ2: 1週間以内（生活を回すのに必要）】",
            "   - 冷蔵庫（一人暮らし150-200L/二人以上300L目安）",
            "   - 洗濯機（5-6kg/ドラム式は乾燥まで自動で時短効果大）",
            "   - 電子レンジ（17-20L）",
            "   - 収納用品（備え付けだけでは足りないことが多い）",
            "",
            "   【フェーズ3: 1ヶ月以内（実際に住んで必要性を判断してから）】",
            "   - テレビ（スマホ/タブレットで代替可能。不要だった家電1位）",
            "   - ソファ（部屋を圧迫しがち。不要だった家具上位）",
            "   - 食器棚（カラーボックスで代用できる場合も多い）",
            "",
            "5. 部屋ごとに分類し、各アイテムに価格帯と購入リンクを付ける",
            "6. 「買い忘れ注意」セクションを追加（カーテン・収納用品・洗剤スポンジが3大盲点）",
            "7. 最後に全体の予算目安を合計（最低限15-25万円/標準28-53万円が一人暮らし相場）",
            "",
            "各商品のaffiliate_urlを必ず含めてください。",
          ].filter(Boolean).join("\n"),
        },
      }],
    })
  );

  server.prompt(
    "product_showdown",
    {
      product_a: z.string().describe("比較する商品A（例: ニトリ Nクリック 3段）"),
      product_b: z.string().describe("比較する商品B（例: IKEA KALLAX 2×2）"),
      use_case: z.string().optional().describe("利用シーン（例: 子供部屋のおもちゃ収納）"),
    },
    async ({ product_a, product_b, use_case }) => ({
      messages: [{
        role: "user" as const,
        content: {
          type: "text" as const,
          text: [
            `「${product_a}」と「${product_b}」を徹底比較してください。`,
            use_case ? `利用シーン: ${use_case}` : "",
            "",
            "以下の手順で進めてください：",
            `1. compare_products で「${product_a}」「${product_b}」を比較`,
            "2. 両商品の get_related_items で付属品・消耗品コストも比較",
            "3. 以下の観点で比較表を作成：",
            "   - サイズ（外寸・内寸）",
            "   - 価格（本体＋付属品のトータルコスト）",
            "   - 耐荷重・素材・組立難易度",
            "   - 対応する収納ボックス・パーツの豊富さ",
            "   - ランニングコスト（消耗品がある場合）",
            `4. ${use_case ? `「${use_case}」という用途での` : ""}結論とおすすめを提示`,
            "",
            "各商品のaffiliate_urlを必ず含めてください。",
          ].filter(Boolean).join("\n"),
        },
      }],
    })
  );
}
