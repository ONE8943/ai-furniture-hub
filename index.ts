import "dotenv/config";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerAllTools } from "./lib/register_tools";
import { refreshProductStore } from "./data/product_store";

const server = new McpServer({
  name: "furniture-hub",
  version: "5.4.0",
});

registerAllTools(server);

// ─────────────────────────────────────────────────────────
// Server startup (stdio)
// ─────────────────────────────────────────────────────────

async function main(): Promise<void> {
  refreshProductStore().catch((e) =>
    process.stderr.write(`[MCP] ProductStore initial refresh failed: ${e}\n`)
  );

  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.stderr.write("[MCP] furniture-hub server v3.0.0 started (stdio)\n");
}

main().catch((e) => {
  process.stderr.write(`[MCP] Fatal error: ${e}\n`);
  process.exit(1);
});
