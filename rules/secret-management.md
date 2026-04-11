# シークレット管理ルール（最優先）

全ルールに優先する。違反時は他の全作業を即座に中止して修正すること。

## 原則

**秘密情報はすべて `.env` ファイルにのみ格納する。**
ソースコード・コメント・ドキュメント・テストデータ・ログ例に実際の値を書いてはならない。

## 秘密情報の定義

以下はすべて秘密情報として扱う:

| 種別 | 例 |
|------|-----|
| APIキー | 楽天APP_ID、楽天ACCESS_KEY、Amazon PA-APIキー、Gemini APIキー |
| アフィリエイトID | Amazon アソシエイトタグ、楽天アフィリエイトID |
| 認証トークン | MCP_API_KEY、Bearer トークン |
| インフラ情報 | サーバーIPアドレス、デプロイURL（内部用） |
| 個人情報 | 開発者名、メールアドレス |

## 禁止パターン

```
# NG: コメントに実値を書く
// 本番ID: myid-22
// APP_ID: abcd1234-xxxx-...

# NG: ドキュメントに実値を書く
- アプリID: `abcd1234-...`
- 楽天ID: `aabbccdd.11223344...`

# NG: テストコードに実値をハードコード
const API_KEY = "AIzaSyXXXXXXXXX...";

# NG: .env.example に実値をサンプルとして書く
AFFILIATE_ID_RAKUTEN=aabbccdd.11223344...
```

## 正しいパターン

```
# OK: .env.example にはダミー値
AFFILIATE_ID_RAKUTEN=your_rakuten_id_here

# OK: コメントにはフォーマットのみ
// ドット区切り4パート形式（例: xxxxxxxx.xxxxxxxx.xxxxxxxx.xxxxxxxx）

# OK: テストでは環境変数から読む
const apiKey = process.env["AFFILIATE_ID_AMAZON"] ?? "";

# OK: ドキュメントではマスク
- ID: `<REDACTED>`（設定済み）
```

## コミット前チェックリスト

1. `git diff` で以下の文字列パターンがないことを確認:
   - `AIzaSy` で始まる文字列
   - `pk_` / `sk_` で始まる文字列
   - ドット区切りの8桁HEX × 4（楽天ID形式）
   - IPアドレス（プライベート/パブリック問わず）
2. 新規ファイルは `git add` 前に上記パターンでgrep
3. `.env` が `git ls-files` に含まれていないことを確認

## 漏洩時の対応手順

1. **即座にファイルから除去**（`<REDACTED>` に置換）
2. **原本を `.secrets_backup/` に隔離**（.gitignore済み）
3. **漏洩したキーを再発行**（旧キー無効化）
4. **Git履歴からの除去を検討**（BFG Repo-Cleaner等）
5. **pushしていた場合はGitHubのSecret Scanning Alertsを確認**
