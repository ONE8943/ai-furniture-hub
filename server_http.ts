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
import { refreshProductStore, getAllProducts } from "./data/product_store";
import { checkRateLimit, TIER_CONFIGS, type RateLimitResult } from "./lib/rate_limiter";
import { validateApiKeyCompat, type KeyValidation } from "./lib/api_key_store";
import { KNOWN_PRODUCTS_DB } from "./shared/catalog/known_products";
import { resolveInnerDimensions } from "./shared/catalog/dimension_resolver";

const VERSION = "6.4.0";
const HTTP_PORT = parseInt(process.env["PORT"] ?? process.env["MCP_HTTP_PORT"] ?? "3000", 10);
const LEGACY_API_KEY = process.env["MCP_API_KEY"] ?? "";

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

  function extractBearerToken(req: IncomingMessage): string | undefined {
    const auth = req.headers["authorization"];
    if (auth?.startsWith("Bearer ")) return auth.slice(7);
    const qKey = new URL(req.url ?? "/", `http://${req.headers.host}`).searchParams.get("api_key");
    return qKey ?? undefined;
  }

  function getClientIp(req: IncomingMessage): string {
    const xff = req.headers["x-forwarded-for"];
    if (typeof xff === "string") return xff.split(",")[0]!.trim();
    return req.socket.remoteAddress ?? "unknown";
  }

  /**
   * 認証 + レート制限チェック。
   * 通過したらリクエストに tier 情報を付与して true を返す。
   */
  function authAndRateLimit(req: IncomingMessage, res: ServerResponse): { ok: boolean; keyInfo?: KeyValidation; rateLimit?: RateLimitResult } {
    const token = extractBearerToken(req);
    const keyInfo = validateApiKeyCompat(token, LEGACY_API_KEY || undefined);

    if (!keyInfo.valid) {
      jsonResp(res, 401, { error: "Invalid API key" });
      return { ok: false };
    }

    const ip = getClientIp(req);
    const rl = checkRateLimit(ip, token, keyInfo.tier);

    res.setHeader("X-RateLimit-Limit", String(rl.limit === Infinity ? "unlimited" : rl.limit));
    res.setHeader("X-RateLimit-Remaining", String(rl.remaining === Infinity ? "unlimited" : rl.remaining));
    res.setHeader("X-RateLimit-Tier", rl.tier);
    if (rl.resetAt > 0) res.setHeader("X-RateLimit-Reset", String(Math.floor(rl.resetAt / 1000)));

    if (!rl.allowed) {
      res.writeHead(429, { "Content-Type": "application/json", "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)) });
      res.end(JSON.stringify({
        error: "Rate limit exceeded",
        tier: rl.tier,
        limit: rl.limit,
        reset_at: new Date(rl.resetAt).toISOString(),
        upgrade_hint: rl.tier === "anonymous"
          ? "Register a free API key for 500 queries/month. See /health for details."
          : "Upgrade to Pro tier for unlimited access.",
      }));
      return { ok: false };
    }

    return { ok: true, keyInfo, rateLimit: rl };
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
      jsonResp(res, 200, {
        status: "ok",
        version: VERSION,
        rate_limits: {
          anonymous: { monthly_limit: TIER_CONFIGS.anonymous.monthlyLimit, curated_dimensions: false },
          free: { monthly_limit: TIER_CONFIGS.free.monthlyLimit, curated_dimensions: true },
          pro: { monthly_limit: "unlimited", curated_dimensions: true },
        },
      });
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
      "/AGENTS.md": { file: "public/AGENTS.md", mime: "text/markdown; charset=utf-8" },
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

    // ── /api/fit-check: Dimension-based fit checking REST API ──
    if (url.startsWith("/api/fit-check") && (req.method === "GET" || req.method === "POST")) {
      const auth = authAndRateLimit(req, res);
      if (!auth.ok) return;

      let width = 0, height = 0, depth = 0, category = "";
      if (req.method === "GET") {
        const qp = new URL(req.url!, `http://${req.headers.host}`).searchParams;
        width = parseInt(qp.get("width_mm") ?? "0", 10);
        height = parseInt(qp.get("height_mm") ?? "0", 10);
        depth = parseInt(qp.get("depth_mm") ?? "0", 10);
        category = qp.get("category") ?? "";
      } else {
        try {
          const body = JSON.parse(await readBody(req));
          width = body.width_mm ?? 0;
          height = body.height_mm ?? 0;
          depth = body.depth_mm ?? 0;
          category = body.category ?? "";
        } catch {
          jsonResp(res, 400, { error: "Invalid JSON body" });
          return;
        }
      }

      if (width <= 0 || height <= 0 || depth <= 0) {
        jsonResp(res, 400, { error: "width_mm, height_mm, depth_mm are required (positive integers, mm)" });
        return;
      }

      const showCurated = auth.keyInfo?.tier !== "anonymous";
      const fits: Array<{
        id: string; name: string; brand: string; category: string;
        outer: { width_mm: number; height_mm: number; depth_mm: number };
        inner: { width_mm: number; height_per_tier_mm: number; depth_mm: number; source: string } | null;
        fits_in_space: boolean; clearance: { width_mm: number; height_mm: number; depth_mm: number };
        compatible_storage_count: number;
      }> = [];

      const products = KNOWN_PRODUCTS_DB.filter((p) => {
        if (category && p.category !== category) return false;
        return p.outer_width_mm <= width && p.outer_height_mm <= height && p.outer_depth_mm <= depth;
      });

      for (const p of products.slice(0, 30)) {
        const resolved = resolveInnerDimensions(p);
        const innerResult = resolved
          ? (showCurated || resolved.source === "estimated"
            ? { width_mm: resolved.inner_width_mm, height_per_tier_mm: resolved.inner_height_per_tier_mm, depth_mm: resolved.inner_depth_mm, source: resolved.source }
            : { width_mm: resolved.inner_width_mm, height_per_tier_mm: resolved.inner_height_per_tier_mm, depth_mm: resolved.inner_depth_mm, source: "estimated" })
          : null;

        fits.push({
          id: p.id,
          name: p.name,
          brand: p.brand,
          category: p.category ?? "その他",
          outer: { width_mm: p.outer_width_mm, height_mm: p.outer_height_mm, depth_mm: p.outer_depth_mm },
          inner: innerResult,
          fits_in_space: true,
          clearance: {
            width_mm: width - p.outer_width_mm,
            height_mm: height - p.outer_height_mm,
            depth_mm: depth - p.outer_depth_mm,
          },
          compatible_storage_count: p.compatible_storage.length,
        });
      }

      fits.sort((a, b) => {
        const aTotal = a.clearance.width_mm + a.clearance.height_mm + a.clearance.depth_mm;
        const bTotal = b.clearance.width_mm + b.clearance.height_mm + b.clearance.depth_mm;
        return aTotal - bTotal;
      });

      jsonResp(res, 200, {
        query: { width_mm: width, height_mm: height, depth_mm: depth, category: category || undefined },
        total: fits.length,
        tier: auth.rateLimit?.tier ?? "anonymous",
        curated_dimensions: showCurated,
        products: fits,
      });
      return;
    }

    // Streamable HTTP (modern MCP transport)
    if (url === "/mcp") {
      const auth = authAndRateLimit(req, res);
      if (!auth.ok) return;

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
      const authSse = authAndRateLimit(req, res);
      if (!authSse.ok) return;
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
      `  Fit-Check Demo:  http://localhost:${HTTP_PORT}/\n` +
      `  Rate Limits:     anonymous=${TIER_CONFIGS.anonymous.monthlyLimit}/mo, free=${TIER_CONFIGS.free.monthlyLimit}/mo, pro=unlimited\n`
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
