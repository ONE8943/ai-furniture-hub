# AI Furniture & Home Product Hub - MCP Server

> **15 tools** | **300+ curated products** | **31 categories** | **80+ brands**
> Millimeter-precision search, curated sets, AI visibility diagnosis, OpenAPI 3.1 schema.
> Built for ChatGPT, Claude, Gemini, Cursor, Perplexity, and any MCP-compatible AI agent.

[![CI](https://github.com/ONE8943/ai-furniture-hub/actions/workflows/ci.yml/badge.svg)](https://github.com/ONE8943/ai-furniture-hub/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/ai-furniture-hub)](https://www.npmjs.com/package/ai-furniture-hub)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Why This Exists

AI agents need structured, machine-optimized product data to make useful recommendations. This MCP server provides:

- **Exact-fit search**: "Find a shelf that fits a 425mm gap" returns products with 1mm accuracy
- **Complete solutions**: One search returns the shelf + matching storage boxes + floor protection + cable organizers
- **Curated by experts**: Influencer picks, room presets, bundle deals, and budget hack alternatives
- **Replacement intelligence**: Discontinued product? Get successors ranked by dimension compatibility (fit_score 0-100)
- **AI visibility consulting**: Diagnose any website's AI discoverability with a single tool call

## Quick Start

### Option 1: Remote (no install)

Connect directly to the hosted server:

```json
{
  "mcpServers": {
    "furniture-hub": {
      "url": "https://ai-furniture-hub.onrender.com/mcp"
    }
  }
}
```

### Option 2: npx (local)

```bash
npx ai-furniture-hub
```

### Option 3: Clone & Run

```bash
git clone https://github.com/ONE8943/ai-furniture-hub.git
cd ai-furniture-hub
npm install
cp .env.example .env   # API keys optional - works with mock data
npm start               # stdio mode
npm run start:http      # HTTP mode at localhost:3000/mcp
```

## Tools (15)

### Search & Discovery

| Tool | What It Does |
|------|-------------|
| `search_products` | Search 300+ products by keyword, dimensions (mm), price, color, category, brand |
| `get_product_detail` | Full specs: inner dimensions, consumables, compatible storage, curations |
| `search_rakuten_products` | Real-time Rakuten Ichiba search (200K+ listings with prices & reviews) |
| `search_amazon_products` | Amazon affiliate search URL generation with auto SearchIndex |
| `suggest_by_space` | "I have a 600x400mm space" -> everything that fits, rotation-aware |
| `identify_product` | Visual description -> product candidates with model numbers |

### Coordination & Comparison

| Tool | What It Does |
|------|-------------|
| `coordinate_storage` | Shelf + storage box set proposals: quantity per tier, total cost |
| `compare_products` | Side-by-side comparison (2-5 products) on price, size, load, reviews |
| `find_replacement` | Discontinued model -> successors + dimension-compatible alternatives with `fit_score` |
| `calc_room_layout` | Floor-plan rectangle packing with placement coordinates |
| `get_related_items` | Accessory chains: required items, protection, consumables, hack substitutes (depth 1-2) |

### Curation & Intelligence

| Tool | What It Does |
|------|-------------|
| `get_curated_sets` | Bundles, room presets, influencer picks, hack sets. Filter by type/scene/budget |
| `get_popular_products` | Trending products by category with Rakuten data |
| `list_categories` | Browse 31 categories with counts, brands, samples |
| `diagnose_ai_visibility` | AI visibility audit: llms.txt, robots.txt, JSON-LD, OGP, score 0-100 |

### Prompt Workflows (3)

| Prompt | Flow |
|--------|------|
| `room_coordinator` | Space dimensions -> shelf + boxes + protection with quantities & cost |
| `moving_checklist` | Floor plan type -> room-by-room purchasing checklist with budget |
| `product_showdown` | Two products -> full comparison including accessories & running costs |

## Product Categories (31)

| Area | Categories |
|------|-----------|
| **Storage** | Shelves, Color boxes, Storage cases, Clothing storage, Steel racks, Closet storage, File storage |
| **Furniture** | Desks, TV stands, Bookshelves, Dining, Sofas & chairs, Bedding |
| **Room-specific** | Kitchen, Laundry, Bath, Entrance, Baby safety |
| **Hardware** | Tension rods, Protection materials, Parts & accessories, Wagons |
| **Appliances** | Home appliances, Kitchen appliances, Air quality, Smart home |
| **Tech & Lifestyle** | PC peripherals, Beauty devices, Gadgets, Health & fitness |
| **Decor** | Curtains & blinds |

## Key Features

### Cinderella-Fit Search
All dimensions in millimeters - outer AND inner. Find products that fit a specific space with 1mm tolerance. Rotation-aware: automatically checks if swapping width/depth creates a fit.

### Related-Item Chains
Every product links to 3-5 related items: required accessories (HEPA filters for air purifiers), protection materials (floor mats for heavy shelves), consumables (vacuum bags), compatible storage boxes.

### Curated Sets
- **Bundles**: "New Life Starter Kit", "Work From Home Set"
- **Room Presets**: IKEA-style complete room configurations
- **Influencer Picks**: Real recommendations from YouTubers and magazines
- **Hack Sets**: Budget alternatives (100-yen substitutes for 1000-yen accessories)

### Dimension-Compatible Replacement
Discontinued product? `find_replacement` returns:
- DB-registered successors
- Dimension-compatible alternatives with `fit_score` (0-100)
- Live Rakuten search results

### AI Visibility Diagnosis (AIO)
`diagnose_ai_visibility` audits any URL:
- llms.txt presence
- robots.txt AI crawler access
- Structured data (JSON-LD, Schema.org)
- OGP tags
- Cross-border readiness (English metadata, multi-currency)
- Returns score (0-100), grade (A-F), actionable recommendations

### Attribution & Analytics
Every API response includes `_attribution` metadata with a unique `attribution_id`, enabling:
- Per-call tracking for pay-per-call monetization
- Source detection (Apify, RapidAPI, direct)
- Contribution logging for revenue attribution

## API & Integration

### OpenAPI 3.1 Schema
Full OpenAPI spec available at [`/openapi.yaml`](https://ai-furniture-hub.onrender.com/openapi.yaml) for RapidAPI and marketplace integration.

### AI Discovery Endpoints

| File | URL | Purpose |
|------|-----|---------|
| llms.txt | [/llms.txt](https://ai-furniture-hub.onrender.com/llms.txt) | AI agent overview |
| llms-full.txt | [/llms-full.txt](https://ai-furniture-hub.onrender.com/llms-full.txt) | Full tool schemas & examples |
| OpenAPI | [/openapi.yaml](https://ai-furniture-hub.onrender.com/openapi.yaml) | REST API specification |
| Server Card | [/.well-known/mcp/server-card.json](https://ai-furniture-hub.onrender.com/.well-known/mcp/server-card.json) | Machine-readable metadata |
| context.md | [/context.md](https://ai-furniture-hub.onrender.com/context.md) | Structured AI context |
| robots.txt | [/robots.txt](https://ai-furniture-hub.onrender.com/robots.txt) | AI crawler permissions |

### MCP Resources
```
furniture-hub://llms.txt
furniture-hub://llms-full.txt
```

## Architecture

```
AI Agent (ChatGPT, Claude, Gemini, Cursor, Perplexity, ...)
    | MCP (stdio or Streamable HTTP)
    v
+-----------------------------------------------------------+
|  15 Tools + 3 Prompts                                     |
+-----------------------------------------------------------+
|  300+ Products | 31 Categories | 80+ Brands               |
|  Curated Sets: bundles, room presets, influencer picks     |
|  Compatibility DB: dimension-based fit scoring             |
|  Attribution: per-request tracking with attribution_id     |
+-----------------------------------------------------------+
|  Adapters: Rakuten API / Amazon URL / Nitori               |
|  Affiliate Engine + Gap Detector + Analytics               |
+-----------------------------------------------------------+
    |
    v
  /llms.txt        /llms-full.txt        /openapi.yaml
  /context.md      /.well-known/mcp/     /robots.txt
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DEPLOYMENT_MODE` | No | `private` (default, affiliate ON) or `public` (affiliate OFF for marketplace) |
| `AFFILIATE_ID_AMAZON` | No | Amazon Associate tag |
| `AFFILIATE_ID_RAKUTEN` | No | Rakuten Affiliate ID |
| `RAKUTEN_APP_ID` | No | Rakuten API Application ID |
| `RAKUTEN_API_MOCK` | No | `true` (default) for mock data, `false` for live |

All environment variables are optional. The server works out of the box with mock data.

## Deployment

| Platform | URL |
|----------|-----|
| **Render** | `https://ai-furniture-hub.onrender.com/mcp` |
| **npm** | `npx ai-furniture-hub` |

## Testing

```bash
npm run test:ci      # Vitest
npm run test:all     # Full legacy suite
```

## Contributing

Issues and PRs welcome. See [GitHub Issues](https://github.com/ONE8943/ai-furniture-hub/issues).

## License

MIT

---

## Japanese / 日本語

**AI Furniture & Home Product Hub** は家具・家電・ガジェット等のAIエージェント向けMCPサーバーです。

- **300+商品、31カテゴリ、80+ブランド** のキュレーション済みカタログ
- **mm精度の寸法検索** - 「幅425mmの隙間にぴったり収まる棚」を即座に発見
- **関連アイテムチェーン** - 1商品から3-5個の関連商品（必須アクセサリ、保護材、消耗品）
- **キュレーション** - バンドル提案、ルームプリセット、インフルエンサーおすすめ、100均代用ハック
- **後継品検索** - 廃番商品から寸法互換の代替品をfit_scoreで提案
- **AI可視性診断（AIO）** - Webサイトの「AIからの見え方」を0-100でスコアリング
- **OpenAPI 3.1** - RapidAPI等のマーケットプレイス連携対応

### 運営

ONE, Inc.
