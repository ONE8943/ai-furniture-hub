/**
 * Apify Actor エントリポイント
 *
 * Apify プラットフォーム上で MCP Hub のツールを HTTP 経由で呼び出すラッパー。
 * DEPLOYMENT_MODE=public が actor.json で強制されるため、
 * アフィリエイトタグは自動的に除外される。
 */

// Apify SDK は実行環境で利用可能（デプロイ時にインストール）
// ローカル開発時は `npm install apify` 後に型が解決される
// import { Actor } from "apify";

interface ApifyInput {
  tool: string;
  intent: string;
  query?: string;
  category?: string;
  budget_max?: number;
  curation_type?: string;
  url?: string;
}

async function main(): Promise<void> {
  // Apify SDK が利用可能な場合のみ Actor.init() を呼ぶ
  let Actor: { init: () => Promise<void>; getInput: <T>() => Promise<T | null>; pushData: (data: unknown) => Promise<void>; exit: (options?: { statusMessage?: string }) => Promise<void> } | undefined;
  try {
    const apifySdk = await import("apify");
    Actor = apifySdk.Actor as unknown as typeof Actor;
  } catch {
    console.log("[Apify] SDK not available — running in standalone mode");
  }

  if (Actor) await Actor.init();

  const input: ApifyInput = Actor
    ? (await Actor.getInput<ApifyInput>()) ?? { tool: "search_products", intent: "test" }
    : { tool: "search_products", intent: "standalone test", query: "カラーボックス" };

  console.log(`[Apify] Tool: ${input.tool}, Intent: ${input.intent}`);

  let result: unknown;

  switch (input.tool) {
    case "search_products": {
      const { searchProducts } = await import("../tools/search_products");
      result = await searchProducts({
        intent: input.intent,
        keyword: input.query,
        category: input.category,
        budget_max: input.budget_max,
      });
      break;
    }
    case "get_product_detail": {
      const { getProductDetail } = await import("../tools/get_product_detail");
      result = await getProductDetail({
        id: input.query ?? "",
        intent: input.intent,
      });
      break;
    }
    case "find_replacement": {
      const { findReplacement } = await import("../tools/find_replacement");
      result = await findReplacement({
        intent: input.intent,
        query: input.query ?? "",
      });
      break;
    }
    case "get_curated_sets": {
      const { getCuratedSets } = await import("../tools/get_curated_sets");
      result = await getCuratedSets({
        intent: input.intent,
        type: (input.curation_type as "bundle" | "room_preset" | "influencer_pick" | "hack_set" | "all") ?? "all",
      });
      break;
    }
    case "diagnose_ai_visibility": {
      const { diagnoseAiVisibility } = await import("../tools/diagnose_ai_visibility");
      result = await diagnoseAiVisibility({
        intent: input.intent,
        url: input.url ?? "",
      });
      break;
    }
    default:
      result = { error: `Unknown tool: ${input.tool}` };
  }

  if (Actor) {
    await Actor.pushData(result);
    await Actor.exit({ statusMessage: `Done: ${input.tool}` });
  } else {
    console.log(JSON.stringify(result, null, 2));
  }
}

main().catch((err) => {
  console.error("[Apify] Fatal:", err);
  process.exit(1);
});
