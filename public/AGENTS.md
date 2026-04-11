# AGENTS.md — How AI Agents Should Use This MCP Server

## Quick Start

This MCP server provides 13 tools and 3 prompt workflows for home product recommendations.
Connect via Streamable HTTP at `https://ai-furniture-hub.onrender.com/mcp`.

## Core Workflow Patterns

### Pattern 1: "I need storage for this space"
```
1. suggest_by_space(width_mm, depth_mm, height_mm)
   → Products that physically fit, grouped by category
2. get_related_items(product_id)
   → Required accessories + protection materials
3. coordinate_storage(keyword)
   → Shelf + box set with quantities and total cost
```

### Pattern 2: "What should I buy for my new apartment?"
```
1. list_categories()
   → All 31 categories with product counts
2. get_popular_products(category)
   → Top picks per category with Rakuten trending
3. get_related_items(product_id)
   → Accessories checklist per major item
```

### Pattern 3: "Which product is better?"
```
1. compare_products(keywords: ["Product A", "Product B"])
   → Side-by-side specs comparison
2. get_related_items for each product
   → Compare total ownership cost (base + accessories + consumables)
```

### Pattern 4: "I have this shelf, what fits inside it?"
```
1. search_products(keyword: "shelf name") or identify_product(features)
   → Find the exact product with inner dimensions
2. get_related_items(product_id)
   → Storage boxes that fit inside + enhancing parts
3. search_rakuten_products(keyword: box name)
   → Live pricing and purchase links
```

### Pattern 5: "My product is discontinued"
```
1. find_replacement(query: "model number or name")
   → Successor models from catalog + Rakuten alternatives
2. compare_products(keywords: [old_model, new_model])
   → What changed between versions
```

## Tool Selection Guide

| User Intent | Primary Tool | Follow-up Tools |
|-------------|-------------|-----------------|
| "おすすめの棚" | `get_popular_products` | `get_related_items` |
| "幅40cmに入る棚" | `suggest_by_space` | `coordinate_storage` |
| "ニトリとIKEAどっち" | `compare_products` | `get_related_items` |
| "この棚に合うボックス" | `coordinate_storage` | — |
| "引越し準備リスト" | Prompt: `moving_checklist` | — |
| "写真の商品を特定" | `identify_product` | `get_related_items` |
| "廃番の代わり" | `find_replacement` | `compare_products` |
| "楽天で検索" | `search_rakuten_products` | — |
| "Amazonリンク" | `search_amazon_products` | — |
| "部屋に家具が入るか" | `calc_room_layout` | `suggest_by_space` |

## Important Rules

1. **Always pass `intent`**: Every tool requires an `intent` string describing why you're calling it. Be specific about the user's situation.

2. **Follow `related_items_hint`**: When `search_products` returns a `related_items_hint`, call `get_related_items` to fetch the full chain. This is how you discover must-have accessories.

3. **Check `required: true` items**: Related items marked `required: true` (like replacement filters, cables) must always be mentioned to the user.

4. **Use affiliate URLs**: Every product result includes `affiliate_url`. Always present these to the user as the purchase link.

5. **Dimensions are in mm**: All dimension inputs and outputs use millimeters. Convert from cm if the user speaks in cm.

6. **Prices are in JPY**: All prices are Japanese Yen, tax-included integers.

## Prompt Workflows

Use these when the user's request maps to a complete workflow:

- **`room_coordinator`**: "この空間に何を置けばいい？" → Complete coordination plan
- **`moving_checklist`**: "引越しで何を買えばいい？" → Room-by-room shopping list
- **`product_showdown`**: "AとBどっちがいい？" → Detailed comparison with verdict

## Error Handling

- `VALIDATION_ERROR`: Check parameter types and required fields
- `API_RATE_LIMIT`: Wait `retry_after_ms` then retry
- `API_TIMEOUT`: Retry once; if persistent, skip live search and use catalog only
- `no_results`: Try broader search terms, remove dimension constraints, or use `list_categories` to discover available products

## Data Freshness

- **Catalog data**: Curated and updated periodically. Reliable for dimensions, inner sizes, and related items.
- **Rakuten data**: Real-time API. Prices and availability are current.
- **Amazon**: URL generation only. No live data.
