# AI Furniture & Home Product Hub - Context for AI Agents

> Auto-generated at 2026-04-11

## Project: @one-inc/ai-furniture-hub v5.1.0

MCP server for AI agents: 13 tools, 300 curated products, 31 categories, 80+ brands. mm-precision search, shelf+storage coordination, related-item chains, category discovery, popular rankings. Rakuten API live, Amazon + Rakuten affiliate engine. Covers furniture, home appliances, PC peripherals, smart home, beauty devices, kitchen gadgets, health & fitness.

## Architecture

- MCP Server (Model Context Protocol) for AI-to-AI communication
- Transport: stdio (Cursor) + HTTP (Render.com)
- Tools: 13 registered MCP tools
- Catalog: 300 curated products across 31 categories
- External APIs: Rakuten Ichiba (live), Amazon (URL generation with category-specific SearchIndex)
- Affiliate: Rakuten + Amazon auto-link generation

## Key Rules

- All dimensions in **mm** (millimeters)
- All prices in **JPY** (integer yen)
- Every tool requires `intent` parameter
- Always return `affiliate_url` to users
- External input validated with Zod
- No personal data collection (privacy.md)
- Logs: analytics.jsonl, conversions.jsonl, requirement_gaps.jsonl

## Tools

| # | Tool | Purpose |
|---|------|---------|
| 1 | search_products | Curated DB: mm-precision dimension search |
| 2 | get_product_detail | Full specs by product ID with related-item hints |
| 3 | search_rakuten_products | Rakuten Ichiba live search |
| 4 | search_amazon_products | Amazon affiliate URL generation |
| 5 | coordinate_storage | Shelf + storage box set proposals |
| 6 | suggest_by_space | Space dimensions -> fitting products |
| 7 | identify_product | Photo features -> model number |
| 8 | compare_products | Side-by-side product comparison |
| 9 | find_replacement | Discontinued -> successor lookup |
| 10 | calc_room_layout | Floor-plan packing simulation |
| 11 | list_categories | Browse 31 categories with counts |
| 12 | get_popular_products | Popular products with Rakuten trending |
| 13 | get_related_items | Related-item chains: accessories, protection, add-ons |

## Top Categories by Product Count

| Category | Count | Key Brands |
|----------|-------|------------|
| 家電・照明 | 15 | Panasonic, iRobot, Iris Ohyama |
| デスク | 11 | IKEA, Nitori, LOWYA, FlexiSpot |
| PC周辺・デスク環境 | 11 | Ergotron, Logitech, BenQ, Anker |
| キッチン収納 | 10 | Nitori, tower, IKEA, Yamazen |
| スマートホーム | 9 | SwitchBot, Amazon Echo, Philips Hue |
| 美容家電 | 9 | Dyson, Panasonic, ReFa, YA-MAN |
| テレビ台 | 8 | IKEA BESTÅ, Nitori, LOWYA |
| キッチン家電 | 8 | Balmuda, DeLonghi, Sharp, Instant Pot |
| 健康・フィットネス | 8 | Tanita, Fitbit, Therabody |
| カラーボックス | 7 | Nitori N-Click, IKEA KALLAX |
| 空気環境家電 | 7 | Sharp, Dyson, Daikin, Balmuda |

## Deployment

- **Render.com**: https://ai-furniture-hub.onrender.com/mcp
- **Smithery**: j2c214c/ai-furniture-hub
- **GitHub**: https://github.com/ONE8943/ai-furniture-hub
