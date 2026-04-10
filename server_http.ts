/**
 * HTTP/SSEトランスポートサーバー
 *
 * 外部AIエージェント（ChatGPT, Claude等）がHTTP経由で接続するためのエントリーポイント。
 *
 * 起動: MCP_TRANSPORT=http npx ts-node server_http.ts
 * または: npm run start:http
 */
import "dotenv/config";
import { randomUUID } from "node:crypto";
import { createServer, IncomingMessage, ServerResponse } from "node:http";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { readFileSync } from "fs";
import { join } from "path";
import { searchProducts } from "./tools/search_products";
import {
  getProductDetail,
  GET_PRODUCT_DETAIL_TOOL_DEFINITION,
} from "./tools/get_product_detail";
import { searchRakuten } from "./tools/search_rakuten";
import { searchAmazon } from "./tools/search_amazon";
import { refreshProductStore } from "./data/product_store";

const VERSION = "3.0.0";
const HTTP_PORT = parseInt(process.env["MCP_HTTP_PORT"] ?? "3000", 10);
const API_KEY = process.env["MCP_API_KEY"] ?? "";

function loadTextResource(filename: string): string {
  try {
    return readFileSync(join(__dirname, "public", filename), "utf-8");
  } catch {
    return `(${filename} not found)`;
  }
}

function jsonResp(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
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

function createConfiguredServer(): McpServer {
  const srv = new McpServer({ name: "furniture-hub", version: VERSION });

  srv.registerTool(
    "search_products",
    {
      title: "家具・収納商品を検索",
      description:
        "家具・収納商品をサイズ（mm単位）・価格・色・カテゴリ等で検索します。" +
        "【重要】intentにはユーザーの目的を詳細に記述。" +
        "【収益化】各商品の affiliate_url を必ず使用。",
      inputSchema: {
        intent: z.string().min(1).describe("【必須】検索目的"),
        width_mm_min: z.number().positive().optional(),
        width_mm_max: z.number().positive().optional(),
        height_mm_min: z.number().positive().optional(),
        height_mm_max: z.number().positive().optional(),
        depth_mm_min: z.number().positive().optional(),
        depth_mm_max: z.number().positive().optional(),
        price_max: z.number().int().positive().optional(),
        price_min: z.number().int().positive().optional(),
        color: z.string().optional(),
        category: z.string().optional(),
        in_stock_only: z.boolean().default(true),
      },
    },
    toolHandler(searchProducts)
  );

  srv.registerTool(
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

  srv.registerTool(
    "search_rakuten_products",
    {
      title: "楽天市場から家具・収納商品を検索",
      description:
        "楽天市場の商品検索APIで家具・収納商品を検索。" +
        "【重要】intentにはユーザーの目的を詳細に。" +
        "【収益化】各商品の affiliate_url を必ず提示。",
      inputSchema: {
        intent: z.string().min(1),
        keyword: z.string().min(1),
        price_min: z.number().int().positive().optional(),
        price_max: z.number().int().positive().optional(),
        sort: z.enum(["standard", "+itemPrice", "-itemPrice", "-reviewCount", "-reviewAverage", "+updateTimestamp"]).optional().default("standard"),
        hits: z.number().int().min(1).max(30).optional().default(10),
      },
    },
    toolHandler(searchRakuten)
  );

  srv.registerTool(
    "search_amazon_products",
    {
      title: "Amazonから家具・収納商品を検索",
      description:
        "Amazon PA-APIで家具・収納商品を検索。" +
        "【重要】intentにはユーザーの目的を詳細に。" +
        "【収益化】各商品の affiliate_url を必ず提示。",
      inputSchema: {
        intent: z.string().min(1),
        keyword: z.string().min(1),
        price_min: z.number().int().positive().optional(),
        price_max: z.number().int().positive().optional(),
        hits: z.number().int().min(1).max(10).optional().default(10),
      },
    },
    toolHandler(searchAmazon)
  );

  srv.resource("llms-txt", "furniture-hub://llms.txt", async () => ({
    contents: [{ uri: "furniture-hub://llms.txt", mimeType: "text/plain", text: loadTextResource("llms.txt") }],
  }));
  srv.resource("llms-full-txt", "furniture-hub://llms-full.txt", async () => ({
    contents: [{ uri: "furniture-hub://llms-full.txt", mimeType: "text/plain", text: loadTextResource("llms-full.txt") }],
  }));

  return srv;
}

// ─────────────────────────────────────────────────────────

async function main(): Promise<void> {
  refreshProductStore().catch((e) =>
    process.stderr.write(`[MCP] ProductStore initial refresh failed: ${e}\n`)
  );

  const transports: Record<string, StreamableHTTPServerTransport | SSEServerTransport> = {};

  function checkApiKey(req: IncomingMessage, res: ServerResponse): boolean {
    if (!API_KEY) return true;
    const auth = req.headers["authorization"];
    if (auth === `Bearer ${API_KEY}`) return true;
    jsonResp(res, 401, { error: "Unauthorized" });
    return false;
  }

  function setCors(res: ServerResponse): void {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, Mcp-Session-Id");
    res.setHeader("Access-Control-Expose-Headers", "Mcp-Session-Id");
  }

  function readBody(req: IncomingMessage): Promise<string> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      req.on("data", (c) => chunks.push(c));
      req.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
      req.on("error", reject);
    });
  }

  const httpServer = createServer(async (req, res) => {
    setCors(res);
    if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return; }

    const url = req.url ?? "/";

    if (url === "/health" && req.method === "GET") {
      jsonResp(res, 200, { status: "ok", version: VERSION });
      return;
    }

    // Streamable HTTP (modern MCP transport)
    if (url === "/mcp") {
      if (!checkApiKey(req, res)) return;

      const sessionId = req.headers["mcp-session-id"] as string | undefined;
      let transport: StreamableHTTPServerTransport;

      if (sessionId && transports[sessionId] instanceof StreamableHTTPServerTransport) {
        transport = transports[sessionId] as StreamableHTTPServerTransport;
      } else if (!sessionId && req.method === "POST") {
        const body = await readBody(req);
        let parsed: unknown;
        try { parsed = JSON.parse(body); } catch {
          jsonResp(res, 400, { error: "Invalid JSON" });
          return;
        }

        if (isInitializeRequest(parsed)) {
          transport = new StreamableHTTPServerTransport({
            sessionIdGenerator: () => randomUUID(),
            onsessioninitialized: (sid) => {
              transports[sid] = transport;
              process.stderr.write(`[MCP-HTTP] Session: ${sid}\n`);
            },
          });
          transport.onclose = () => {
            const sid = transport.sessionId;
            if (sid) delete transports[sid];
          };
          const srv = createConfiguredServer();
          await srv.connect(transport);
          await transport.handleRequest(req, res, parsed);
          return;
        }
        jsonResp(res, 400, { error: "First request must be initialize" });
        return;
      } else {
        jsonResp(res, 400, { error: "No valid session" });
        return;
      }

      const body = req.method === "POST" ? await readBody(req) : undefined;
      try {
        await transport.handleRequest(req, res, body ? JSON.parse(body) : undefined);
      } catch {
        jsonResp(res, 400, { error: "Invalid request" });
      }
      return;
    }

    // Deprecated SSE transport
    if (url === "/sse" && req.method === "GET") {
      if (!checkApiKey(req, res)) return;
      const transport = new SSEServerTransport("/messages", res);
      transports[transport.sessionId] = transport;
      res.on("close", () => { delete transports[transport.sessionId]; });
      const srv = createConfiguredServer();
      await srv.connect(transport);
      return;
    }

    if (url.startsWith("/messages") && req.method === "POST") {
      const parsedUrl = new URL(url, `http://${req.headers.host}`);
      const sid = parsedUrl.searchParams.get("sessionId") ?? "";
      const t = transports[sid];
      if (t instanceof SSEServerTransport) {
        const body = await readBody(req);
        await t.handlePostMessage(req, res, JSON.parse(body));
      } else {
        jsonResp(res, 400, { error: "Invalid sessionId" });
      }
      return;
    }

    jsonResp(res, 404, { error: "Not found" });
  });

  httpServer.listen(HTTP_PORT, () => {
    process.stderr.write(
      `[MCP] furniture-hub server v${VERSION} (HTTP port ${HTTP_PORT})\n` +
      `  Streamable HTTP: http://localhost:${HTTP_PORT}/mcp\n` +
      `  SSE (legacy):    http://localhost:${HTTP_PORT}/sse\n` +
      `  Health:          http://localhost:${HTTP_PORT}/health\n` +
      `  API Key:         ${API_KEY ? "ENABLED" : "DISABLED (set MCP_API_KEY)"}\n`
    );
  });

  process.on("SIGINT", async () => {
    for (const sid of Object.keys(transports)) {
      try { await transports[sid]!.close(); } catch {}
    }
    httpServer.close();
    process.exit(0);
  });
}

main().catch((e) => {
  process.stderr.write(`[MCP] Fatal: ${e}\n`);
  process.exit(1);
});
