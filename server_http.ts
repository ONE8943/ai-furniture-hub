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
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { registerAllTools } from "./lib/register_tools";
import { refreshProductStore } from "./data/product_store";

const VERSION = "5.3.0";
const HTTP_PORT = parseInt(process.env["PORT"] ?? process.env["MCP_HTTP_PORT"] ?? "3000", 10);
const API_KEY = process.env["MCP_API_KEY"] ?? "";

function jsonResp(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

function createConfiguredServer(): McpServer {
  const srv = new McpServer({ name: "furniture-hub", version: VERSION });
  registerAllTools(srv);
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

    // Static files for AI discoverability & GEO
    const STATIC_ROUTES: Record<string, { file: string; mime: string }> = {
      "/": { file: "public/index.html", mime: "text/html; charset=utf-8" },
      "/index.html": { file: "public/index.html", mime: "text/html; charset=utf-8" },
      "/llms.txt": { file: "public/llms.txt", mime: "text/plain; charset=utf-8" },
      "/llms-full.txt": { file: "public/llms-full.txt", mime: "text/plain; charset=utf-8" },
      "/context.md": { file: "public/context.md", mime: "text/markdown; charset=utf-8" },
      "/robots.txt": { file: "public/robots.txt", mime: "text/plain; charset=utf-8" },
      "/sitemap.xml": { file: "public/sitemap.xml", mime: "application/xml; charset=utf-8" },
      "/.well-known/mcp/server-card.json": { file: ".well-known/mcp/server-card.json", mime: "application/json; charset=utf-8" },
      "/.well-known/mcp.json": { file: ".well-known/mcp/server-card.json", mime: "application/json; charset=utf-8" },
      "/.well-known/mcp-server": { file: ".well-known/mcp/server-card.json", mime: "application/json; charset=utf-8" },
    };

    const staticRoute = STATIC_ROUTES[url];
    if (staticRoute && req.method === "GET") {
      const candidates = [
        join(__dirname, "..", staticRoute.file),
        join(process.cwd(), staticRoute.file),
      ];
      for (const fp of candidates) {
        if (existsSync(fp)) {
          const content = readFileSync(fp, "utf-8");
          res.writeHead(200, {
            "Content-Type": staticRoute.mime,
            "Cache-Control": "public, max-age=3600",
          });
          res.end(content);
          return;
        }
      }
      jsonResp(res, 404, { error: `${url} not found` });
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

  httpServer.listen(HTTP_PORT, "0.0.0.0", () => {
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
