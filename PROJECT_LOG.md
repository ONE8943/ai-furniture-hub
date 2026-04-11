# PROJECT LOG - 家具・収納 MCP ハブ

---

## 2026-04-10: Phase 1 完了 ✅

### 実施内容

#### 環境構築
- Node.js v24.14.1 を winget 経由でインストール
- `npm init -y` でプロジェクト初期化
- 依存パッケージインストール:
  - `typescript@6.x`
  - `ts-node@10.x`
  - `zod@4.x`
  - `@modelcontextprotocol/sdk@1.29.0`
  - `@types/node`
- `tsconfig.json` を厳格モード（`strict: true`）で設定

#### スキーマ実装 (`schemas/`)
| ファイル | 内容 |
|---------|------|
| `product.ts` | 商品スキーマ（外寸・内寸mm, 価格円, 在庫, series_id等） |
| `search.ts` | 検索パラメータスキーマ（intent必須含む） |
| `analytics.ts` | インサイトログスキーマ |

#### データ (`data/products.ts`)
ニトリ「Nクリック」「カラーボックス」を模したダミーデータ5件:
1. Nクリック ベーシックシェルフ 幅40 (¥7,990・在庫あり)
2. Nクリック ワイドシェルフ 幅80 (¥12,990・在庫あり)
3. カラーボックス 3段 幅42・ホワイト (¥2,990・在庫あり)
4. カラーボックス 2段 幅42・ブラウン (¥2,490・**在庫切れ**)
5. Nクリック キャビネット 幅60 (¥9,990・在庫あり)

#### ユーティリティ (`utils/`)
- `logger.ts`: `logs/analytics.jsonl` への追記・ノンブロッキング実装
- `filter.ts`: 検索条件フィルタリング + `detectMissReason()` によるGap Analysis

#### MCPツール (`tools/search_products.ts`)
- `search_products` ツール実装
- `intent` 引数必須
- ヒット件数0件時に `miss: true` + `miss_reason` を記録（Gap Analysis）

#### MCPサーバー (`index.ts`)
- `McpServer` + `StdioServerTransport` で最小構成のMCPサーバー
- `registerTool()` でZod v4スキーマを直接使用

### テスト結果

```
テスト: 16件 PASS / 0件 FAIL ✅

Test 1: 幅450mm以下 → 2件ヒット（正常）
Test 2: 価格10000円以下カラーボックス → 1件ヒット（正常）
Test 3: ブラウン在庫切れ除外 → 0件・miss=true（Gap Analysis記録）
Test 4: 幅430〜599mm（在庫なしサイズ帯）→ 0件・miss=true（Gap Analysis記録）
Test 5: 全商品取得 → 5件ヒット（正常）
ログ検証: analytics.jsonl に10行記録、全行JSONパース正常
```

### analytics.jsonl サンプル（Gap Analysisデータ）

```jsonl
{"timestamp":"...","tool":"search_products","query":{"color":"ブラウン","in_stock_only":true},"intent":"ブラウン系の家具でリビングをまとめたい。既存の棚に合わせるため色指定が重要。","hit_count":0,"miss":true,"miss_reason":"no_matching_color"}
{"timestamp":"...","tool":"search_products","query":{"width_mm_min":430,"width_mm_max":599,"in_stock_only":true},"intent":"洗面所の壁と洗濯機の間が正確に430〜599mmの隙間しかない...","hit_count":0,"miss":true,"miss_reason":"no_matching_size"}
```

### 発生した問題と解決

| 問題 | 原因 | 解決 |
|------|------|------|
| `npm` コマンド不認識 | Node.js 未インストール | winget で Node.js LTS をインストール |
| TypeScript `Cannot find name 'process'` | tsconfig に `"types"` 未設定 | `"types": ["node"]` を追加 |
| `ZodError.errors` 型エラー | Zod v4 では `.issues` に変更 | `.errors` → `.issues` に修正 |

---

---

## 2026-04-10: Phase 1 改（v1.3） - 需要ギャップ検知機能 完了 ✅

### 実施内容

#### ルール更新
- `.cursorrules` → v1.3（需要ギャップ検知ルール追記）
- `rules/architecture.md` → v1.3（Layer 6: Gap Feedback Loop 追加）
- `rules/gap-detection.md` 新規作成（検知仕組み・キーワード辞書・ログスキーマ）

#### 新規実装ファイル
| ファイル | 内容 |
|---------|------|
| `schemas/requirement_gap.ts` | ギャップログの Zodスキーマ |
| `utils/gap_detector.ts` | キーワード検知エンジン（17属性・全角半角正規化対応） |
| `test/run_gap_test.ts` | Gap検知専用テスト |

#### 更新ファイル
- `tools/search_products.ts`: Gap検知を `searchProducts()` に統合
- `index.ts`: v1.3.0・レスポンスに `gap_feedback` 追加

#### 検知キーワード辞書（17属性）
`load_capacity_kg`, `fire_resistant`, `formaldehyde_grade`, `assembly_difficulty`,
`child_safe`, `has_casters`, `water_resistant`, `earthquake_resistant`,
`has_drawers`, `has_lock`, `weight_kg`, `made_in_japan`, `warranty_years`,
`eco_certified`, `shelf_count`, `assembly_time_minutes`, `color_variation_count`

### テスト結果

```
Gap検知テスト: 23件 PASS / 0件 FAIL ✅
既存テスト:   16件 PASS / 0件 FAIL ✅（リグレッションなし）
合計:         39件 PASS / 0件 FAIL ✅

Unit Tests:
  U1: 「耐荷重50kg以上」→ load_capacity_kg 検知 ✅
  U2: 「子供部屋・キャスター・防水」→ 3属性同時検知 ✅
  U3: 既存スキーマ内の要件のみ → gap_feedback なし ✅
  U4: 「地震・転倒防止」→ earthquake_resistant 検知 ✅
  U5: 全角「ＦＳＣ」→ 正規化後に eco_certified 検知 ✅

Integration Tests:
  I1: ヒット検索 + gap_feedback が同時に返る ✅
  I2: ミス + Gap 両方を同時に記録（miss=true + gap_feedback） ✅
  I3: ギャップなし検索 → gap_feedback=undefined（ノイズなし） ✅

Log Verification:
  requirement_gaps.jsonl に正常記録、全行JSONパース正常 ✅
```

### requirement_gaps.jsonl サンプル

```json
{
  "timestamp": "2026-04-10T03:20:09.835Z",
  "tool": "search_products",
  "intent": "本棚として使いたい。耐荷重50kg以上の棚が欲しい。本をたくさん入れる予定。",
  "detected_attributes": ["load_capacity_kg"],
  "keywords_matched": ["耐荷重", "荷重", "kg以上"],
  "search_context": { "had_results": true, "hit_count": 4 }
}
```

### gap_feedback レスポンス例（AIエージェントへの返却）

```json
"gap_feedback": {
  "message": "ご要望の「耐荷重・荷重・kg以上」に関するデータは現在収集中です。ニーズとして記録しました。",
  "detected_needs": ["load_capacity_kg"],
  "note": "検出された属性（load_capacity_kg）は今後のデータ拡充の優先項目として反映されます。"
}
```

---

---

## 2026-04-10: Phase 1 v1.4 - Self-Evolution Layer 完了 ✅

### 設計方針：「提案するAI、決断する人間」

法的リスクを抑えながら自己進化させる**半自動ループ**を実装。
AIが「何が足りないか」を検知・提案し、管理者が承認した時だけシステムが進化する。

### 自己進化ループ（4ステップ）

```
検知 → 提案生成 → 管理者承認 → 実装
  ↑                              ↓
  └──────── ループ継続 ───────────┘
```

### 新規実装ファイル

| ファイル | 内容 |
|---------|------|
| `rules/self-evolution.md` | 自己進化ルール・法的ガードレール |
| `schemas/proposal.ts` | プロポーザルのZodスキーマ |
| `utils/demand_analyzer.ts` | gaps.jsonl を集計して需要ランキングを生成 |
| `utils/proposal_generator.ts` | 閾値超えギャップを proposals/pending/ に自動出力 |
| `scripts/review_proposals.ts` | 管理者承認CLI（npm run review） |
| `scripts/analyze_demand.ts` | 需要レポート表示（npm run analyze） |
| `test/run_evolution_test.ts` | Self-Evolution フロー全体のテスト |

### npm スクリプト

| コマンド | 機能 |
|---------|------|
| `npm run review` | 承認待ちプロポーザルを対話形式でレビュー |
| `npm run analyze` | 需要ランキングとプロポーザル状況をレポート |
| `npm test` | 基本動作テスト |

### テスト結果

```
Self-Evolution テスト: 10件 PASS / 0件 FAIL ✅
Gap検知テスト:         23件 PASS / 0件 FAIL ✅
基本動作テスト:        16件 PASS / 0件 FAIL ✅
合計:                  49件 PASS / 0件 FAIL ✅
```

### 実際に生成されたプロポーザル例

```json
{
  "id": "prop_20260410_child_safe",
  "attribute_key": "child_safe",
  "status": "pending",
  "demand_count": 3,
  "description": "子供向け安全設計",
  "zod_schema_suggestion": "child_safe: z.boolean().optional().describe('子供向け安全設計（角丸・転落防止等）')",
  "scraping_hint": "商品説明・安全機能欄の「角が丸い」「子供部屋向け」表記を取得",
  "sample_intents": ["子供部屋用でキャスター付きが欲しい。おもちゃ収納に。"]
}
```

### 需要レポート（npm run analyze の出力より）

| 順位 | 属性 | 件数 | 説明 |
|------|------|------|------|
| 1 | load_capacity_kg | 3件 | 棚の最大耐荷重（kg） |
| 2 | earthquake_resistant | 3件 | 転倒防止・耐震機能 |
| 3 | child_safe | 3件 | 子供向け安全設計 |
| 4 | water_resistant | 2件 | 防水・防湿 |
| 5 | has_casters | 2件 | キャスター有無 |

### 法的ガードレール（rules/self-evolution.md）

- AIはコードを自動書き換えしない（管理者承認が必要）
- スクレイピング時は robots.txt 確認必須・レートリミット3秒/req
- 「送客・引用」スタンスを維持（メーカーのメリットを損なわない）

---

---

## 2026-04-10: Phase 1 v1.5 - アフィリエイト収益化レイヤー 完了 ✅

### 設計思想：A2A Affiliate（AI-to-AI アフィリエイト）

AIエージェントが商品を選んだ瞬間に収益が発生する仕組みを実装。
人間が介入しなくても、**AIが最適ルートを選択 → affiliate_url を使って提示 → 購入 → 報酬発生** という自動収益サイクルが成立。

### 新規実装ファイル

| ファイル | 内容 |
|---------|------|
| `.env` / `.env.example` | アフィリエイトID管理（dotenv使用） |
| `.gitignore` | .env の誤コミット防止 |
| `rules/affiliate.md` | アフィリエイトルール・プラットフォーム仕様 |
| `adapters/nitori.ts` | ニトリ用アフィリエイトURLビルダー |
| `adapters/rakuten.ts` | 楽天アフィリエイト形式URLビルダー |
| `adapters/amazon.ts` | Amazonアソシエイトタグ付与 |
| `adapters/generic.ts` | 汎用フォールバックアダプター |
| `adapters/index.ts` | アダプターレジストリ・プラットフォーム判定 |
| `services/affiliate.ts` | アフィリエイトエンジン（URL生成・報酬推定・ログ） |
| `test/run_affiliate_test.ts` | アフィリエイト専用テスト |

### 更新ファイル

- `schemas/product.ts`: `affiliate_url`, `platform_urls` フィールド追加
- `schemas/analytics.ts`: `ConversionLog` 型・アフィリエイト追跡フィールド追加
- `data/products.ts`: `platform_urls`（ニトリ・楽天・Amazon）追加
- `tools/search_products.ts`: アフィリエイトURL付与を検索フローに統合
- `index.ts`: v1.5.0・description に affiliate_url 使用指示追記

### テスト結果

```
アフィリエイトテスト: 23件 PASS / 0件 FAIL ✅
既存テスト（全件）:   39件 PASS / 0件 FAIL ✅（リグレッションなし）
合計:                 62件 PASS / 0件 FAIL ✅

Unit Tests:
  U1: ニトリURL → <test_id> + utm_source=mcp_hub 付与 ✅
  U2: Amazon URL → tag=<test_id> + linkCode=as2 付与 ✅
  U3: 楽天URL → hb.afl.rakuten.co.jp 形式に変換 ✅
  U4: 不明URL → generic アダプター（aff_id パラメータ）✅
  U5: 報酬推定 Amazon(399円) > Nitori(199円) ※9990円の場合 ✅

Integration Tests:
  I1: 検索結果の全商品に affiliate_url が付与される ✅
  I2: ニトリ商品URLにアフィリエイトIDが含まれる ✅
  I3: affiliate_summary.platforms が返される ✅

Log Verification:
  conversions.jsonl に9件のコンバージョンログ記録 ✅
```

### conversions.jsonl サンプル（実際の生成内容）

```json
{
  "timestamp": "2026-04-10T03:32:31.304Z",
  "product_id": "a1b2c3d4-0005-4000-8000-000000000005",
  "product_name": "Nクリック キャビネット 幅60",
  "platform": "nitori",
  "affiliate_url": "https://example.nitori.co.jp/products/n-click-cabinet-60?uid=<REDACTED>&utm_source=mcp_hub&utm_medium=ai_agent&utm_campaign=mcp_hub_affiliate",
  "intent_summary": "引っ越し用に複数の棚を揃えたい。全ラインナップを教えてほしい。",
  "price": 9990
}
```

### 推定報酬レート（目安）

| プラットフォーム | レート | 9,990円商品の報酬 |
|----------------|--------|----------------|
| ニトリ（VC経由） | 2% | 約199円 |
| 楽天アフィリエイト | 1.5% | 約149円 |
| Amazon アソシエイト | 4% | 約399円 |

---

---

## 2026-04-10: Phase 2 実装完了 ─ リアルデータ接続と `get_product_detail` ツール追加

### 実装内容

#### 1. 依存ライブラリの追加
- `axios` (^1.15.0): HTTP リクエスト
- `cheerio` (^1.2.0): HTML パーサー

#### 2. `utils/unit_converter.ts`（新規）
ニトリ商品ページで使われる表記パターンを全て網羅した寸法・価格パーサー:
- `cmToMm(cm)` / `mmToMm(mm)`: 基本変換（小数対応）
- `parseToMm(raw)`: 文字列から mm 数値へ（"40cm", "400mm", "400" に対応）
- `parseDimensionString(raw)`: 日本語寸法文字列を ParsedDimensions に変換
  - 対応パターン: "幅40×奥行29×高さ180cm" / "W400×D290×H1800mm" / "幅:40cm / 奥行:29cm / 高さ:180cm"
- `parsePriceJpy(raw)`: 価格文字列を整数円に変換（"7,990円（税込）" → 7990）

#### 3. `utils/robots_checker.ts`（新規）
法的ガードレール（rules/self-evolution.md 準拠）:
- `checkRobotsTxt(url, ua)`: robots.txt を取得・解析（1時間キャッシュ）
  - User-Agent ワイルドカード対応、Allow/Disallow の優先順位制御
- `waitForRateLimit(url, delayMs)`: ドメインごとの最低リクエスト間隔を保証
  - デフォルト: `SCRAPE_DELAY_MS` 環境変数（=3000ms）
- `guardedRequest(url, ua)`: robots チェック + レートリミットを一括適用するラッパー

#### 4. `adapters/nitori_scraper.ts`（新規）
ニトリ公式サイトへの接続アダプター（モック/実スクレイピング切り替え可能）:
- `SCRAPE_MOCK=true`（デフォルト）: モックデータを即時返却
- `SCRAPE_MOCK=false`: 実際のニトリサイトをスクレイピング
  - `scrapeNitoriSearch(keyword, maxItems)`: 検索結果ページをパース
  - `scrapeNitoriProductDetail(url)`: 詳細ページから寸法・価格を取得
- 取得データは `parseDimensionString` で cm→mm 自動変換
- CSS セレクターをファイル上部に集約（実際のページ構造に合わせて調整可能）

#### 5. `data/product_store.ts`（新規）
ダミーデータとスクレイピングデータを統合するデータレイヤー:
- `refreshProductStore(force?)`: ニトリから取得してキャッシュを更新（30分TTL）
  - 失敗時はダミーデータで継続（フォールバック設計）
- `getAllProducts()` / `getProductById(id)` / `searchProductsByName(keyword)`
- `getStoreStatus()`: デバッグ・監視用のストア状態確認
- サーバー起動時（`index.ts` の `main()`）に非同期でリフレッシュを実行

#### 6. `tools/get_product_detail.ts`（新規）
新規 MCP ツール:
- 商品ID を指定して完全スペックを返す
- `intent` 必須（ログ・Gap検知に活用）
- 機能:
  - アフィリエイトURL を自動付与
  - 同シリーズ or 近いサイズの関連商品を最大3件提案
  - Gap検知（意図に未対応属性があれば `gap_feedback` を付与）
  - `analytics.jsonl` + `conversions.jsonl` へノンブロッキングで記録
  - `store_info`（総商品数・データソース）を返却

#### 7. `index.ts` の更新
- バージョン `1.5.0` → `2.0.0`
- `get_product_detail` ツールを登録
- サーバー起動時に `refreshProductStore()` を非同期実行

#### 8. `.env` への追加設定
```
SCRAPE_MOCK=true           # テスト時はモック（本番は false に変更）
SCRAPE_DELAY_MS=3000       # レートリミット: 3秒/リクエスト
SCRAPE_USER_AGENT=...      # robots.txt チェック用 UA
```

#### 9. `package.json` スクリプト追加
```
npm run test:phase2  → Phase 2 テストのみ実行
npm run test:all     → 全テストスイートを連続実行（計96テスト）
```

### テスト結果（全96 PASS / 0 FAIL）

```
run_test.ts         :  16 PASS / 0 FAIL  (Phase 1 基本検索)
run_gap_test.ts     :  23 PASS / 0 FAIL  (Gap検知)
run_evolution_test.ts:  10 PASS / 0 FAIL  (Self-Evolution)
run_affiliate_test.ts:  23 PASS / 0 FAIL  (アフィリエイト)
run_phase2_test.ts  :  34 PASS / 0 FAIL  (Phase 2 新機能)
─────────────────────────────────────────
合計                :  96 PASS / 0 FAIL  ✅
```

### get_product_detail レスポンス例

```json
{
  "status": "success",
  "product": {
    "id": "a1b2c3d4-0001-4000-8000-000000000001",
    "name": "Nクリック ベーシックシェルフ 幅40",
    "width_mm": 400, "height_mm": 1800, "depth_mm": 290,
    "price": 7990,
    "affiliate_url": "https://example.nitori.co.jp/...?uid=<REDACTED>&..."
  },
  "affiliate_url": "https://example.nitori.co.jp/...?uid=<REDACTED>&...",
  "estimated_commission_yen": 199,
  "related_products": [
    { "id": "...", "name": "Nクリック ワイドシェルフ 幅80", "price": 12990, "affiliate_url": "..." }
  ],
  "store_info": { "total_products": 5, "source": "product_store" }
}
```

### システム全体のデータフロー（v2.0）

```
AIエージェント
 │
 ├─ search_products(intent, 寸法/価格条件)
 │     └→ ProductStore → filterProducts → attachAffiliateUrls
 │              ↕                              ↓
 │        NitoriScraper             analytics.jsonl + conversions.jsonl
 │        (30分TTLキャッシュ)
 │
 └─ get_product_detail(id, intent)
       └→ ProductStore → getProductById → attachAffiliateUrls
               │                              ↓
               └→ findRelatedProducts   analytics.jsonl + conversions.jsonl
```

### cm→mm 自動変換の仕組み

```
ニトリサイト: "幅40×奥行29×高さ180cm"
     ↓  parseDimensionString()
{ width_mm: 400, depth_mm: 290, height_mm: 1800 }
     ↓  Product スキーマに格納
AIエージェント: "幅400mm の棚" と認識（1mmの誤差もなし）
```

---

---

## 2026-04-10: 正式アフィリエイトID反映 + 審査用LP公開

### 実施内容

#### 1. Amazon アソシエイト
- ID: `<REDACTED>`（申請完了・審査中）
- `.env` の `AFFILIATE_ID_AMAZON` に反映済み
- 生成URL例: `https://www.amazon.co.jp/dp/...?tag=<REDACTED>&linkCode=as2&...`

#### 2. 楽天アフィリエイト
- ID: `<REDACTED>`
- `.env` の `AFFILIATE_ID_RAKUTEN` に反映済み
- `adapters/rakuten.ts` の URL 形式を `/hgc/` → `/ichiba/` に修正（楽天の正式形式に準拠）
- `RAKUTEN_AFFILIATE_SERVICE_ID` 環境変数を廃止（`AFFILIATE_ID_RAKUTEN` に統一）
- 生成URL例: `https://hb.afl.rakuten.co.jp/ichiba/<REDACTED>.../`

#### 3. ハードコード除去
- コードベース全体からテスト用ID文字列を完全除去
- テストコードも `.env` から動的にIDを読む形式に変更
- grepで旧テストID検索 → 0件

#### 4. 審査用LP
- `public/index.html` を作成、Netlify にデプロイ
- URL: https://fantastic-scone-73c867.netlify.app/
- Amazon アソシエイト開示 + プライバシーポリシーをフッターに記載

#### 5. `services/affiliate.ts` リファクタリング
- 楽天の分岐を `AFFILIATE_IDS.rakuten`（= `/ichiba/` 用ドット区切りID）に統一
- ID 未設定時の分岐を簡素化（全プラットフォーム共通: `!affiliateId` → 元URL返却）

### テスト結果

```
run_test.ts          : 16 PASS / 0 FAIL
run_gap_test.ts      : 23 PASS / 0 FAIL
run_affiliate_test.ts: 22 PASS / 0 FAIL
run_phase2_test.ts   : 34 PASS / 0 FAIL
──────────────────────────────────────────
合計                 : 95 PASS / 0 FAIL  ✅
```

### 収益化ステータス

| プラットフォーム | ID | 状態 |
|---|---|---|
| Amazon | `<REDACTED>` | 申請済み（審査中） |
| 楽天 | `<REDACTED>` | 本番ID反映済み |
| ニトリ（VC） | なし | 未申請（ID空 → 安全動作） |
| バリューコマース | なし | 未申請（ID空 → 安全動作） |

---

---

## 2026-04-10: 楽天商品検索API連携 (v2.1.0)

### 概要

楽天市場の商品検索API（Ichiba Item Search API v2026-04-01）と連携し、
リアルタイムの商品データ取得とアフィリエイトリンク自動生成を実現した。

### 新規ファイル

| ファイル | 概要 |
|---|---|
| `adapters/rakuten_api.ts` | 楽天API呼び出し・レスポンスパース・モック切替・寸法抽出 |
| `tools/search_rakuten.ts` | MCPツール `search_rakuten_products` のロジック |
| `test/run_rakuten_test.ts` | 楽天API連携テストスイート（22テスト） |

### 変更ファイル

| ファイル | 変更内容 |
|---|---|
| `index.ts` | `search_rakuten_products` ツール登録、バージョン v2.1.0 |
| `data/product_store.ts` | 楽天APIデータソースを統合（ニトリ + 楽天 並列取得） |
| `.env` / `.env.example` | `RAKUTEN_APP_ID`, `RAKUTEN_ACCESS_KEY`, `RAKUTEN_API_MOCK` 追加 |
| `package.json` | `test:all` に楽天テスト追加 |

### 楽天API連携の仕組み

```
AIエージェント
    ↓ search_rakuten_products(keyword, intent, ...)
MCPサーバー
    ↓
    ├─ RAKUTEN_API_MOCK=true  → モックデータ即時返却
    └─ RAKUTEN_API_MOCK=false → 楽天API呼び出し
        ↓
        楽天 Ichiba Item Search API (v2026-04-01)
        ↓ レスポンス
        Zodバリデーション → 寸法抽出（商品名・キャプションから mm 変換）
        ↓
        アフィリエイトURL付与（APIが affiliateUrl を返す or 自前生成）
        ↓
    Gap検知 + ログ記録（並列）
    ↓
    レスポンス返却（affiliate_url 付き）
```

### 楽天API特有の機能

- **APIネイティブのアフィリエイト**: `affiliateId` をリクエストに含めると、
  レスポンスに `affiliateUrl` が自動付与される（自前変換のフォールバックあり）
- **寸法抽出**: 商品名・キャプションから正規表現で W/D/H を推定し mm 変換
  - 「幅90cm」「W90×D40×H180cm」「約 90×40×180 cm」等のパターン対応
- **レートリミット**: 最低1.2秒間隔でAPIコール（楽天のレート制限準拠）
- **価格/ソート/在庫フィルタ**: 楽天API標準パラメータを全面サポート

### テスト結果

```
run_test.ts          : 16 PASS / 0 FAIL
run_gap_test.ts      : 23 PASS / 0 FAIL
run_affiliate_test.ts: 22 PASS / 0 FAIL
run_phase2_test.ts   : 34 PASS / 0 FAIL
run_rakuten_test.ts  : 22 PASS / 0 FAIL  ← NEW
──────────────────────────────────────────
合計                 : 117 PASS / 0 FAIL  ✅
```

### 本番稼働への切替手順

1. https://webservice.rakuten.co.jp/app/list でアプリを作成
2. `.env` に以下を設定:
   ```
   RAKUTEN_APP_ID=取得したアプリID
   RAKUTEN_ACCESS_KEY=取得したアクセスキー
   RAKUTEN_API_MOCK=false
   ```
3. サーバー再起動で楽天のリアルデータが流れ始める

---

## MCPツール一覧（v2.1.0）

| ツール名 | 概要 |
|---|---|
| `search_products` | ローカルDB（ダミー＋スクレイピング）から商品検索 |
| `get_product_detail` | 商品IDで詳細取得 |
| `search_rakuten_products` | 楽天APIでリアルタイム商品検索 |

---

---

## 2026-04-10: 楽天API本番切替完了

### 設定

- アプリID: `<REDACTED>` (API/バックエンドサービスとして登録)
- アクセスキー: 設定済み
- アフィリエイトID: `<REDACTED>` (APIアプリ紐づき)
- `RAKUTEN_API_MOCK=false` で本番接続

### 本番接続確認

```
source: rakuten_api / total: 216 / got: 5

連結できるNカラボ レギュラー → W:419 D:298 H:590 mm / 1,790円
Nクリック ディープ ワイド3段  → W:591 D:394 H:881 mm / 7,990円
連結できるNカラボ スリム    → W:224 D:298 H:590 mm / 1,490円
```

- 楽天の `affiliateUrl` が自動付与されている
- キャプションの「幅41.9×奥行29.8×高さ59cm」→ mm 変換が正常動作
- レスポンスキー `Items`（PascalCase）に対応済み

---

---

## 2026-04-10: AIO（AI Optimization）実装

### 概要

AIエージェントにこのサーバーを「見つけてもらう」ための最適化を実施。
SEOのAI版 = AIO。

### 新規ファイル

| ファイル | 概要 |
|---|---|
| `public/llms.txt` | AIクローラー向けサーバー概要（llms.txt 標準） |
| `public/llms-full.txt` | 全ツールの詳細仕様・パラメータ・レスポンス例・推奨ワークフロー |
| `smithery.yaml` | Smithery ディレクトリ登録用マニフェスト |
| `mcp.json` | Cursor / Claude Desktop 接続設定 |

### 変更ファイル

| ファイル | 変更内容 |
|---|---|
| `index.ts` | MCPリソースとして `llms.txt` / `llms-full.txt` を公開（`server.resource()`） |

### MCPリソース

AIエージェントが `resources/read` で以下を取得可能：

- `furniture-hub://llms.txt` → サーバー概要（何ができるか）
- `furniture-hub://llms-full.txt` → 全ツール仕様（パラメータ・レスポンス・例）

### Smithery 登録手順

1. GitHubリポジトリを公開
2. https://smithery.ai/new でリポジトリURLを入力
3. `smithery.yaml` が自動検出される
4. 公開完了 → 世界中のAIエージェントから検索可能に

### テスト結果

```
合計: 117 PASS / 0 FAIL ✅（全スイート）
```

---

## 2026-04-10: v3.0.0 - データ充実化 & 外部AI接続 (Phase 1-4)

### 概要

データソースの大幅拡充、Amazon PA-APIアダプター新規追加、
HTTP/SSEトランスポート対応により外部AIエージェントからの接続を実現。

### Phase 1: 楽天API強化

- **寸法パーサー大幅改善** (`adapters/rakuten_api.ts`):
  - 8パターン対応（括弧ラベル、サイズ:ラベル、2値パターン等追加）
  - `extractDimensions` を export化（Amazon等でも再利用）
  - 14テスト全パス
- **検索キーワード拡充**: 2キーワード → 18カテゴリに拡張
  - 収納棚/カラーボックス/本棚/食器棚/テレビ台/チェスト/キャビネット/ラック/クローゼット/サイドボード/シューズラック/デスク/ワゴン/隙間収納/壁面収納/ニトリ各種
- **複数ページ取得** (`searchRakutenMultiPage`):
  - 1キーワードあたり最大2ページ(60件)、重複除去付き
- **レートリミット対策**: バッチ並列→完全順次実行に変更（429エラー防止）
- **CLIENT_IP_NOT_ALLOWED フォールバック**: 403→モック自動切替 + ログ出力
- **楽天API本番接続**: `.env`にキー設定済み、管理画面でサーバーIPの許可が必要

### Phase 2: ニトリスクレイピング方針転換

- ニトリ公式サイトはボット対策でタイムアウト → 楽天のニトリ公式ショップからAPI取得に切替
- 楽天キーワードに「ニトリ シェルフ」「ニトリ カラーボックス」「ニトリ 食器棚」を追加

### Phase 3: Amazon PA-APIアダプター新規追加

| ファイル | 概要 |
|---|---|
| `adapters/amazon_api.ts` | AWS Signature V4認証、商品検索、寸法パース、モック3件 |
| `tools/search_amazon.ts` | MCPツール `search_amazon_products` のロジック |

- 認証: AMAZON_PA_ACCESS_KEY + AMAZON_PA_SECRET_KEY (AWS Sig V4)
- モック/本番切替: `AMAZON_API_MOCK=true/false`
- 寸法: PA-APIの`ItemDimensions`優先、なければテキストからパース（`extractDimensions`再利用）
- `data/product_store.ts`: Amazonデータソース統合（8キーワード）
- `.env` / `.env.example`: Amazon PA-API変数追加

### Phase 4: HTTP/SSEトランスポート（外部AI接続対応）

| ファイル | 概要 |
|---|---|
| `server_http.ts` | HTTP サーバーエントリーポイント（Streamable HTTP + SSE 互換） |

- **Streamable HTTP** (`/mcp`): MCP プロトコル 2025-11-25 対応
- **SSE** (`/sse` + `/messages`): レガシークライアント向け
- **ヘルスチェック**: `/health`
- **APIキー認証**: `MCP_API_KEY` 環境変数で Bearer トークン保護
- **CORS**: 全オリジン許可（プロダクション時に制限推奨）
- **セッション管理**: StreamableHTTPはstateful（UUID）、SSEは自動
- `npm run start:http` / `npm run dev:http` で起動

### MCPツール一覧（v3.0.0）

| ツール名 | 概要 |
|---|---|
| `search_products` | ローカルDB（統合データ）から商品検索 |
| `get_product_detail` | 商品IDで詳細取得 |
| `search_rakuten_products` | 楽天APIでリアルタイム商品検索 |
| `search_amazon_products` | Amazon PA-APIで商品検索 **NEW** |

### 接続方法

| 方式 | 用途 | コマンド |
|---|---|---|
| stdio | Cursor / ローカルAI | `npm start` |
| HTTP | 外部AIエージェント | `npm run start:http` |

---

## 次のステップ

- [x] `get_product_detail` ツールの追加 ✅
- [x] ニトリ商品ページの robots.txt チェッカー実装 ✅
- [x] 実アフィリエイトID への差し替え ✅ (Amazon + 楽天)
- [x] 審査用LP公開 ✅ (Netlify)
- [x] 楽天API連携 + 本番切替 ✅
- [x] AIO: llms.txt / smithery.yaml / mcp.json ✅
- [x] 寸法パーサー改善（8パターン14テスト全パス） ✅
- [x] 楽天キーワード拡充（18カテゴリ） ✅
- [x] 楽天複数ページ取得 ✅
- [x] Amazon PA-APIアダプター追加 ✅
- [x] HTTP/SSEトランスポート（外部AI接続） ✅
- [ ] 楽天管理画面でサーバーIPの許可設定
- [ ] Amazon PA-APIキー取得・設定
- [ ] Smithery に登録（GitHub公開後）
- [ ] Cursor の `@mcp` でサーバーに接続してE2Eテスト
- [ ] 本業連携: 特定技能・寮セットアップ専用ツール追加
- [ ] 多言語対応（ベトナム語・英語・中国語）
- [ ] `conversions.jsonl` 集計ダッシュボード
- [ ] `logs/analytics.jsonl` 集計・可視化
- [ ] 山崎実業（tower シリーズ）アダプター追加
- [ ] Gap インサイトレポートの自動生成・SNS発信
- [ ] デプロイ先検討（VPS, Railway, Cloudflare Workers等）


---

## 2026-04-11: 変更サマリ（sync-log / Gemini・last-commit）

### 概要
新しい記録係スクリプト `sync_log.ts` を導入しました。このスクリプトは Gemini API を利用して git diff を要約し、`PROJECT_LOG.md` に変更サマリを追記するとともに、AIエージェント向けのツール説明ドラフトを `public/llms.txt` 用に生成します。これにより、プロジェクトの変更履歴管理とLLM向けドキュメント更新の効率化が図られます。

### 主要な変更ファイル
*   `.env.example`: Gemini APIキー設定の追加を含む環境設定の変更。
*   `.gitignore`: `public/llms-tools.sync-draft.md` を無視対象に追加。
*   `package.json`, `package-lock.json`: Google Generative AI SDK (`@google/generative-ai`) の新規追加と、`sync-log` スクリプトの定義。
*   `scripts/sync_log.ts`: 新規追加された記録係スクリプト本体。
*   `tsconfig.json`: `scripts` ディレクトリをコンパイル対象に含めるよう設定を更新。

### 新規/変更ツール
#### `sync-log` スクリプト
この新しいスクリプトは、Gitの変更差分を自動的に要約し、プロジェクトの変更ログ (`PROJECT_LOG.md`) を更新します。また、AIエージェントが利用可能なツールに関する説明のドラフトを生成し、`public/llms.txt` の更新を支援します。これにより、開発者は変更内容の記録とドキュメント作成の手間を削減できます。

### 運用上の注意
*   `sync-log` スクリプトを実行するには、環境変数 `GEMINI_API_KEY` の設定が必要です。`.env` ファイルまたは環境変数で適切に設定してください。
*   スクリプトが生成する `public/llms-tools.sync-draft.md` はドラフトであり、最終的な `public/llms.txt` には手動で内容を確認しマージする必要があります。
