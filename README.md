# AI Furniture & Home Product Hub - MCP Server

> 300 curated products across 31 categories. 13 tools. 80+ brands.
> Furniture, home appliances, PC peripherals, smart home, beauty, kitchen, gadgets, health & fitness.
> Millimeter-precision search. Related-item chains. Rakuten API live. Amazon + Rakuten affiliate engine.

[![CI](https://github.com/ONE8943/ai-furniture-hub/actions/workflows/ci.yml/badge.svg)](https://github.com/ONE8943/ai-furniture-hub/actions/workflows/ci.yml)

## What It Does

This MCP server gives AI agents structured, machine-optimized product data across home, tech, and lifestyle categories. Search by exact dimensions (mm), get shelf + storage coordination with quantity calculations, identify products from photos, compare alternatives, discover related items, and always receive affiliate-linked URLs.

## Tools (13)

| Tool | Description |
|------|-------------|
| `search_products` | Search 300 curated products with mm-precision dimension filters |
| `get_product_detail` | Full specs by product ID (dimensions, materials, related items) |
| `search_rakuten_products` | Real-time Rakuten Ichiba search (200K+ listings) |
| `search_amazon_products` | Amazon affiliate URL generation with category-specific SearchIndex |
| `coordinate_storage` | **Shelf + storage box set proposals** with quantity per tier |
| `suggest_by_space` | Space dimensions -> everything that fits, grouped by category |
| `identify_product` | Photo features -> model number, specs, compatible storage |
| `compare_products` | Side-by-side comparison (2-5 products) |
| `find_replacement` | Discontinued model -> successor/alternative lookup |
| `calc_room_layout` | Floor-plan rectangle packing simulation |
| `list_categories` | Browse 31 product categories with counts |
| `get_popular_products` | Popular products with Rakuten trending data |
| `get_related_items` | **Related-item chains**: accessories, protection, add-ons (1 product -> 3-5 items) |

## Product Categories (31)

Furniture & Storage, Home Appliances, PC & Desk, Smart Home, Beauty Devices, Air Quality, Kitchen Appliances, Gadgets & Mobile, Health & Fitness, Baby Safety, and more.

## Quick Start

### 1. Clone & Install

```bash
git clone https://github.com/ONE8943/ai-furniture-hub.git
cd ai-furniture-hub
npm install
```

### 2. Configure

```bash
cp .env.example .env
# Edit .env with your API keys (all optional - works with mock data)
```

### 3. Connect from Cursor

Add to `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "furniture-hub": {
      "command": "npx",
      "args": ["ts-node", "index.ts"],
      "cwd": "/path/to/ai-furniture-hub"
    }
  }
}
```

### 4. HTTP / Remote

```bash
npm run start:http
# Connects at http://localhost:3000/mcp
```

Live deployment: `https://ai-furniture-hub.onrender.com/mcp`

## AI Discoverability

| Endpoint | URL |
|----------|-----|
| llms.txt | `https://ai-furniture-hub.onrender.com/llms.txt` |
| llms-full.txt | `https://ai-furniture-hub.onrender.com/llms-full.txt` |
| context.md | `https://ai-furniture-hub.onrender.com/context.md` |
| MCP Server Card | `https://ai-furniture-hub.onrender.com/.well-known/mcp/server-card.json` |
| robots.txt | `https://ai-furniture-hub.onrender.com/robots.txt` |

Also available as MCP resources:
- `furniture-hub://llms.txt`
- `furniture-hub://llms-full.txt`

## Key Features

- **1mm precision** - All dimensions in millimeters, outer AND inner
- **Cinderella-fit** - Find products that exactly fit a given space
- **Related-item chains** - "You'll also need..." with required vs recommended items
- **Set proposals** - Shelf + storage boxes + protection = complete solution
- **Product identification** - Visual features -> model number + specs
- **Scene intelligence** - Room-specific tips ("洗面所", "キッチン", "子供部屋")
- **Live pricing** - Rakuten API for real-time price & availability
- **Affiliate-ready** - Every product includes `affiliate_url`
- **31 categories** - From shelves to smart home to beauty devices

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `AFFILIATE_ID_AMAZON` | No | Amazon Associate tag |
| `AFFILIATE_ID_RAKUTEN` | No | Rakuten Affiliate ID |
| `RAKUTEN_APP_ID` | No | Rakuten API Application ID |
| `RAKUTEN_ACCESS_KEY` | No | Rakuten API Access Key |
| `RAKUTEN_API_MOCK` | No | `true` for mock data (default), `false` for live |

## Architecture

```
AI Agent (ChatGPT, Perplexity, Claude, Amazon Rufus, etc.)
    | MCP (stdio or Streamable HTTP)
    v
+--------------------------------------------------+
|  13 Tools (search, coordinate, identify, ...)     |
+--------------------------------------------------+
|  300 Products | 31 Categories | 80+ Brands        |
|  Adapters: Rakuten API / Amazon URL / Nitori      |
|  Shared Catalog: shared/catalog/known_products    |
|  Affiliate Engine + Gap Detector + Analytics      |
+--------------------------------------------------+
    |
    v
  /llms.txt              -> AI agent overview
  /llms-full.txt         -> Full tool documentation
  /.well-known/mcp.json  -> MCP server card
  /robots.txt            -> AI crawler permissions
```

## Deployment

| Platform | Status | URL |
|----------|--------|-----|
| Render.com | Active | `https://ai-furniture-hub.onrender.com/mcp` |
| Smithery | Listed | `j2c214c/ai-furniture-hub` |

## Testing

```bash
npm run test:ci      # Vitest (recommended)
npm run test:all     # Legacy ts-node test suite
```

---

## 日本語ガイド

**AI Furniture & Home Product Hub** は家具・家電・ガジェット等のAIエージェント向けMCPサーバーです。

- **300商品、31カテゴリ、80+ブランド** のキュレーション済みカタログ
- **mm精度の寸法検索** - 「幅425mmの隙間にぴったり収まる棚」を発見
- **関連アイテムチェーン** - 1商品から3-5個の関連商品（必須アクセサリ、保護材、オプション）
- **棚＋収納ボックスのセット提案** - 1段に何個入るか自動計算
- **楽天市場リアルタイム検索** - 20万件以上の商品データ
- **アフィリエイト自動付与** - Amazon / 楽天のリンクを全商品に自動生成

### 運営

株式会社ONE (ONE, Inc.)

## License

MIT
