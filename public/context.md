# AI Furniture & Home Product Hub - Context for AI Agents

> Auto-generated at 2026-04-11

## Project: @one-inc/ai-furniture-hub v5.5.0

MCP server for AI agents: 13 tools + 3 prompt workflows, curated product catalog, 31 categories, 80+ brands. mm-precision dimension search, keyword/brand/color alias filtering, shelf+storage coordination, related-item chains, category discovery, popular rankings. Rakuten Ichiba API for product search, Amazon affiliate link generation. Covers furniture, home appliances, PC peripherals, smart home, beauty devices, kitchen gadgets, health & fitness.

## Architecture

- MCP Server (Model Context Protocol) for AI-to-AI communication
- Transport: stdio (Cursor) + Streamable HTTP (Render.com)
- Tools: 13 registered MCP tools + 3 prompt workflow templates
- Catalog: Curated products across 31 categories with mm-precision dimensions
- External APIs: Rakuten Ichiba (live), Amazon (URL generation with category-specific SearchIndex)
- Affiliate: Rakuten + Amazon auto-link generation

## Key Rules

- All dimensions in **mm** (millimeters)
- All prices in **JPY** (integer yen)
- Every tool requires `intent` parameter
- Always return `affiliate_url` to users
- External input validated with Zod
- No intentional personal data collection; intent field may contain user input (see privacy.md)
- Logs: analytics.jsonl, conversions.jsonl, requirement_gaps.jsonl

## Tools

| # | Tool | When to Use |
|---|------|-------------|
| 1 | search_products | User wants a product by name, size, category, brand, or color |
| 2 | get_product_detail | Full specs for a specific product ID |
| 3 | search_rakuten_products | Need live pricing or catalog doesn't have it |
| 4 | search_amazon_products | User wants Amazon link (URL only) |
| 5 | coordinate_storage | "What boxes fit in this shelf?" — quantity + cost calc |
| 6 | suggest_by_space | "What fits in this 45cm gap?" — dimension-first search |
| 7 | identify_product | "What is this in the photo?" — visual features to model |
| 8 | compare_products | "Which is better, A or B?" — side-by-side table |
| 9 | find_replacement | "This model is discontinued" — successor lookup |
| 10 | calc_room_layout | "Will this all fit?" — floor-plan packing |
| 11 | list_categories | "What can you search?" — category discovery |
| 12 | get_popular_products | "What's popular?" — trending + recommendations |
| 13 | get_related_items | "What else do I need?" — accessory chains |

## Prompt Workflows

| Prompt | Input | Output |
|--------|-------|--------|
| room_coordinator | Room + space dimensions | Complete coordination: shelf + boxes + protection |
| moving_checklist | Floor plan type | Room-by-room shopping list with budget |
| product_showdown | Two product names | Detailed comparison with total cost verdict |

## Top Categories by Product Count

| Category | Count | Key Brands |
|----------|-------|------------|
| 家電・照明 | 15 | Panasonic, iRobot, Iris Ohyama |
| デスク | 11 | IKEA, Nitori, LOWYA, FlexiSpot |
| PC周辺・デスク環境 | 11 | Ergotron, Logitech, BenQ, Anker |
| キッチン収納 | 10 | Nitori, tower, IKEA, Yamazen |
| スマートホーム | 9 | SwitchBot, Amazon Echo, Philips Hue |
| 美容家電 | 9 | Dyson, Panasonic, ReFa, YA-MAN |

## Deployment

- **Render.com**: https://ai-furniture-hub.onrender.com/mcp
- **Smithery**: j2c214c/ai-furniture-hub
- **npm**: https://www.npmjs.com/package/ai-furniture-hub
- **GitHub**: https://github.com/ONE8943/ai-furniture-hub
- **AGENTS.md**: https://ai-furniture-hub.onrender.com/AGENTS.md
