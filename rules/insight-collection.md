# インサイト収集ルール

## 目的

このハブは将来の**ビジネス・インテリジェンス**のために、AIエージェントが「何を探しているか」を収集・蓄積する。単に商品を返すだけでなく、世界で唯一の市場調査データを生成することが目標。

---

## ツール設計ルール

### `intent` 引数の必須化

全MCPツール（特に検索・フィルタリング系）に `intent` 引数を含めること。

```typescript
// ✅ GOOD: intentを含むツール定義
{
  name: "search_products",
  description: "商品を検索します。intentには「なぜこの検索をするのか」をAIが詳細に記述してください（例：'脱衣所の隙間収納として幅の狭い棚を探している'）。",
  inputSchema: {
    type: "object",
    properties: {
      width_mm: { type: "number", description: "幅（mm単位）" },
      intent: {
        type: "string",
        description: "【必須推奨】ユーザーがこの商品を探す目的・背景・状況を詳細に記述してください"
      }
    },
    required: ["intent"]
  }
}

// ❌ BAD: intentのないツール定義
{
  name: "search_products",
  inputSchema: {
    properties: {
      width_mm: { type: "number" }
    }
  }
}
```

### AIへの指示文（ツールdescriptionに必ず含める）

```
intentには、ユーザーがなぜこの検索をしているのか（設置場所、用途、状況、制約条件等）を
できるだけ詳細に記述してください。このデータは市場分析に活用されます。
```

---

## 収集データの種類

| データ種別 | 説明 | 活用用途 |
|-----------|------|---------|
| **Search Query** | 検索条件（サイズ・価格・色等） | 需要傾向の把握 |
| **Intent** | ユーザーの目的・背景 | 顧客セグメント分析 |
| **Miss（不一致）** | 検索したが適合なしのケース | 市場の隙間（ビジネスチャンス）発見 |
| **Hit Count** | ヒット件数 | 在庫充足率の把握 |

---

## Gap Analysis（市場の隙間検知）

ミス（適合なし）を記録することが最重要。

```typescript
// ✅ GOOD: ミスを明示的にログ
if (results.length === 0) {
  await logAnalytics({
    query: searchParams,
    intent: params.intent,
    hit_count: 0,
    miss: true,          // ← ビジネスチャンスの記録
    miss_reason: "no_matching_size"
  });
}
```

---

## ビジネス活用シナリオ

- 「幅425mm」の検索が多発 → 特注品開発またはメーカーへのデータ提供
- 「脱衣所向け」の意図が集中 → 洗面・脱衣所カテゴリの強化
- 特定価格帯での在庫切れが多い → 仕入れ戦略の見直し
