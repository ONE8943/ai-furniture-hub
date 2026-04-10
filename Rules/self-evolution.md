# Self-Evolution Layer ルール (v1.4)

## 設計思想：「提案するAI、決断する人間」

完全自動のスキーマ改変は行わない。AIが「何が足りないか」を発見して提案し、
管理者（山下さん）が承認した時だけシステムが進化する **半自動ループ** を採用する。

これにより：
- 法的リスクの所在を明確化（承認者 = 意思決定者）
- 暴走・誤検知によるシステム破壊を防止
- 「AIの提案ログ」がメーカーへの交渉材料になる

---

## 自己進化ループの4ステップ

```
Step 1: Detection（検知）
  requirement_gaps.jsonl を定期集計
  → 頻度が閾値（PROPOSAL_THRESHOLD）を超えた属性を特定

Step 2: Proposal Generation（提案生成）
  proposals/pending/ に提案ファイル(.json)を自動作成
  内容：属性名・説明・Zodスキーマ案・取得先ヒント・需要件数

Step 3: Admin Approval（管理者承認）
  `npm run review` でCLIを起動
  → 提案一覧を表示、承認(y)/却下(n)を選択
  → 承認: proposals/approved/ へ移動
  → 却下: proposals/rejected/ へ移動（理由を記録）

Step 4: Implementation（実装）
  承認済み提案は `proposals/approved/` に蓄積される
  開発者（またはAI）がそれを読んで schemas/product.ts に手動追加
  （将来的には自動パッチ生成も可能）
```

---

## プロポーザルファイル形式 (`proposals/pending/`)

```json
{
  "id": "prop_20260410_load_capacity_kg",
  "attribute_key": "load_capacity_kg",
  "status": "pending",
  "created_at": "2026-04-10T12:00:00Z",
  "demand_count": 5,
  "description": "棚の耐えられる最大荷重（kg）",
  "zod_schema_suggestion": "load_capacity_kg: z.number().positive().optional().describe('最大耐荷重（kg）')",
  "scraping_hint": "商品ページの「商品仕様」テーブルから「耐荷重」「最大積載量」を取得",
  "sample_intents": [
    "本棚として使いたい。耐荷重50kg以上の棚が欲しい。"
  ]
}
```

---

## 法的ガードレール

### ① robots.txt / llms.txt の確認（スクレイピング前に必須）
将来のスクレイピング拡張時は、対象サイトの収集ポリシーを確認してから実行すること。

### ② レートリミット（必須）
スクレイピング実施時は最低でも **3〜5秒のウェイト** を入れること。
秒間1リクエスト以下を厳守（偽計業務妨害リスク回避）。

### ③ 「引用・送客」スタンスの維持
データの目的は「AIエージェントをメーカー公式サイトへ誘導する精度向上」であること。
商品データを「盗む」のではなく、「正確なガイドとして活用する」形を崩さない。

---

## 閾値設定（`utils/proposal_generator.ts`）

| 定数 | 値 | 説明 |
|------|-----|------|
| `PROPOSAL_THRESHOLD` | 2 | この回数以上検知されたら提案生成 |
| `MAX_PROPOSALS_PER_RUN` | 5 | 1回の集計で生成する提案の最大数 |

---

## ファイル構成

```
proposals/
  pending/    ← AIが生成した提案（承認待ち）
  approved/   ← 管理者が承認した提案（実装予定）
  rejected/   ← 却下された提案（理由付き）
```
