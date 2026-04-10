# AI-to-Agent Hub Architecture (v1.3)

## システム概要

家具・収納商品を取り扱うAIエージェント向けMCPハブ。
AIエージェントが自然言語で「幅900mm以下の棚が欲しい」と伝えれば、最適な商品を返す。

---

## レイヤー構成

```
┌─────────────────────────────────────┐
│   Layer 5: インサイト・アナリティクス   │ ← 市場調査・需要分析
├─────────────────────────────────────┤
│   Layer 4: MCP Tool Interface       │ ← AIエージェントとの接点
├─────────────────────────────────────┤
│   Layer 3: Business Logic           │ ← 検索・フィルタリング
├─────────────────────────────────────┤
│   Layer 2: Schema & Validation      │ ← Zodによる型定義
├─────────────────────────────────────┤
│   Layer 1: Data Store               │ ← 商品データ・ログ
└─────────────────────────────────────┘
```

---

## Layer 5: インサイト・アナリティクス・レイヤー（最重要）

このハブは単なる情報提供ではなく、**需要調査機**として機能させる。

### Demand Capture（需要の捕捉）
- AIエージェントが送ってくる `intent` パラメータを解析・蓄積
- どのような目的・状況でどのサイズが求められているかを記録

### Gap Analysis（市場の隙間発見）
- 「検索されたが適合商品がなかった」データを蓄積
- これがビジネスチャンスの種になる

### Business Intelligence（BI）
- 最も求められているサイズ・価格帯の可視化
- 在庫切れによる機会損失の数値化
- メーカーへのコンサル材料・自社製品開発の判断材料

---

## ディレクトリ構成

```
MCP/
├── .cursorrules          # プロジェクト憲法（本ファイル群の入口）
├── rules/                # 詳細ルール集
│   ├── insight-collection.md
│   ├── architecture.md
│   ├── logging.md
│   ├── privacy.md
│   └── typescript.md
├── schemas/
│   └── product.ts        # Zodスキーマ定義
├── index.ts              # MCPサーバーエントリポイント
├── logs/
│   └── analytics.jsonl   # インサイトログ（JSONL形式）
├── data/
│   └── products.ts       # 商品ダミーデータ
└── PROJECT_LOG.md        # 開発記録
```

---

## MCPツール設計方針

### ツール命名規則
- 動詞_名詞 形式: `search_products`, `get_product_detail`
- スネークケース統一

### 必須引数
- 全検索ツールに `intent: string` を含めること（`rules/insight-collection.md` 参照）

### エラーハンドリング
- 適合なし（0件）は「エラー」ではなく「ミス」として記録
- AIエージェントに「代替案」を提示できるよう設計すること

---

## Layer 6: 需要ギャップ・フィードバック・ループ（v1.3追加）

「提供しているデータ」と「求められているデータ」の差分を可視化する。

### Gap Detector Service
- `intent` テキストを正規化→キーワードマッチ
- DBに存在しない属性（耐荷重・防炎・キャスター等）を検出

### Demand Backlog
- `logs/requirement_gaps.jsonl` に検出項目・頻度を蓄積
- 頻度順集計 → スキーマ拡張の優先度リスト生成

### Actionable Insights
- 高頻度ギャップ → ニトリサイトの新規スクレイピング項目に追加
- または → メーカーへ「このデータを提供してほしい」と交渉する根拠に

---

## データフロー（v1.3）

```
AIエージェント
    ↓ MCPツール呼び出し（intent付き）
MCPサーバー（index.ts）
    ↓ スキーマバリデーション（Zod）
    ↓
    ├─ Gap Detector（intent キーワードスキャン）
    │       ↓
    │   logs/requirement_gaps.jsonl（ノンブロッキング）
    │
ビジネスロジック（検索・フィルタ）
    ↓ 結果 + ログ記録（並列）
logs/analytics.jsonl  ←→  レスポンス返却
                            └─ gap_feedback（ギャップ検知時）
```
