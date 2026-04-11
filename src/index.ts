/**
 * Smithery エントリーポイント
 *
 * Smithery の runtime: "typescript" が期待する形式:
 *   export const configSchema = z.object({ ... })
 *   export default function createServer({ config }) { return McpServer }
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { registerAllTools } from "../lib/register_tools";
import { refreshProductStore } from "../data/product_store";

export const configSchema = z.object({
  RAKUTEN_APP_ID: z
    .string()
    .optional()
    .describe("Rakuten API Application ID (optional: enables live search)"),
  RAKUTEN_ACCESS_KEY: z
    .string()
    .optional()
    .describe("Rakuten API Access Key"),
  AFFILIATE_ID_RAKUTEN: z
    .string()
    .optional()
    .describe("Rakuten Affiliate ID (e.g. 12345678.abcdef01.12345678.abcdef02)"),
  AFFILIATE_ID_AMAZON: z
    .string()
    .optional()
    .describe("Amazon Associate Tag for affiliate links (e.g. your-tag-22)"),
});

type Config = z.infer<typeof configSchema>;

export default function createServer({ config }: { config: Config }) {
  if (config.RAKUTEN_APP_ID) {
    process.env["RAKUTEN_APP_ID"] = config.RAKUTEN_APP_ID;
    process.env["RAKUTEN_API_MOCK"] = "false";
  }
  if (config.RAKUTEN_ACCESS_KEY) {
    process.env["RAKUTEN_ACCESS_KEY"] = config.RAKUTEN_ACCESS_KEY;
  }
  if (config.AFFILIATE_ID_RAKUTEN) {
    process.env["AFFILIATE_ID_RAKUTEN"] = config.AFFILIATE_ID_RAKUTEN;
  }
  if (config.AFFILIATE_ID_AMAZON) {
    process.env["AFFILIATE_ID_AMAZON"] = config.AFFILIATE_ID_AMAZON;
  }

  const server = new McpServer({
    name: "furniture-hub",
    version: "5.5.0",
  });

  registerAllTools(server);

  refreshProductStore().catch((e) =>
    console.error(`[MCP] ProductStore initial refresh failed: ${e}`)
  );

  return server;
}

/**
 * Smithery CLIがサーバーのツール/リソースをスキャンするために使用。
 * 本番の認証情報なしで動作する。
 */
export function createSandboxServer() {
  return createServer({
    config: {
      RAKUTEN_APP_ID: undefined,
      RAKUTEN_ACCESS_KEY: undefined,
      AFFILIATE_ID_RAKUTEN: undefined,
      AFFILIATE_ID_AMAZON: undefined,
    },
  });
}
