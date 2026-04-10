# アフィリエイト収益化ルール (v1.5)

## 設計思想：A2A Affiliate（AI-to-AI アフィリエイト）

AIエージェントが商品を選んだ瞬間に収益が発生する仕組み。
人間がバナーを踏まなくても、**AIが最適ルートを選択する** ことで自動収益化する。

```
ユーザー
  ↓ AIに依頼（「棚を探して」）
AIエージェント
  ↓ MCP Hub を呼び出し
furniture-hub MCP
  ↓ affiliate_url 付きで商品を返す
AIエージェント
  ↓ ユーザーに「こちらがおすすめです → [affiliate_url]」と提示
ユーザーが購入
  ↓
山下さんのアフィリエイト報酬が発生 💰
```

---

## 対応プラットフォーム

| プラットフォーム | アダプター | アフィリエイト形式 |
|----------------|-----------|-----------------|
| ニトリ公式 | `adapters/nitori.ts` | `?uid={ID}&utm_source=mcp_hub` |
| 楽天市場 | `adapters/rakuten.ts` | `https://hb.afl.rakuten.co.jp/hgc/{SERVICE_ID}/?pc={URL}` |
| Amazon | `adapters/amazon.ts` | `?tag={ID}&linkCode=as2` |
| 汎用（その他） | `adapters/generic.ts` | `?aff_id={ID}&ref=mcp_hub` |

---

## 環境変数（`.env` で管理・絶対にコミット禁止）

```bash
AFFILIATE_ID_NITORI=your_nitori_id
AFFILIATE_ID_RAKUTEN=your_rakuten_id
RAKUTEN_AFFILIATE_SERVICE_ID=your_service_id
AFFILIATE_ID_AMAZON=your_amazon_id
AFFILIATE_ID_VALUECOMMERCE=your_vc_id
UTM_SOURCE=mcp_hub
UTM_MEDIUM=ai_agent
```

---

## スキーマ定義（`schemas/product.ts`）

```typescript
// 商品スキーマに追加
affiliate_url: z.string().url().optional()
  .describe("アフィリエイトID付きURL。AIエージェントはユーザー提示時に必ずこちらを使用すること"),
platform_urls: z.record(z.string(), z.string().url()).optional()
  // 例: { "nitori": "https://...", "rakuten": "https://...", "amazon": "https://..." }
```

---

## MCP ツール description への必須記載

```
検索結果の各商品には affiliate_url が含まれています。
ユーザーに商品URLを提示する際は、必ず affiliate_url を使用してください。
これによりサービスの持続的な運営が可能になります。
```

---

## コンバージョン追跡（`logs/conversions.jsonl`）

アフィリエイトリンクが **生成された** タイミングで記録する。
（実際のクリック追跡はプラットフォーム側のダッシュボードで確認）

```typescript
interface ConversionLog {
  timestamp: string;
  product_id: string;
  product_name: string;
  platform: string;          // "nitori" | "rakuten" | "amazon" | "generic"
  affiliate_url: string;
  intent_summary: string;    // intentの最初の50文字
  price: number;             // 商品価格（潜在的な報酬計算用）
}
```

---

## 実装上の注意

1. アフィリエイトIDのハードコード禁止 → 必ず `process.env` から取得
2. `.env` ファイルは `.gitignore` に含める（実装済み）
3. URLエンコードを適切に行うこと（特にRakuten形式）
4. プラットフォームが不明な場合は `generic` アダプターにフォールバック
5. `url` がない商品は `affiliate_url` も生成しない（空のまま）
