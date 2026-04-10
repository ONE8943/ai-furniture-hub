# 需要ギャップ検知ルール (v1.3)

## 目的

AIエージェントが「現在データが存在しない属性」を要求した際、それを**ビジネスチャンス**として記録する。
「提供できるデータ」と「求められているデータ」の差分こそが、次のスキーマ拡張・仕入れ戦略・メーカー交渉の根拠になる。

---

## 検知の仕組み（3ステップ）

### Step 1: Unknown Parameter Catch
AIエージェントが `intent` 内で言及したが、現在の `ProductSchema` に存在しない属性をキーワードマッチで検出。
エラーで返すのではなく「需要として記録し、レスポンスに通知する」。

### Step 2: Gap Log（`logs/requirement_gaps.jsonl`）
検出した不足項目を JSONL に記録。

### Step 3: Schema Suggestion
頻度が高いギャップ項目を集計 → 開発者への「スキーマ拡張の提案」に使う（将来実装）。

---

## 検知キーワード辞書（`utils/gap_detector.ts` に定義）

| 検知キーワード（日本語） | 対応する attribute_key | 説明 |
|-------------------------|----------------------|------|
| 耐荷重, 荷重, kg以上 | `load_capacity_kg` | 棚の耐えられる重さ |
| 防炎, 難燃, 消防法 | `fire_resistant` | 防炎・難燃性能 |
| ホルムアルデヒド, F☆☆☆☆, 低VOC | `formaldehyde_grade` | 化学物質放散等級 |
| 組み立て難易度, 組み立て時間, 工具不要 | `assembly_difficulty` | 組み立てのしやすさ |
| 子供, 幼児, 安全, 角が丸い | `child_safe` | 子供向け安全設計 |
| キャスター, 移動, 車輪 | `has_casters` | キャスター有無 |
| 防水, 耐水, 防湿, 浴室 | `water_resistant` | 水濡れへの耐性 |
| 地震, 転倒防止, 耐震 | `earthquake_resistant` | 転倒防止・耐震機能 |
| 引き出し, ドロワー | `has_drawers` | 引き出し有無 |
| 鍵, ロック, 施錠 | `has_lock` | 鍵・ロック機能 |
| 重さ, 重量, 本体重量 | `weight_kg` | 商品自体の重量 |
| 日本製, 国産, メイドインジャパン | `made_in_japan` | 製造国 |
| 保証, 品質保証, アフターサービス | `warranty_years` | 保証期間 |
| エコ, 環境, FSC, 再生材 | `eco_certified` | 環境認証 |
| 段数, 棚板, 棚の数 | `shelf_count` | 棚板の枚数 |

---

## ログスキーマ（`schemas/requirement_gap.ts`）

```typescript
interface RequirementGap {
  timestamp: string;             // ISO 8601
  tool: string;                  // 呼び出しツール名
  intent: string;                // 元のintentテキスト
  detected_attributes: string[]; // 検出された attribute_key の配列
  keywords_matched: string[];    // マッチした実際のキーワード
  search_context: {              // 検索の文脈
    had_results: boolean;
    hit_count: number;
  };
}
```

---

## レスポンスへのフィードバック

ギャップを検知した場合、通常のレスポンスに以下を追加する：

```json
"gap_feedback": {
  "message": "ご要望の「耐荷重」「防水」に関するデータは現在収集中です。ニーズとして記録しました。",
  "detected_needs": ["load_capacity_kg", "water_resistant"],
  "note": "今後のデータ拡充の優先項目として反映されます。"
}
```

---

## 実装上の注意

- キーワードマッチは**大文字・小文字・全角半角を正規化**してから行うこと
- ギャップ記録はノンブロッキング（`logAnalytics` と同じパターン）
- ギャップが検知されなかった場合は `requirement_gaps.jsonl` に書き込まない（ノイズ防止）
