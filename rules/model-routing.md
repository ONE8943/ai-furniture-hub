# AIモデル役割分担ルール (v1.0)

## 設計思想

「重い思考は高性能モデル、繰り返し作業は軽量モデル」でコスト最適化する。
情報収集は独立したタスクとして分離し、別セッションで実行可能にする。

---

## モデル別の役割

| 役割 | 推奨モデル | コスト | 用途 |
|------|-----------|--------|------|
| **設計・実装** | Opus 4.6 / Opus 4.6 Max | 高 | アーキテクチャ設計、コード実装、バグ修正、リファクタリング |
| **情報収集** | Gemini Flash / Claude 3.5 Haiku | 低 | Web調査、API仕様確認、競合調査、データ収集 |
| **文書生成** | Gemini Flash | 低 | PROJECT_LOG.md更新、llms.txt更新、context.md生成 |
| **コードレビュー** | Claude Sonnet | 中 | PR レビュー、テスト結果の分析 |
| **データ入力** | Gemini Flash | 低 | known_products への製品追加、カタログ拡充 |

---

## 情報収集の分離実行

### 原則

情報収集タスクは実装セッションと**別のCursorセッション**で実行する。
これにより：
- 高価なモデルのトークンを節約
- 調査結果を構造化してから実装に渡せる
- 複数テーマを並列調査可能

### ワークフロー

```
1. Opus 4.6 で「次に何を調べるべきか」を決定
     ↓
2. 軽量AI（別セッション）で情報収集
   - .cursor/rules/research-mode.mdc を読み込む
   - npm run research で現状把握
   - Web検索やファイル読み取りで調査
   - 結果を Markdown or JSONL で返す
     - 製品データ → staging/research_*.jsonl
     - コーディネートデータ → staging/coord_*.jsonl
     ↓
3. Opus 4.6 に結果を渡して精査・取り込み
   - npm run review:research (製品)
   - npm run review:coord (コーディネート)
```

### コーディネート調査の推奨フロー

```
[Gemini Flash セッション]
  1. docs/research-prompts.md のテンプレートをコピペ
  2. ブログ/SNS/EC/メーカーサイトを調査
  3. staging/coord_[テーマ].jsonl に結果を出力

[Opus 4.6 セッション]
  4. npm run review:coord で品質チェック
  5. npm run review:coord:approve で合格分を承認
  6. 承認データを known_products.ts の related_items に反映
```

### 軽量AIに渡す指示テンプレート

```markdown
## 調査依頼

@.cursor/rules/research-mode.mdc を読み込んでください。

### テーマ
[調査テーマ]

### 調査範囲
- [具体的に調べてほしいこと1]
- [具体的に調べてほしいこと2]

### 出力形式
調査結果を以下の形式で返してください：
- 概要（1-2文）
- 詳細（箇条書き）
- 推奨アクション
- 参考リンク

### 注意
- コードの変更は不要です（読み取りのみ）
- 不明点があれば質問してください
```

---

## 情報収集の典型タスク

### 1. 製品データ調査
- 新ブランドの製品ラインナップ調査
- 既存製品の最新価格・スペック確認
- 廃番情報の確認

### 2. コーディネート・組み合わせ調査（重点）
- **ブログ調査**: RoomClip, folk, LIMIA, macaroni のコーディネート記事
- **SNS調査**: Instagram #[カテゴリ]収納, Pinterest ボード, X(Twitter) レビュー
- **ECサイト**: 楽天「この商品を買った人は」、Amazon「よく一緒に購入」
- **メーカー公式**: ニトリ/IKEA/無印の公式コーディネート提案
- **レビュー分析**: 「これも必要だった」「買い忘れた」系の声

出力先: `staging/coord_[テーマ].jsonl`
テンプレート: `docs/research-prompts.md` テンプレート1,3,4,5

### 3. 技術調査
- MCP SDK の最新バージョン・API変更点
- 依存パッケージのセキュリティアドバイザリ
- TypeScript / Node.js の新機能

### 4. 競合・市場調査
- 他のMCPサーバーの機能・設計パターン
- 家具EC市場のトレンド
- アフィリエイトプログラムの最新条件

### 5. ログ分析
- analytics.jsonl の需要傾向
- requirement_gaps.jsonl のギャップ頻度
- conversions.jsonl のコンバージョン率

---

## ツール活用ガイド

| コマンド | 用途 | 実行者 |
|----------|------|--------|
| `npm run research` | プロジェクト全体サマリー | 軽量AI |
| `npm run research -- --context` | context.md 自動生成 | 軽量AI |
| `npm run research -- --catalog` | カタログ統計 | 軽量AI |
| `npm run research -- --logs` | ログ統計 | 軽量AI |
| `npm run research -- --deps` | 依存関係一覧 | 軽量AI |
| `npm run report` | コンバージョンレポート | 軽量AI |
| `npm run enrich` | カタログ品質監査 | 軽量AI |
| `npm run sync-log` | PROJECT_LOG / llms.txt 更新 | 軽量AI (Gemini API) |
| `npm run review:research` | staging/ の製品データ精査 | Opus |
| `npm run review:approve` | 製品データ合格分を approved/ へ | Opus |
| `npm run review:stats` | 製品レビューパイプライン統計 | どちらでも |
| `npm run review:coord` | staging/ のコーディネートデータ精査 | Opus |
| `npm run review:coord:approve` | コーディネートデータ合格分を approved/ へ | Opus |
| `npm run review:coord:stats` | コーディネートレビュー統計 | どちらでも |
| `npm run review:coord:sample` | コーディネートJSONLサンプル出力 | どちらでも |

---

## コスト管理の目安

| タスク | 推定トークン | 推奨モデル | 推定コスト |
|--------|-------------|-----------|-----------|
| Web調査1件 | 5K-15K | Gemini Flash | ~$0.01 |
| カタログ10件追加 | 10K-30K | Gemini Flash | ~$0.02 |
| ツール1本の新規実装 | 30K-80K | Opus 4.6 | ~$3-8 |
| アーキテクチャ設計 | 50K-100K | Opus 4.6 Max | ~$10-20 |
| PR レビュー | 10K-30K | Sonnet | ~$0.5-1 |

※概算。実際はコンテキスト量と会話長によって変動。
