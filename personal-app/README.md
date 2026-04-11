# Personal Home Inventory

自宅の寸法・家具・消耗品を管理するCLIアプリ（MVP）。
MCP家具ハブの `shared/catalog/known_products.ts` を参照し、型番から寸法を自動補完。

## Quick Start

```bash
cd personal-app
npm install
```

## Commands

```bash
# 部屋の登録
npm run cli -- room add "リビング" 3600 2700 2400
npm run cli -- room list

# 家具の登録（型番指定で寸法自動補完）
npm run cli -- furniture add 1 "Nクリック3段" --model 8841424 --brand ニトリ
npm run cli -- furniture list

# 消耗品の登録
npm run cli -- consumable add 1 "キャスター" --model 8841518 --months 12 --last-replaced 2025-01-01
npm run cli -- consumable overdue

# カタログ検索
npm run cli -- lookup 8841424

# 統計
npm run cli -- stats
```

## Data

- SQLite DB: `data/inventory.db` (gitignore対象)
- 共有カタログ: `../shared/catalog/known_products.ts`
