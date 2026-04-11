# Gemini Flash 調査指示テンプレート集

Gemini Flash（別セッション）にコピペで渡す調査指示。
調査結果は `staging/research_[テーマ].jsonl` に出力するか、Markdownで返す。

---

## 1. 製品コーディネート調査（組み合わせ事例）

```
@.cursor/rules/research-mode.mdc を読み込んでください。

## 調査依頼: 製品コーディネート事例の収集

### テーマ
[カテゴリ名]（例: カラーボックス、スチールラック、突っ張り棒）の
実際のコーディネート事例と「一緒に買うべきアイテム」を調査してください。

### 調査ソース
1. **ブログ**: RoomClip, folk, macaroni, LIMIA 等のインテリア系記事
2. **SNS**: Instagram #[カテゴリ]収納, X(Twitter) [ブランド名]収納, Pinterest
3. **EC**: 楽天「この商品を買った人はこんな商品も」、Amazon「よく一緒に購入」
4. **メーカー**: ニトリ/IKEA/無印の公式コーディネート提案ページ

### 出力形式
以下のJSONLフォーマットで返してください。1行1エントリ。

```jsonl
{"source_product":"[元製品名]","source_brand":"[ブランド]","related_name":"[関連アイテム名]","relation":"requires|protects_with|fits_inside|coordinates_with|enhances_with","why":"[なぜセットで使うか]","search_keywords":["楽天検索用キーワード1","キーワード2"],"price_range_yen":{"min":0,"max":0},"required":true|false,"source_url":"[情報元URL]","source_type":"blog|sns|ec|maker"}
```

### 具体的に知りたいこと
- [製品名] を購入した人が実際に一緒に買っているもの
- 「これも必要だった」「買い忘れて後悔した」系のレビュー情報
- コーディネート写真で一緒に写っている小物・パーツ
- メーカー公式で推奨している組み合わせ

### 注意
- コードの変更は不要です（読み取りのみ）
- 寸法はmm、価格は円（整数）
- 個人の名前・住所等は記録しない
```

---

## 2. ブランド別 新製品・ラインナップ調査

```
@.cursor/rules/research-mode.mdc を読み込んでください。

## 調査依頼: [ブランド名] 製品ラインナップ調査

### テーマ
[ブランド名]（例: ニトリ、IKEA、無印良品）の収納・家具カテゴリから、
当プロジェクトに未登録の製品を調査してください。

### 現在の登録状況
まず `npm run research -- --catalog` でカタログ統計を確認し、
`shared/catalog/known_products.ts` で現在登録されている[ブランド名]の製品を確認してください。

### 調査範囲
- 公式サイトの製品一覧ページ
- 楽天・Amazon での人気商品（レビュー数順）
- 新製品・リニューアル品
- 当プロジェクトのカテゴリに合致するもの（19カテゴリ）

### 出力形式
`staging/research_[ブランド名].jsonl` に書き込むためのJSONL。
スキーマは `scripts/review_research.ts` の `ResearchEntrySchema` を参照。

### 注意
- コードの変更は不要です
- 寸法はmm、価格は円（整数）
- 内寸が不明な場合は0にする
```

---

## 3. SNS・ブログで人気の収納テクニック調査

```
@.cursor/rules/research-mode.mdc を読み込んでください。

## 調査依頼: SNS/ブログで人気の収納テクニック

### テーマ
Instagram, RoomClip, Pinterest, YouTube 等で2024-2026年に話題になった
収納テクニック・コーディネート事例を調査してください。

### 調査観点
1. **バズった収納術**: いいね数・リツイート数が多い投稿の傾向
2. **定番組み合わせ**: 「○○には△△」という鉄板パターン
3. **新トレンド**: 最近注目されている新しい組み合わせ
4. **失敗談**: 「これを買い忘れた」「これは不要だった」

### 出力形式
Markdownで以下の構造：

## 調査結果: SNS収納トレンド

### トレンド1: [テーマ名]
- **概要**: 
- **定番組み合わせ**: [製品A] + [製品B] + [製品C]
- **なぜ人気**: 
- **参考URL**: 

### トレンド2: ...

### 当プロジェクトへの推奨アクション
- related_items に追加すべき組み合わせ: ...
- 新製品として追加すべきアイテム: ...
- 新カテゴリの検討: ...

### 注意
- コードの変更は不要です
```

---

## 4. 「一緒に買われている」調査（楽天/Amazon）

```
@.cursor/rules/research-mode.mdc を読み込んでください。

## 調査依頼: ECサイトの「一緒に買われている」データ収集

### テーマ
以下の製品カテゴリについて、楽天・Amazonの
「この商品を買った人はこんな商品も買っています」データを収集してください。

### 対象カテゴリ
- [ ] カラーボックス（ニトリ Nクリック等）
- [ ] スチールラック（ルミナス、アイリス等）
- [ ] 突っ張り棒（平安伸銅等）
- [ ] デスク（LOWYA、山善等）
- [ ] ベビーゲート

### 出力形式
以下のJSONLフォーマット:

```jsonl
{"source_product":"カラーボックス 3段","ec_platform":"rakuten","related_name":"インナーボックス","relation":"fits_inside","buy_together_rank":1,"search_keywords":["カラーボックス インナーボックス"],"price_range_yen":{"min":300,"max":1500},"source_url":"https://..."}
```

### 注意
- コードの変更は不要です
- 実際にページを確認して正確な情報を
```

---

## 5. コーディネート写真からの組み合わせ抽出

```
@.cursor/rules/research-mode.mdc を読み込んでください。

## 調査依頼: コーディネート写真に写っている製品の特定

### テーマ
以下のコーディネート系サイトの写真から、
一緒に使われている製品の組み合わせを抽出してください。

### 調査サイト
- RoomClip: https://roomclip.jp/tag/[キーワード]
- folk: https://folk-media.com/tag/[キーワード]
- IKEA ルームセット: https://www.ikea.com/jp/ja/rooms/
- ニトリ コーディネート: https://www.nitori-net.jp/ec/cat/CoordinateList/

### 出力形式
写真ごとに以下をまとめる:

### コーディネート事例 [番号]
- **設置場所**: リビング / キッチン / 洗面所 等
- **メイン製品**: [棚/ラック等の名前、推定ブランド]
- **一緒に使われているもの**:
  1. [アイテム名] - [用途/理由]
  2. [アイテム名] - [用途/理由]
- **参考URL**: [画像ページのURL]

### 注意
- コードの変更は不要
- 個人の名前・住所は記録しない
```

---

## 6. 【推奨】Opus お手本付き データ充実調査

> **このテンプレートが最も精度が高い**。Opus が実際にWeb調査して作成したお手本データを
> 含むため、Gemini は出力フォーマット・品質基準・調査先を正確に理解できる。

```
@.cursor/rules/research-mode.mdc を読み込んでください。

## 調査依頼: 既存製品の関連アイテム・互換収納データ充実

### 概要
known_products.ts に登録済みの製品について、
`related_items`（関連アイテム）と `compatible_storage`（互換収納）の
データを充実させてください。

### 対象製品
[product_id一覧をenrich:gapsの出力から貼り付ける]

### 調査ソース（優先順）
1. **メーカー公式サイト** → source_type: "maker"
   - ニトリ: nitori-net.jp（セット提案ページ、オプションパーツ一覧）
   - IKEA: ikea.com/jp/ja（インサート/アクセサリ一覧）
   - 無印: muji.com/jp（シミュレーター、関連商品欄）
2. **ブログ記事** → source_type: "blog"
   - RoomClip(roomclip.jp), folk, LIMIA, 暮らしの音(kurashino-ne.net)
   - 「○○ 収納 おすすめ」「○○ シンデレラフィット」で検索
3. **ECサイト** → source_type: "ec"
   - 楽天「この商品を買った人は」、Amazon「よく一緒に購入」
4. **SNS** → source_type: "sns"
   - Instagram: #[製品名]収納, #[ブランド名]収納
   - RoomClip投稿の実例写真

### 出力形式
staging/enrich_[テーマ].jsonl にJSONL形式で出力。1行1エントリ。

### ======= Opus が作成したお手本（これと同じ品質で書くこと） =======

#### お手本1: ニトリ Nクリック → Nインボックス (fits_inside)
```jsonl
{"product_id":"nitori-nclick-regular-2","source_product":"ニトリ Nクリック レギュラー2段","source_brand":"ニトリ","related_name":"Nインボックス レギュラー","relation":"fits_inside","why":"Nクリック内寸380x260mmに対しNインボックス(389x266x236mm)がシンデレラフィット。ニトリ公式でセット推奨。引き出し式で中身が見えずスッキリ","search_keywords":["ニトリ Nインボックス レギュラー","Nインボックス 収納ケース"],"price_range_yen":{"min":712,"max":899},"required":false,"source_type":"maker","source_url":"https://www.nitori-net.jp/ec/keyword/Nインボックス/","scene":"リビング収納","tags":["公式推奨","シンデレラフィット","定番"]}
```
**↑ ポイント**: 
- `why` に内寸との適合理由を具体的mm付きで記載
- `source_url` は実在するURL（ニトリ公式のキーワード検索結果ページ）
- `tags` に「公式推奨」「シンデレラフィット」等の根拠を明記

#### お手本2: ニトリ Nクリック → 追加棚板 (enhances_with)
```jsonl
{"product_id":"nitori-nclick-regular-2","source_product":"ニトリ Nクリック レギュラー2段","source_brand":"ニトリ","related_name":"Nクリック用追加棚板 レギュラー","relation":"enhances_with","why":"棚板を追加して3段→4段等にカスタマイズ可能。棚板1枚耐荷重20kgで一般カラボの2倍。25mmピッチで高さ調整自在","search_keywords":["ニトリ Nクリック 追加棚板 レギュラー","Nクリック 棚板"],"price_range_yen":{"min":799,"max":1290},"required":false,"source_type":"maker","source_url":"https://www.nitori-net.jp/ec/keyword/nクリック%20棚板/","scene":"カスタマイズ","tags":["公式パーツ","カスタマイズ"]}
```
**↑ ポイント**: 
- `relation` は "enhances_with"（機能拡張パーツ）
- 価格帯は色/サイズバリエーションの幅を反映（799〜1,290円）

#### お手本3: IKEA KALLAX → ドローナ (fits_inside)
```jsonl
{"product_id":"ikea-kallax-1x4","source_product":"IKEA KALLAX 1x4","source_brand":"IKEA","related_name":"DRÖNA ドローナ ボックス 33x38x33cm","relation":"fits_inside","why":"KALLAX 1マス内寸330x380mmにドローナ(330x380x330mm)が完璧フィット。399円と格安で8000件超レビュー平均4.7/5。使わない時は折り畳み可","search_keywords":["IKEA ドローナ DRÖNA 33","KALLAX 収納ボックス"],"price_range_yen":{"min":399,"max":399},"required":false,"source_type":"maker","source_url":"https://www.ikea.com/jp/ja/p/droena-box-black-10219282/","scene":"リビング収納","tags":["公式推奨","定番","格安"]}
```
**↑ ポイント**: 
- `source_url` はIKEA公式の商品ページ（実在確認済み）
- レビュー件数・評点を `why` に含めると説得力UP

#### お手本4: メタルラック → 100均PPシート (protects_with)
```jsonl
{"product_id":"iris-metal-rack-3tier-w90","source_product":"アイリスオーヤマ メタルラック 3段 幅91cm","source_brand":"アイリスオーヤマ","related_name":"ダイソー PPシート 460x910mm","relation":"protects_with","why":"メタルラックのワイヤー棚板は隙間があり小物が落ちる。PPシートを敷くと平面になり収納しやすい。110円で1枚","search_keywords":["ダイソー PPシート メタルラック","100均 メタルラック シート"],"price_range_yen":{"min":110,"max":110},"required":false,"source_type":"sns","source_url":"https://roomclip.jp/tag/3482x11920","scene":"キッチン・ランドリー","tags":["100均","裏技","RoomClip人気"]}
```
**↑ ポイント**: 
- `source_type` を "sns"（RoomClipの実例投稿が根拠）にしている
- 100均アイテムも `relation: "protects_with"` で取り込める
- ブログ/SNSで頻出する「裏技」系は `tags` に明記

#### お手本5: 無印スタッキングシェルフ → ラタンバスケット (fits_inside)
```jsonl
{"product_id":"muji-stacking-2tier","source_product":"無印良品 スタッキングシェルフ 2段 オーク材","source_brand":"無印良品","related_name":"重なるラタン長方形バスケット 中","relation":"fits_inside","why":"ラタン素材で温かみのある収納。スタッキングシェルフ1マスに収まるサイズ。積み重ね可能でスペース効率が良い","search_keywords":["無印良品 ラタン バスケット 長方形 中","無印 ラタン 収納"],"price_range_yen":{"min":1990,"max":2990},"required":false,"source_type":"blog","source_url":"https://everydayhappiest.com/muji-shelf","scene":"リビング・和室","tags":["定番","ナチュラル","組み合わせ人気"]}
```
**↑ ポイント**: 
- `source_url` はブログの実購入レビュー記事（実在確認済み）
- 「見せる収納(ラタン)と隠す収納(チェスト)の混合」は無印スタイルの定番

### ======= お手本ここまで =======

### 品質基準（お手本を参考に守ること）
1. `product_id` は known_products.ts の既存IDと **完全一致** させること
2. `why` は **10文字以上**、サイズ(mm)や具体的根拠を含むこと
3. `source_url` は **実在するページのURL** を記載（架空URL禁止）
4. `search_keywords` は **楽天で実際にヒットするキーワード** を2個以上
5. `price_range_yen` は **円(整数)** で min ≤ max
6. `relation` は以下のみ: requires, protects_with, fits_inside, coordinates_with, enhances_with, alternative
7. `source_type` は以下のみ: blog, sns, ec, maker, review, other

### 調査の進め方
1. まず対象製品の **公式サイト** を確認（最も信頼性が高い）
2. 次に **「○○ 収納 おすすめ」** でブログ記事を検索
3. RoomClip で **タグ検索** して実例写真を確認
4. 各エントリに必ず `source_url` と `source_type` を付ける
5. 不明な情報は **書かない**（推測で埋めない）

### 注意
- コードの変更は不要です（読み取りのみ）
- 寸法はmm、価格は円（整数）
- 個人の名前・住所等は記録しない
- 1製品あたり3〜5件の関連アイテムが目標
```

---

## テンプレート7: 代用品・ライフハック調査

YouTube/ブログ/SNSで紹介されている「高い専用品の代わりになる安い代替品」を調査する。

```
### 調査対象
以下の製品カテゴリについて、100均やホームセンターで手に入る代替品・ライフハックを調査してください。

カテゴリ: [カテゴリ名（例: スチールラック用アクセサリ、デスク整理グッズ）]

### 出力形式
1行1件のJSONL形式で出力してください。
{"target_product":"正規品の名前","target_price_yen":1000,"hack_product":"代替品の名前","hack_price_yen":100,"where_to_buy":"100均/ホームセンター等","original_use":"代替品の本来の用途","hack_use":"代替としての使い方","difficulty":"easy/medium/hard","risk_note":"注意点（あれば）","savings_percent":90,"source_url":"参考URL","source_platform":"youtube/blog/sns"}

### 調査の進め方
1. YouTube で「○○ 代用」「○○ 100均」「○○ ダイソー 代替」で検索
2. ブログで「○○ 代わり」「○○ 安い方法」で検索
3. 各エントリに必ず source_url を付ける
4. difficulty は実際の手順から判断（加工不要=easy、ちょっとした加工=medium、DIY=hard）
5. risk_note は品質差・耐久性の問題があれば必ず記載

### 注意
- 寸法はmm、価格は円（整数）
- 安全性に問題がある代替品は risk_note に必ず記載
- source_url は実在するページのURLを記載（架空URL禁止）
```

---

## テンプレート8: インフルエンサーPick調査

YouTube・ブログ・雑誌で紹介されたおすすめ商品セットを調査する。

```
### 調査対象
以下のカテゴリについて、YouTuber・ブロガー・整理収納アドバイザー・雑誌の「おすすめ○○選」を調査してください。

カテゴリ: [カテゴリ名（例: デスク周り、キッチン収納、一人暮らし家具）]

### 出力形式
1行1件のJSONL形式で出力してください。
{"curator_name":"紹介者名","curator_type":"YouTuber/ブロガー/整理収納アドバイザー/インテリアコーディネーター/雑誌編集部/専門家","curator_credential":"資格や実績","title":"記事/動画のタイトル","recommended_products":["商品名1","商品名2"],"why_picked":"選んだ理由の要約","source_url":"URL","source_platform":"youtube/blog/instagram/magazine","published_date":"YYYY-MM","view_count_hint":"再生回数目安"}

### 調査の進め方
1. YouTube で「○○ おすすめ ○○選」「○○ ルームツアー」で検索
2. ブログで「○○ 買ってよかった」「○○ レビュー」で検索
3. 雑誌は「LDK」「MONOQLO」「&Premium」「Casa BRUTUS」等を確認
4. 紹介者の情報（チャンネル名、フォロワー数等）を正確に記載
5. source_url は実在するページのURLを記載

### 注意
- 紹介者名は公開されているチャンネル名・ペンネームを使用
- 著作権のある写真・文章の引用は行わない（概要のみ）
- 個人の住所・電話番号等は記録しない
```

---

## テンプレート9: ルームプリセット調査

雑誌・カタログ・インテリアサイトの「ルームコーディネート例」を調査する。

```
### 調査対象
以下のシーンについて、IKEA/ニトリ/無印良品のカタログやインテリア雑誌のルームコーディネート例を調査してください。

シーン: [シーン名（例: 6畳一人暮らし、2LDKファミリーリビング、在宅ワーク書斎）]

### 出力形式
1行1件のJSONL形式で出力してください。
{"title":"プリセット名","scene":"シーン","target_persona":"ターゲット層","budget_total_yen":50000,"products":[{"name":"商品名","brand":"ブランド","role":"配置上の役割","price_yen":5000}],"layout_tip":"配置のコツ","photo_source":"参考画像の出典URL"}

### 調査の進め方
1. IKEA公式サイトの「ルームセット」ページを確認
2. ニトリの「コーディネート例」ページを確認
3. RoomClip で該当シーンのタグ検索
4. インテリア雑誌（&Premium, Casa BRUTUS等）の特集を確認
5. 各商品の価格は公式サイトで確認

### 注意
- 寸法はmm、価格は円（整数）
- 配置のコツ（layout_tip）は具体的に（「窓際に配置して自然光活用」等）
- 予算は全商品の合計（概算可）
- photo_source は公式カタログのURL（著作権に配慮）
```

---

## 使い方

### 基本フロー
1. Opusセッションで `npm run enrich:gaps` を実行し、データが不足している製品一覧を取得
2. テンプレート6の `[product_id一覧]` に貼り付け
3. Gemini Flash のセッションにコピペ
4. 調査結果(JSONL)を `staging/enrich_[テーマ].jsonl` に保存
5. Opusセッションに戻って `npm run enrich:review` で品質チェック
6. `npm run enrich:approve` で合格分を承認

### テンプレートの使い分け
| テンプレート | 用途 | 出力形式 |
|---|---|---|
| 1. コーディネート調査 | 組み合わせ事例の収集 | JSONL (coord_*.jsonl) |
| 2. ブランド別調査 | 新製品の発見 | JSONL (research_*.jsonl) |
| 3. SNSトレンド | 市場トレンド把握 | Markdown |
| 4. EC一緒に買われている | 購買データ収集 | JSONL (coord_*.jsonl) |
| 5. 写真からの抽出 | コーディネート分析 | Markdown |
| **6. お手本付き充実調査** | **既存製品のデータ充実** | **JSONL (enrich_*.jsonl)** |
| **7. 代用品・ライフハック調査** | **100均代替品等の発見** | **JSONL (hack_*.jsonl)** |
| **8. インフルエンサーPick調査** | **YouTuber/ブロガー推薦品** | **JSONL (influencer_*.jsonl)** |
| **9. ルームプリセット調査** | **雑誌/カタログ風ルームセット** | **JSONL (preset_*.jsonl)** |
