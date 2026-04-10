# ログ記録ルール

## ログファイルの仕様

### パス
```
logs/analytics.jsonl
```

### 形式
JSONL（JSON Lines）：1行1レコード。追記方式。

---

## ログスキーマ

```typescript
interface AnalyticsLog {
  timestamp: string;        // ISO 8601形式（例: "2026-04-10T12:34:56.789Z"）
  tool: string;             // 呼び出されたMCPツール名
  query: {                  // 検索条件
    width_mm?: number;
    height_mm?: number;
    depth_mm?: number;
    price_max?: number;
    color?: string;
    [key: string]: unknown;
  };
  intent: string;           // AIエージェントが送ってきた目的・背景
  hit_count: number;        // ヒット件数
  miss: boolean;            // 適合なし = true（ビジネスチャンスの記録）
  miss_reason?: string;     // ミスの理由（"no_matching_size", "out_of_stock" 等）
}
```

### 記録例
```jsonl
{"timestamp":"2026-04-10T12:00:00Z","tool":"search_products","query":{"width_mm":425},"intent":"脱衣所の洗濯機横の隙間に収納を入れたい。幅が425mm程度でないと入らない。","hit_count":0,"miss":true,"miss_reason":"no_matching_size"}
{"timestamp":"2026-04-10T12:05:00Z","tool":"search_products","query":{"width_mm":900,"price_max":15000},"intent":"リビングの壁面に本棚を置きたい。予算は1万5千円以内。","hit_count":3,"miss":false}
```

---

## 実装ルール

### 必ず記録するタイミング
1. 検索ツール呼び出し時（ヒット・ミスに関わらず）
2. 商品詳細取得時

### ログ書き込みはノンブロッキングで行うこと

```typescript
// ✅ GOOD: 検索結果の返却とログ書き込みを並列実行
const [results] = await Promise.all([
  searchProducts(params),
  logAnalytics(logEntry)   // ログ失敗でもメイン処理に影響させない
]);

// ❌ BAD: ログ書き込みを待ってから返却
await logAnalytics(logEntry);
return searchProducts(params);
```

### ログ書き込みのエラーハンドリング
```typescript
// ログ失敗はconsole.errorに留め、ユーザーへのレスポンスは必ず返すこと
try {
  await appendFile('logs/analytics.jsonl', JSON.stringify(entry) + '\n');
} catch (e) {
  console.error('[Analytics] Log write failed:', e);
}
```

---

## ログの活用

- `logs/analytics.jsonl` は定期的に集計・分析すること
- miss=true のレコードを抽出 → 市場の隙間レポートを作成
- intent の頻出キーワードを分析 → カテゴリ・在庫戦略に反映
