# AGENTS.md（Cursor / Composer 用・リポジトリルート）

このファイルは **AI Furniture Hub（MCP サーバー）** ワークスペース向けの最短ガイドです。

## まずこれだけ

- **種別**: Node + TypeScript の MCP ハブ（家具・収納・家電まわりのツール群）。
- **秘密**: キー類は `.env` のみ。コミット前の禁止パターンは常時ルール `.cursor/rules/mcp-hub-core.mdc`。
- **実装の約束**: ツールに **`intent` 必須**、検索系は **`logs/analytics.jsonl`**（詳細は `rules/insight-collection.md` / `rules/logging.md`）。

## タスク別に開く場所（全部は読まない）

| 目的 | 主な参照 |
|------|-----------|
| ツール追加・変更 | `lib/register_tools.ts`, `tools/` |
| 型・バリデーション | `rules/typescript.md`, `schemas/` |
| 楽天 / Amazon | `adapters/`, `rules/affiliate.md` |
| 公開・LLM 向け文言 | `public/llms.txt`, `public/index.html` |
| エージェント向けワークフロー詳細 | **`public/AGENTS.md`**（必要なときだけ） |

## 実行

```bash
npm install
npm run dev        # stdio MCP
npm run dev:http   # HTTP（ローカル）
```

環境変数の例: `.env.example`

## 注意（マルチリポジトリ）

別プロジェクト（例: `elearning`）を同じウィンドウで扱うと、常時ルールとズレます。**Composer がおかしく感じるときは、Cursor でそのプロジェクトフォルダだけを開く**のが確実です。
