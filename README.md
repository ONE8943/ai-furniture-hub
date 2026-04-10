# AI Furniture Hub - MCP Server

**1mmの妥協も許さない、AIによる最適家具選定**

AIエージェント向けの家具・収納商品データ提供MCPサーバー。  
ミリメートル精度の寸法検索、楽天市場APIリアルタイム連携、アフィリエイトリンク自動付与。

## Features

- **mm精度の寸法検索** — 外寸・内寸をミリ単位で検索。「幅425mmの隙間にぴったり収まる棚」を即座に発見
- **楽天市場API連携** — 20万件以上の商品をリアルタイム検索。価格・在庫・レビューが常に最新
- **アフィリエイト自動付与** — Amazon / 楽天のアフィリエイトリンクを全商品に自動生成
- **需要ギャップ検知** — AIエージェントの検索意図を分析し、市場に足りない商品を自動特定
- **シンデレラフィット判定** — 設置場所と商品の寸法を論理的に照合

## Tools

| Tool | Description |
|------|-------------|
| `search_products` | ローカルDBからmm単位で商品検索（内寸・外寸対応） |
| `get_product_detail` | 商品IDで詳細取得（材質・内寸・関連商品） |
| `search_rakuten_products` | 楽天市場APIでリアルタイム商品検索 |

## Quick Start

### 1. Install

```bash
git clone https://github.com/ONE8943/ai-furniture-hub.git
cd ai-furniture-hub
npm install
```

### 2. Configure

```bash
cp .env.example .env
# Edit .env with your API keys
```

### 3. Connect from Cursor

Add to your Cursor MCP settings (`~/.cursor/mcp.json`):

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

### 4. Use

In Cursor, type `@furniture-hub` and search:

```
search_products({ 
  intent: "洗面所の幅42cmの隙間に収納棚を入れたい", 
  width_mm_max: 420, 
  price_max: 10000 
})
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `AFFILIATE_ID_AMAZON` | No | Amazon Associate tag |
| `AFFILIATE_ID_RAKUTEN` | No | Rakuten Affiliate ID (dot-separated) |
| `RAKUTEN_APP_ID` | No | Rakuten API Application ID |
| `RAKUTEN_ACCESS_KEY` | No | Rakuten API Access Key |
| `RAKUTEN_API_MOCK` | No | `true` for mock data (default), `false` for live API |

All affiliate IDs are optional. Products without configured IDs return the original URL.

## Architecture

```
AIエージェント
    ↓ MCP (stdio)
┌─────────────────────────────────────┐
│  search_products                     │ ← mm寸法フィルタ
│  get_product_detail                  │ ← 内寸・材質・関連商品
│  search_rakuten_products             │ ← 楽天API (リアルタイム)
├─────────────────────────────────────┤
│  Affiliate Engine                    │ ← Amazon / 楽天リンク自動付与
│  Gap Detector                        │ ← 需要ギャップ検知
│  Analytics Logger                    │ ← 検索意図・ミスの記録
└─────────────────────────────────────┘
    ↓
  logs/analytics.jsonl     → 市場インサイト
  logs/requirement_gaps.jsonl → 足りない商品属性
  logs/conversions.jsonl   → アフィリエイト成果
```

## AI Optimization (llms.txt)

This server provides `llms.txt` and `llms-full.txt` as MCP resources for AI agent self-discovery:

- `furniture-hub://llms.txt` — Server overview
- `furniture-hub://llms-full.txt` — Full tool documentation with examples

## License

MIT

## Operator

株式会社ONE (ONE, Inc.)  
https://fantastic-scone-73c867.netlify.app/
