/**
 * メジャー家具・収納製品の既知スペックDB
 *
 * AIが画像から「これはニトリのNクリックっぽい」と推定してきたとき、
 * このDBで型番・内寸・消耗品情報まで返せるようにする。
 *
 * identify_product ツールのバックエンド。
 */

export type ProductCategory =
  | "シェルフ・棚" | "カラーボックス" | "収納ケース" | "ワゴン・可動収納"
  | "衣装ケース" | "スチールラック" | "デスク" | "キッチン収納"
  | "ランドリー収納" | "バス・洗面収納" | "玄関収納" | "テレビ台"
  | "本棚" | "クローゼット収納" | "ファイル収納" | "ベビー・安全対策"
  | "突っ張り棒・つっぱり" | "保護・補修材" | "パーツ・アクセサリ" | "その他";

export type RelationType =
  | "requires" | "protects_with" | "fits_inside"
  | "coordinates_with" | "enhances_with" | "alternative";

export interface RelatedItem {
  relation: RelationType;
  name: string;
  category: string;
  why: string;
  product_id?: string;
  search_keywords: string[];
  price_range?: { min: number; max: number };
  required: boolean;
}

export interface KnownProduct {
  id: string;
  brand: string;
  series: string;
  model_number: string;
  name: string;
  outer_width_mm: number;
  outer_height_mm: number;
  outer_depth_mm: number;
  inner_width_mm: number;
  inner_height_per_tier_mm: number;
  inner_depth_mm: number;
  tiers: number;
  price_range: { min: number; max: number };
  colors: string[];
  material: string;
  weight_kg: number;
  load_capacity_per_tier_kg: number;
  visual_features: string[];
  consumables: Consumable[];
  compatible_storage: CompatibleStorage[];
  url_template: string;
  category?: ProductCategory;
  related_items?: RelatedItem[];
  /** 廃番・旧型のとき true（後継は successors を参照） */
  discontinued?: boolean;
  /** 公式・実務上の後継候補（型番は目安。購入前にメーカー公式で要確認） */
  successors?: Array<{ model_number: string; name: string; note: string }>;
}

export interface Consumable {
  type: string;
  name: string;
  model_number: string;
  replacement_months: number;
  note: string;
}

export interface CompatibleStorage {
  name: string;
  model_number: string;
  width_mm: number;
  height_mm: number;
  depth_mm: number;
  fits_per_tier: number;
  note: string;
}

export const KNOWN_PRODUCTS_DB: KnownProduct[] = [
  // ===== ニトリ Nクリックシリーズ =====
  {
    id: "nitori-nclick-regular-3",
    brand: "ニトリ",
    series: "Nクリック",
    model_number: "8841424",
    name: "Nクリック レギュラー3段",
    outer_width_mm: 419,
    outer_height_mm: 878,
    outer_depth_mm: 298,
    inner_width_mm: 380,
    inner_height_per_tier_mm: 270,
    inner_depth_mm: 260,
    tiers: 3,
    price_range: { min: 2990, max: 3490 },
    colors: ["ホワイト", "ライトブラウン", "ミドルブラウン", "ダークブラウン"],
    material: "プリント紙化粧パーティクルボード",
    weight_kg: 11.2,
    load_capacity_per_tier_kg: 10,
    visual_features: [
      "工具不要のはめ込み式", "前面に丸い穴の連結部品が見える",
      "背板なし（一部モデル）", "天板・底板の角が直角",
    ],
    consumables: [
      {
        type: "キャスター",
        name: "Nクリック用キャスター4個セット",
        model_number: "8841518",
        replacement_months: 0,
        note: "オプション品。移動させたい場合に追加",
      },
    ],
    compatible_storage: [
      {
        name: "Nインボックス レギュラー",
        model_number: "8422031",
        width_mm: 389,
        height_mm: 236,
        depth_mm: 266,
        fits_per_tier: 1,
        note: "Nクリック レギュラー幅にぴったり",
      },
      {
        name: "Nインボックス ハーフ",
        model_number: "8422024",
        width_mm: 192,
        height_mm: 236,
        depth_mm: 266,
        fits_per_tier: 2,
        note: "2個並べてレギュラー幅を分割",
      },
    ],
    url_template: "https://www.nitori-net.jp/ec/product/{model_number}/",
    category: "カラーボックス",
    related_items: [
      { relation: "fits_inside", name: "Nインボックス レギュラー", category: "収納ケース", why: "内寸380×260mmに対しNインボックス(389×266×236mm)がシンデレラフィット。ニトリ公式セット推奨", search_keywords: ["ニトリ Nインボックス レギュラー", "Nインボックス 収納ケース"], price_range: { min: 679, max: 899 }, required: false },
      { relation: "enhances_with", name: "Nクリック用 追加棚板 レギュラー", category: "パーツ・アクセサリ", why: "25mmピッチで段数・間隔を増やせる。棚板1枚耐荷重10kgで日用品収納に十分", search_keywords: ["ニトリ Nクリック 追加棚板", "Nクリック 棚板 レギュラー"], price_range: { min: 799, max: 1290 }, required: false },
      { relation: "enhances_with", name: "Nクリック用 別売りキャスター 4個入", category: "パーツ・アクセサリ", why: "脚に取り付けて移動式に変身。掃除や模様替え時に便利。補強キャスターと組み合わせ推奨", search_keywords: ["ニトリ Nクリック キャスター", "Nクリック キャスター 4個"], price_range: { min: 999, max: 999 }, required: false },
    ],
  },
  {
    id: "nitori-nclick-regular-2",
    brand: "ニトリ",
    series: "Nクリック",
    model_number: "8841417",
    name: "Nクリック レギュラー2段",
    outer_width_mm: 419,
    outer_height_mm: 592,
    outer_depth_mm: 298,
    inner_width_mm: 380,
    inner_height_per_tier_mm: 270,
    inner_depth_mm: 260,
    tiers: 2,
    price_range: { min: 2490, max: 2990 },
    colors: ["ホワイト", "ライトブラウン", "ミドルブラウン", "ダークブラウン"],
    material: "プリント紙化粧パーティクルボード",
    weight_kg: 8.5,
    load_capacity_per_tier_kg: 10,
    visual_features: [
      "工具不要のはめ込み式", "Nクリック特有の連結穴",
      "レギュラー3段より低い", "2段構造",
    ],
    consumables: [],
    compatible_storage: [
      {
        name: "Nインボックス レギュラー",
        model_number: "8422031",
        width_mm: 389,
        height_mm: 236,
        depth_mm: 266,
        fits_per_tier: 1,
        note: "Nクリック レギュラー幅にぴったり",
      },
    ],
    url_template: "https://www.nitori-net.jp/ec/product/{model_number}/",
    category: "カラーボックス",
    related_items: [
      {
        relation: "fits_inside",
        name: "Nインボックス レギュラー",
        category: "収納ケース",
        why: "内寸幅380×奥行260mmに対し本体389×266×236mmが収まり、公式でもカラーボックス系インナーとして案内されている組み合わせ",
        search_keywords: ["ニトリ Nインボックス レギュラー","Nインボックス 収納ケース"],
        price_range: { min: 679, max: 899 },
        required: false,
      },
      {
        relation: "enhances_with",
        name: "Nクリック用 追加棚板 レギュラー",
        category: "パーツ・アクセサリ",
        why: "25mmピッチのはめ込み式で段数や間隔を増やせる。標準カラボ棚板より高耐荷重設計のラインで拡張性が高い",
        search_keywords: ["ニトリ Nクリック 追加棚板","Nクリック 棚板 レギュラー"],
        price_range: { min: 799, max: 1290 },
        required: false,
      },
      {
        relation: "enhances_with",
        name: "Nクリック用 別売りキャスター 4個入",
        category: "パーツ・アクセサリ",
        why: "脚に取り付けて移動式にでき、掃除や模様替え時の移動が楽。高さ約40mm前後の嵩上げで床との隙間も確保しやすい",
        search_keywords: ["ニトリ Nクリック キャスター","Nクリック キャスター 4個"],
        price_range: { min: 999, max: 1290 },
        required: false,
      },
    ],
  },
  {
    id: "nitori-nclick-wide-3",
    brand: "ニトリ",
    series: "Nクリック",
    model_number: "8841431",
    name: "Nクリック ワイド3段",
    outer_width_mm: 872,
    outer_height_mm: 878,
    outer_depth_mm: 298,
    inner_width_mm: 815,
    inner_height_per_tier_mm: 270,
    inner_depth_mm: 260,
    tiers: 3,
    price_range: { min: 4990, max: 5490 },
    colors: ["ホワイト", "ライトブラウン", "ミドルブラウン"],
    material: "プリント紙化粧パーティクルボード",
    weight_kg: 18.5,
    load_capacity_per_tier_kg: 10,
    visual_features: [
      "レギュラーの約2倍の幅", "はめ込み式", "中央に仕切り板なし",
    ],
    consumables: [],
    compatible_storage: [
      {
        name: "Nインボックス レギュラー",
        model_number: "8422031",
        width_mm: 389,
        height_mm: 236,
        depth_mm: 266,
        fits_per_tier: 2,
        note: "ワイド幅に2個並び",
      },
      {
        name: "Nインボックス ハーフ",
        model_number: "8422024",
        width_mm: 192,
        height_mm: 236,
        depth_mm: 266,
        fits_per_tier: 4,
        note: "ワイド幅に4個並び",
      },
    ],
    url_template: "https://www.nitori-net.jp/ec/product/{model_number}/",
    category: "カラーボックス",
    related_items: [
      {
        relation: "fits_inside",
        name: "Nインボックス レギュラー",
        category: "収納ケース",
        why: "各段内寸幅815×奥行260mmにレギュラー389×266×236mmを横2列で収容でき、ワイド列の定番レイアウト",
        search_keywords: ["ニトリ Nインボックス レギュラー","ワイド Nクリック インナー"],
        price_range: { min: 679, max: 899 },
        required: false,
      },
      {
        relation: "fits_inside",
        name: "Nインボックス ハーフ",
        category: "収納ケース",
        why: "幅192mmのハーフを1段に4個並べ、小物単位で仕切れる。奥行266mmは内寸260mmに近接しシリーズ整合",
        search_keywords: ["ニトリ Nインボックス ハーフ","Nインボックス ハーフ ニトリ"],
        price_range: { min: 499, max: 599 },
        required: false,
      },
      {
        relation: "protects_with",
        name: "家具転倒防止ベルト・金具",
        category: "保護・補修材",
        why: "外寸高さ878mm・幅872mmで質量も大きく、地震時の転倒リスクを下げるため壁面固定が推奨されるクラス",
        search_keywords: ["家具転倒防止ベルト","テレビ台 転倒防止 金具"],
        price_range: { min: 480, max: 2280 },
        required: false,
      },
    ],
  },

  // ===== IKEA KALLAX =====
  {
    id: "ikea-kallax-2x2",
    brand: "IKEA",
    series: "KALLAX",
    model_number: "202.758.14",
    name: "KALLAX シェルフユニット 2x2",
    outer_width_mm: 770,
    outer_height_mm: 770,
    outer_depth_mm: 390,
    inner_width_mm: 330,
    inner_height_per_tier_mm: 330,
    inner_depth_mm: 380,
    tiers: 4,
    price_range: { min: 5999, max: 6999 },
    colors: ["ホワイト", "ブラックブラウン", "ホワイトステインオーク調"],
    material: "パーティクルボード・繊維板",
    weight_kg: 18.0,
    load_capacity_per_tier_kg: 13,
    visual_features: [
      "正方形の開口部が4つ（2x2グリッド）", "壁掛け対応金具穴あり",
      "縦置き・横置き両対応", "角が直角でシンプルなデザイン",
    ],
    consumables: [],
    compatible_storage: [
      {
        name: "DRÖNA ボックス",
        model_number: "302.255.45",
        width_mm: 330,
        height_mm: 330,
        depth_mm: 380,
        fits_per_tier: 1,
        note: "KALLAX専用設計。各色あり",
      },
      {
        name: "KALLAX インサート 扉付き",
        model_number: "602.781.65",
        width_mm: 330,
        height_mm: 330,
        depth_mm: 370,
        fits_per_tier: 1,
        note: "見せたくない部分を隠せるオプション",
      },
    ],
    url_template: "https://www.ikea.com/jp/ja/p/-{model_number}/",
    category: "シェルフ・棚",
    related_items: [
      { relation: "fits_inside", name: "DRÖNA ドローナ ボックス 33×38×33cm", category: "収納ケース", why: "KALLAX 1マス内寸330×380mmにドローナ(330×380×330mm)が完璧フィット。399円で8000件超レビュー平均4.7/5", search_keywords: ["IKEA ドローナ DRÖNA 33", "KALLAX 収納ボックス"], price_range: { min: 399, max: 399 }, required: false },
      { relation: "enhances_with", name: "KALLAX インサート 扉", category: "パーツ・アクセサリ", why: "オープン棚の一部に扉を付けて見せる/隠す収納のメリハリ。KALLAX専用設計で工具不要", search_keywords: ["IKEA KALLAX インサート 扉", "カラックス 扉"], price_range: { min: 2000, max: 4500 }, required: false },
      { relation: "requires", name: "家具転倒防止金具・ストラップ", category: "保護・補修材", why: "高さ770mmで上段荷重時の転倒リスクあり。壁面固定を推奨", search_keywords: ["IKEA 転倒防止 金具", "家具 転倒防止 ストラップ"], price_range: { min: 200, max: 1500 }, required: true },
    ],
  },
  {
    id: "ikea-kallax-1x4",
    brand: "IKEA",
    series: "KALLAX",
    model_number: "802.758.45",
    name: "KALLAX シェルフユニット 1x4",
    outer_width_mm: 420,
    outer_height_mm: 1470,
    outer_depth_mm: 390,
    inner_width_mm: 330,
    inner_height_per_tier_mm: 330,
    inner_depth_mm: 380,
    tiers: 4,
    price_range: { min: 5999, max: 6999 },
    colors: ["ホワイト", "ブラックブラウン"],
    material: "パーティクルボード・繊維板",
    weight_kg: 18.0,
    load_capacity_per_tier_kg: 13,
    visual_features: [
      "縦長の4段構成", "KALLAX共通のグリッドデザイン",
      "横倒しで4列としても使える",
    ],
    consumables: [],
    compatible_storage: [
      {
        name: "DRÖNA ボックス",
        model_number: "302.255.45",
        width_mm: 330,
        height_mm: 330,
        depth_mm: 380,
        fits_per_tier: 1,
        note: "KALLAX専用設計",
      },
    ],
    url_template: "https://www.ikea.com/jp/ja/p/-{model_number}/",
    category: "シェルフ・棚",
    related_items: [
      {
        relation: "fits_inside",
        name: "DRÖNA ドローナ ボックス 33×38×33cm",
        category: "収納ケース",
        why: "KALLAX 1マス内寸約330×380mmに対しドローナ外寸330×380×330mmがジャスト。布製で軽く角が当たりにくい",
        search_keywords: ["IKEA ドローナ DRÖNA","KALLAX 収納ボックス 楽天"],
        price_range: { min: 399, max: 499 },
        required: false,
      },
      {
        relation: "enhances_with",
        name: "KALLAX インサート 扉（1マス用）",
        category: "パーツ・アクセサリ",
        why: "開口330×330mm前後のマスを扉付きにでき生活感を遮断。KALLAX専用でネジ位置が合う",
        search_keywords: ["IKEA KALLAX 扉 インサート","カラックス 扉 楽天"],
        price_range: { min: 2000, max: 4500 },
        required: false,
      },
      {
        relation: "fits_inside",
        name: "BRANÄS ブラネス バスケット 32×35×32cm",
        category: "収納ケース",
        why: "籐製で約320×350×320mm級。KALLAX内寸幅330mmに収まりやすく見せる収納の質感が上がる",
        search_keywords: ["IKEA BRANÄS バスケット","IKEA 籐 かご 楽天"],
        price_range: { min: 1999, max: 2999 },
        required: false,
      },
      {
        relation: "requires",
        name: "家具転倒防止金具・ストラップ",
        category: "保護・補修材",
        why: "縦長1470mmで上段荷重時の転倒リスクがある。壁面に固定し高さ2360mm未満の天井下でも安全余裕を確保",
        search_keywords: ["IKEA 転倒防止 金具","家具 転倒防止 ストラップ 楽天"],
        price_range: { min: 200, max: 1500 },
        required: true,
      },
    ],
  },

  // ===== アイリスオーヤマ メタルラック =====
  {
    id: "iris-metal-rack-3tier-w90",
    brand: "アイリスオーヤマ",
    series: "メタルラック",
    model_number: "MR-9018J",
    name: "メタルラック 3段 幅91cm",
    outer_width_mm: 910,
    outer_height_mm: 1790,
    outer_depth_mm: 460,
    inner_width_mm: 900,
    inner_height_per_tier_mm: 560,
    inner_depth_mm: 460,
    tiers: 3,
    price_range: { min: 3980, max: 5980 },
    colors: ["シルバー"],
    material: "スチール（クロムメッキ）",
    weight_kg: 12.5,
    load_capacity_per_tier_kg: 75,
    visual_features: [
      "ワイヤーメッシュ棚板", "ポール式で高さ調節可能",
      "シルバーメタリック", "格子状の棚板パターン",
    ],
    consumables: [
      {
        type: "棚板追加",
        name: "メタルラック棚板 幅91cm",
        model_number: "MR-91T",
        replacement_months: 0,
        note: "段数を増やしたい場合のオプション棚板",
      },
      {
        type: "キャスター",
        name: "メタルラック用キャスター 4個",
        model_number: "MR-4C",
        replacement_months: 0,
        note: "移動用キャスター（ストッパー付き2個含む）",
      },
    ],
    compatible_storage: [
      {
        name: "メタルラック用バスケット 幅45cm",
        model_number: "MR-45B",
        width_mm: 445,
        height_mm: 120,
        depth_mm: 420,
        fits_per_tier: 2,
        note: "引き出し式。2個横並びで幅90cm棚に対応",
      },
    ],
    url_template: "https://www.irisplaza.co.jp/index.php?KB=SHOSAI&SID={model_number}",
    category: "スチールラック",
    related_items: [
      {
        relation: "fits_inside",
        name: "メタルラック用 ワイヤーバスケット 幅90cm",
        category: "収納ケース",
        why: "棚板間のデッドスペースにバスケットを吊り下げて収納力を高められる。ポール径25mm向け純正品の確認がおすすめ",
        search_keywords: ["アイリスオーヤマ メタルラック バスケット 幅90","メタルラック ワイヤーバスケット MR"],
        price_range: { min: 1500, max: 2800 },
        required: false,
      },
      {
        relation: "protects_with",
        name: "ダイソー PPシート 460×910mm",
        category: "その他",
        why: "ワイヤー棚板の隙間から小物が落ちるのを防ぎ、平面にして収納しやすくする。100円ショップで手に入りやすい",
        search_keywords: ["ダイソー PPシート メタルラック","100均 メタルラック シート"],
        price_range: { min: 110, max: 110 },
        required: false,
      },
      {
        relation: "enhances_with",
        name: "メタルラック用 キャスター 4個セット",
        category: "パーツ・アクセサリ",
        why: "掃除やレイアウト変更のため本体を移動しやすくする。耐荷重とロック付きを選ぶと安心",
        search_keywords: ["アイリスオーヤマ メタルラック キャスター","メタルラック キャスター 25mm"],
        price_range: { min: 1200, max: 3500 },
        required: false,
      },
    ],
  },

  // ===== 無印良品 スタッキングシェルフ =====
  {
    id: "muji-stacking-2tier",
    brand: "無印良品",
    series: "スタッキングシェルフ",
    model_number: "37263207",
    name: "スタッキングシェルフ 2段 オーク材",
    outer_width_mm: 420,
    outer_height_mm: 815,
    outer_depth_mm: 285,
    inner_width_mm: 370,
    inner_height_per_tier_mm: 370,
    inner_depth_mm: 280,
    tiers: 2,
    price_range: { min: 11900, max: 12900 },
    colors: ["オーク材", "ウォールナット材"],
    material: "天然木化粧合板（オーク材突板）",
    weight_kg: 7.0,
    load_capacity_per_tier_kg: 20,
    visual_features: [
      "正方形の開口部", "木目が美しい天然木", "横にも縦にも連結可能",
      "角にR加工", "無印特有のシンプルデザイン",
    ],
    consumables: [],
    compatible_storage: [
      {
        name: "ポリプロピレン収納ボックス・ワイド",
        model_number: "37524956",
        width_mm: 370,
        height_mm: 175,
        depth_mm: 260,
        fits_per_tier: 1,
        note: "無印スタッキングシェルフ専用サイズ。2段積み可",
      },
      {
        name: "ラタンバスケット",
        model_number: "18821281",
        width_mm: 360,
        height_mm: 320,
        depth_mm: 260,
        fits_per_tier: 1,
        note: "見せる収納向き",
      },
    ],
    url_template: "https://www.muji.com/jp/ja/store/cmdty/detail/{model_number}",
    category: "シェルフ・棚",
    related_items: [
      {
        relation: "enhances_with",
        name: "スタッキングシェルフ用トレー オーク材",
        category: "収納ケース",
        why: "棚板の上にトレーを載せて小物を引き出し感覚で取り出せる。オーク材で本体と木目トーンを揃えやすい",
        search_keywords: ["無印良品 スタッキングシェルフ トレー オーク","無印 スタッキング トレー"],
        price_range: { min: 3490, max: 3490 },
        required: false,
      },
      {
        relation: "fits_inside",
        name: "重なるラタン長方形バスケット 中",
        category: "収納ケース",
        why: "1マス内に収まりやすいサイズ感で見せる収納に向く。積み重ね可能で縦方向の収納効率も上げられる",
        search_keywords: ["無印良品 ラタン バスケット 長方形 中","無印 ラタン 収納"],
        price_range: { min: 1990, max: 2990 },
        required: false,
      },
      {
        relation: "fits_inside",
        name: "ポリプロピレン収納ボックス・ワイド",
        category: "収納ケース",
        why: "無印が想定するワイド寸法でシェルフ1段に収まりやすい。半透明で中身が判別しやすく積み重ねもしやすい",
        search_keywords: ["無印良品 ポリプロピレン 収納ボックス ワイド","無印 PP ワイド 深型"],
        price_range: { min: 790, max: 1290 },
        required: false,
      },
    ],
  },

  // ===== ニトリ カラーボックス（標準） =====
  {
    id: "nitori-colorbox-3tier",
    brand: "ニトリ",
    series: "カラーボックス",
    model_number: "8841187",
    name: "カラーボックス 3段（標準）",
    outer_width_mm: 415,
    outer_height_mm: 880,
    outer_depth_mm: 295,
    inner_width_mm: 390,
    inner_height_per_tier_mm: 270,
    inner_depth_mm: 260,
    tiers: 3,
    price_range: { min: 1190, max: 1490 },
    colors: ["ホワイト", "ライトブラウン", "ダークブラウン"],
    material: "プリント紙化粧パーティクルボード",
    weight_kg: 9.0,
    load_capacity_per_tier_kg: 5,
    visual_features: [
      "安価な定番カラーボックス", "ネジ式組み立て",
      "背板あり（薄い）", "Nクリックより軽い",
    ],
    consumables: [],
    compatible_storage: [
      {
        name: "カラーボックス用収納ボックス レギュラー",
        model_number: "8840993",
        width_mm: 385,
        height_mm: 225,
        depth_mm: 265,
        fits_per_tier: 1,
        note: "ニトリ標準カラーボックス向けサイズ",
      },
    ],
    url_template: "https://www.nitori-net.jp/ec/product/{model_number}/",
    category: "カラーボックス",
    related_items: [
      {
        relation: "fits_inside",
        name: "カラーボックス用収納ボックス レギュラー",
        category: "収納ケース",
        why: "内寸幅390×段高さ270×奥行260mmに対し約385×225×265mmの純正ボックスが収まる公式組み合わせ",
        search_keywords: ["ニトリ カラーボックス用収納ボックス","カラーボックス インナー ニトリ"],
        price_range: { min: 290, max: 790 },
        required: false,
      },
      {
        relation: "fits_inside",
        name: "Nインボックス レギュラー",
        category: "収納ケース",
        why: "389×236×266mmは内寸390×270×260mmに実用上収まりやすく、引き出し式で生活感を抑えられる定番オプション",
        search_keywords: ["ニトリ Nインボックス レギュラー","カラーボックス Nインボックス"],
        price_range: { min: 679, max: 899 },
        required: false,
      },
      {
        relation: "enhances_with",
        name: "平安伸銅 強力突っ張り棒",
        category: "その他",
        why: "上枠と天井の間に113〜193cm級の突っ張り棒を渡し、転倒補助や上段のズレ止めに使える（設置高さは部屋で要調整）",
        search_keywords: ["平安伸銅 突っ張り棒 強力","突っ張り棒 家具 転倒防止"],
        price_range: { min: 1280, max: 2480 },
        required: false,
      },
    ],
  },

  // ===== ニトリ Nクリック スリム =====
  {
    id: "nitori-nclick-slim-5",
    brand: "ニトリ",
    series: "Nクリック",
    model_number: "8841448",
    name: "Nクリック スリム5段",
    outer_width_mm: 209,
    outer_height_mm: 1808,
    outer_depth_mm: 298,
    inner_width_mm: 170,
    inner_height_per_tier_mm: 330,
    inner_depth_mm: 260,
    tiers: 5,
    price_range: { min: 3990, max: 4490 },
    colors: ["ホワイト", "ライトブラウン", "ダークブラウン"],
    material: "プリント紙化粧パーティクルボード",
    weight_kg: 13.0,
    load_capacity_per_tier_kg: 7,
    visual_features: [
      "スリム幅（約21cm）", "5段の縦長", "はめ込み式",
      "Nクリック特有の連結穴", "隙間収納向き",
    ],
    consumables: [],
    compatible_storage: [
      {
        name: "Nインボックス ハーフ",
        model_number: "8422024",
        width_mm: 192,
        height_mm: 236,
        depth_mm: 266,
        fits_per_tier: 1,
        note: "スリム幅にぴったり",
      },
    ],
    url_template: "https://www.nitori-net.jp/ec/product/{model_number}/",
    category: "カラーボックス",
    related_items: [
      {
        relation: "enhances_with",
        name: "Nクリック用 別売りキャスター 4個入",
        category: "パーツ・アクセサリ",
        why: "スリム列もNクリックシリーズのため同系キャスターで移動式化しやすい。隙間収納の掃除出し入れが楽になる",
        search_keywords: ["ニトリ Nクリック キャスター","Nクリック キャスター"],
        price_range: { min: 999, max: 1290 },
        required: false,
      },
      {
        relation: "protects_with",
        name: "家具転倒防止伸縮棒",
        category: "保護・補修材",
        why: "外寸高さ1808mmの細身ラックは重心が高く、天井〜本体上端の突っ張り棒で転倒抑制を図れる（設置幅は商品寸法に合わせて選定）",
        search_keywords: ["家具転倒防止伸縮棒","転倒防止棒 天井"],
        price_range: { min: 1280, max: 2980 },
        required: false,
      },
      {
        relation: "alternative",
        name: "幅約17cm スリム収納ケース（深型）",
        category: "収納ケース",
        why: "内寸幅170mmは市販の大型インナーより狭いため、幅170mm前後のスリムケースを別調達すると段内整理しやすい（メーカー横断で要実測）",
        search_keywords: ["スリム収納ケース 17cm","隙間収納ボックス スリム"],
        price_range: { min: 890, max: 2490 },
        required: false,
      },
    ],
  },

  // ===== ニトリ Nフラッテ =====
  {
    id: "nitori-nflatte-regular",
    brand: "ニトリ",
    series: "Nフラッテ",
    model_number: "8841271",
    name: "Nフラッテ レギュラー",
    outer_width_mm: 260,
    outer_height_mm: 240,
    outer_depth_mm: 375,
    inner_width_mm: 240,
    inner_height_per_tier_mm: 220,
    inner_depth_mm: 350,
    tiers: 1,
    price_range: { min: 599, max: 799 },
    colors: ["ホワイト", "ブラウン", "グレー"],
    material: "ポリプロピレン",
    weight_kg: 0.9,
    load_capacity_per_tier_kg: 5,
    visual_features: [
      "前面フラップ開閉式", "積み重ね可能", "半透明ではない不透明ボディ",
      "カラーボックスのインナーとして使用可能",
    ],
    consumables: [],
    compatible_storage: [],
    url_template: "https://www.nitori-net.jp/ec/product/{model_number}/",
    category: "収納ケース",
    related_items: [
      {
        relation: "coordinates_with",
        name: "Nクリック レギュラー2段",
        category: "その他",
        why: "Nフラッテ内寸約240×220×350mmは衣類小物向きで、同シリーズのNクリック419×298mm奥行ラック上に積み重ねてランドリー動線を作りやすい",
        search_keywords: ["ニトリ Nクリック レギュラー 2段","Nフラッテ ニトリ"],
        price_range: { min: 2490, max: 2990 },
        required: false,
      },
      {
        relation: "coordinates_with",
        name: "カラーボックス 3段（標準）",
        category: "収納ケース",
        why: "本体幅260×奥行375mmはカラボ内寸幅390×奥行260mm前後の段にインナーとして収まりやすく、カタログでもカラーボックス併用が想定されている",
        search_keywords: ["ニトリ カラーボックス 3段","カラーボックス インナー ニトリ"],
        price_range: { min: 1190, max: 1490 },
        required: false,
      },
      {
        relation: "enhances_with",
        name: "Nフラッテ（同色追加）",
        category: "その他",
        why: "積み重ね可能設計のため同色を足して縦スタックでき、高さ240mm単位でボリュームを伸ばせる",
        search_keywords: ["ニトリ Nフラッテ","Nフラッテ レギュラー"],
        price_range: { min: 599, max: 799 },
        required: false,
      },
    ],
  },

  // ===== ニトリ 押入れ収納ケース =====
  {
    id: "nitori-oshiire-case",
    brand: "ニトリ",
    series: "押入れ収納ケース",
    model_number: "8840687",
    name: "押入れ収納ケース 深型",
    outer_width_mm: 390,
    outer_height_mm: 300,
    outer_depth_mm: 740,
    inner_width_mm: 360,
    inner_height_per_tier_mm: 270,
    inner_depth_mm: 700,
    tiers: 1,
    price_range: { min: 1290, max: 1690 },
    colors: ["クリア", "ホワイト"],
    material: "ポリプロピレン",
    weight_kg: 2.5,
    load_capacity_per_tier_kg: 8,
    visual_features: [
      "引き出し式", "押入れ奥行対応（約74cm）", "積み重ね可能",
      "半透明で中身が見える",
    ],
    consumables: [],
    compatible_storage: [],
    url_template: "https://www.nitori-net.jp/ec/product/{model_number}/",
    category: "衣装ケース",
    related_items: [
      {
        relation: "alternative",
        name: "Fits 押入れ収納ケース",
        category: "収納ケース",
        why: "外寸幅390×奥行740mm級は天馬Fitsのワイド浅型・深型ラインと用途が近く、引き出し収納の代替比較に向く",
        search_keywords: ["天馬 Fits 押入れ","Fits ケース ワイド"],
        price_range: { min: 1980, max: 2980 },
        required: false,
      },
      {
        relation: "coordinates_with",
        name: "不織布 衣類収納ケース",
        category: "収納ケース",
        why: "深型ケース内の衣類を季節単位で袋分けすると引き出し時の崩れが減り、高さ300mm前後のケースと相性が良い",
        search_keywords: ["不織布 衣類収納ケース","押入れ 衣類ケース"],
        price_range: { min: 480, max: 1580 },
        required: false,
      },
      {
        relation: "coordinates_with",
        name: "除湿剤 クローゼット用",
        category: "その他",
        why: "半透明ボディで通気はあるが押入れ環境では湿度管理と併用するとカビ対策になりやすい",
        search_keywords: ["クローゼット 除湿剤","押入れ 除湿シート"],
        price_range: { min: 298, max: 1280 },
        required: false,
      },
    ],
  },

  // ===== IKEA KALLAX 3x4 =====
  {
    id: "ikea-kallax-3x4",
    brand: "IKEA",
    series: "KALLAX",
    model_number: "505.256.80",
    name: "KALLAX シェルフユニット 3x4",
    outer_width_mm: 1120,
    outer_height_mm: 1470,
    outer_depth_mm: 390,
    inner_width_mm: 330,
    inner_height_per_tier_mm: 330,
    inner_depth_mm: 380,
    tiers: 12,
    price_range: { min: 14999, max: 16999 },
    colors: ["ホワイト", "ブラックブラウン"],
    material: "パーティクルボード・繊維板",
    weight_kg: 53.0,
    load_capacity_per_tier_kg: 13,
    visual_features: [
      "12マスの大型グリッド（3x4）", "壁掛け不可（重すぎ）",
      "部屋の間仕切りとしても使える", "KALLAX共通デザイン",
    ],
    consumables: [],
    compatible_storage: [
      {
        name: "DRÖNA ボックス",
        model_number: "302.255.45",
        width_mm: 330,
        height_mm: 330,
        depth_mm: 380,
        fits_per_tier: 1,
        note: "KALLAX専用設計",
      },
    ],
    url_template: "https://www.ikea.com/jp/ja/p/-{model_number}/",
    category: "シェルフ・棚",
    related_items: [
      {
        relation: "fits_inside",
        name: "DRÖNA ドローナ（12マス分の追加購入セット想定）",
        category: "その他",
        why: "各マス内寸330×380mmにドローナ330×380mmが一致。12マスそろえると統一感と出し入れ動線が最適化",
        search_keywords: ["IKEA ドローナ まとめ買い","KALLAX 3x4 収納 楽天"],
        price_range: { min: 399, max: 499 },
        required: false,
      },
      {
        relation: "enhances_with",
        name: "KALLAX インサート 引き出し2段",
        category: "パーツ・アクセサリ",
        why: "330mm角マスに専用引き出しを入れ小物を段別に分類。深さ380mmに沿った浅型収納で文房具向き",
        search_keywords: ["IKEA KALLAX 引き出し インサート","カラックス 引き出し 楽天"],
        price_range: { min: 3500, max: 5500 },
        required: false,
      },
      {
        relation: "requires",
        name: "大型ユニット用 転倒防止固定",
        category: "保護・補修材",
        why: "外形1120×1470×390mm・重量級のため地震時の滑り出しが危険。複数点で壁に分散固定が推奨",
        search_keywords: ["IKEA 転倒防止 大型","本棚 壁固定 金具 楽天"],
        price_range: { min: 500, max: 2500 },
        required: true,
      },
      {
        relation: "coordinates_with",
        name: "キャスター付き脚（ユニット底面保護）",
        category: "保護・補修材",
        why: "床との摩擦を減らし掃除時の微移動がしやすい。390mm奥行ユニット下に低床キャスターを入れる事例あり",
        search_keywords: ["家具 キャスター 低床","収納棚 移動 キャスター 楽天"],
        price_range: { min: 800, max: 3500 },
        required: false,
      },
    ],
  },

  // ===== IKEA BILLY =====
  {
    id: "ikea-billy-standard",
    brand: "IKEA",
    series: "BILLY",
    model_number: "002.638.50",
    name: "BILLY 本棚",
    outer_width_mm: 800,
    outer_height_mm: 2020,
    outer_depth_mm: 280,
    inner_width_mm: 760,
    inner_height_per_tier_mm: 350,
    inner_depth_mm: 260,
    tiers: 5,
    price_range: { min: 5999, max: 7999 },
    colors: ["ホワイト", "ブラックブラウン", "ホワイトステインオーク調"],
    material: "パーティクルボード・繊維板",
    weight_kg: 28.0,
    load_capacity_per_tier_kg: 14,
    visual_features: [
      "世界で最も売れた本棚", "高さ約2mの背高スリム",
      "棚板の高さ調節可能", "シンプルなフラットデザイン",
    ],
    consumables: [],
    compatible_storage: [
      {
        name: "OXBERG ガラス扉",
        model_number: "302.755.76",
        width_mm: 400,
        height_mm: 350,
        depth_mm: 30,
        fits_per_tier: 2,
        note: "BILLY用後付け扉。2枚で1段分",
      },
    ],
    url_template: "https://www.ikea.com/jp/ja/p/-{model_number}/",
    category: "本棚",
    related_items: [
      {
        relation: "enhances_with",
        name: "OXBERG オクスベリ 扉（ガラス/板）",
        category: "その他",
        why: "幅800mm BILLYに後付け扉でホコリを遮断。棚内奥行260mm前後の本列を前扉で保護",
        search_keywords: ["IKEA BILLY OXBERG 扉","ビリー 本棚 扉 楽天"],
        price_range: { min: 5000, max: 12000 },
        required: false,
      },
      {
        relation: "enhances_with",
        name: "BILLY 追加棚板",
        category: "パーツ・アクセサリ",
        why: "可動ピッチで段数を増やし1段あたりの高さ350mm前後を細かく分割。厚みのある図鑑も安定棚受けで",
        search_keywords: ["IKEA BILLY 追加棚板","ビリー 棚板 楽天"],
        price_range: { min: 1500, max: 3500 },
        required: false,
      },
      {
        relation: "requires",
        name: "本棚用 転倒防止金具セット",
        category: "保護・補修材",
        why: "高さ2020mmの背高シェルフは空振りで転倒しやすい。壁面アンカーとベルトで760mm幅全体を拘束",
        search_keywords: ["本棚 転倒防止 金具","IKEA ビリー 転倒防止 楽天"],
        price_range: { min: 300, max: 2000 },
        required: true,
      },
      {
        relation: "coordinates_with",
        name: "スチール製ブックエンド（大）",
        category: "パーツ・アクセサリ",
        why: "棚板幅760mmで文庫本を立て並べる際、端部の倒れ込みを防ぐ。奥行260mmに薄型エンドが収まる",
        search_keywords: ["ブックエンド 大 金属","本棚 ブックエンド 楽天"],
        price_range: { min: 400, max: 2500 },
        required: false,
      },
    ],
  },

  // ===== IKEA TROFAST =====
  {
    id: "ikea-trofast-frame",
    brand: "IKEA",
    series: "TROFAST",
    model_number: "400.914.53",
    name: "TROFAST 収納コンビネーション フレーム",
    outer_width_mm: 460,
    outer_height_mm: 940,
    outer_depth_mm: 300,
    inner_width_mm: 420,
    inner_height_per_tier_mm: 100,
    inner_depth_mm: 290,
    tiers: 6,
    price_range: { min: 4999, max: 6499 },
    colors: ["ホワイト", "パイン材"],
    material: "パーティクルボード・無垢パイン材",
    weight_kg: 10.0,
    load_capacity_per_tier_kg: 5,
    visual_features: [
      "子供用おもちゃ収納の定番", "カラフルなボックスを差し込むレール式",
      "フレーム側面にレール溝が見える",
    ],
    consumables: [],
    compatible_storage: [
      {
        name: "TROFAST 収納ボックス",
        model_number: "500.892.42",
        width_mm: 420,
        height_mm: 100,
        depth_mm: 300,
        fits_per_tier: 1,
        note: "浅型。カラー多数（白/緑/ピンク/オレンジ等）",
      },
      {
        name: "TROFAST 収納ボックス 深型",
        model_number: "200.892.41",
        width_mm: 420,
        height_mm: 220,
        depth_mm: 300,
        fits_per_tier: 1,
        note: "深型。2レール分の高さを使用",
      },
    ],
    url_template: "https://www.ikea.com/jp/ja/p/-{model_number}/",
    category: "ベビー・安全対策",
    related_items: [
      {
        relation: "fits_inside",
        name: "TROFAST 収納ボックス 浅型 42×30×10cm",
        category: "収納ケース",
        why: "フレームレール内寸幅420×奥行290mmに合わせた専用浅型ボックス。子ども玩具の仕分けに最適",
        search_keywords: ["IKEA TROFAST ボックス 浅型","トロファスト 収納ボックス 楽天"],
        price_range: { min: 300, max: 600 },
        required: false,
      },
      {
        relation: "fits_inside",
        name: "TROFAST 収納ボックス 深型 42×30×23cm",
        category: "収納ケース",
        why: "同レールに深型を差し替え可能で高さ方向220mm級のおもちゃ・衣類も一気に収納",
        search_keywords: ["IKEA TROFAST 深型","トロファスト 深型 ボックス 楽天"],
        price_range: { min: 500, max: 900 },
        required: false,
      },
      {
        relation: "enhances_with",
        name: "TROFAST フタ（ボックス用）",
        category: "パーツ・アクセサリ",
        why: "浅型・深型ボックス上にフタを載せ積み上げ安定とホコリ軽減。幅420mmユニット幅に揃う",
        search_keywords: ["IKEA TROFAST フタ","トロファスト ふた 楽天"],
        price_range: { min: 200, max: 500 },
        required: false,
      },
      {
        relation: "requires",
        name: "壁面固定用 転倒防止キット",
        category: "保護・補修材",
        why: "高さ940mmでも子どもが登って転倒するリスクあり。フレーム背面から壁へテンション固定を推奨",
        search_keywords: ["子供 収納 転倒防止","おもちゃ箱 壁固定 楽天"],
        price_range: { min: 400, max: 2000 },
        required: true,
      },
    ],
  },

  // ===== 無印良品 PP収納ケース =====
  {
    id: "muji-pp-case-wide-deep",
    brand: "無印良品",
    series: "PP収納ケース",
    model_number: "44596654",
    name: "ポリプロピレン収納ケース ワイド・深型",
    outer_width_mm: 550,
    outer_height_mm: 300,
    outer_depth_mm: 445,
    inner_width_mm: 510,
    inner_height_per_tier_mm: 270,
    inner_depth_mm: 410,
    tiers: 1,
    price_range: { min: 1490, max: 1790 },
    colors: ["半透明"],
    material: "ポリプロピレン",
    weight_kg: 2.2,
    load_capacity_per_tier_kg: 10,
    visual_features: [
      "引き出し式", "半透明で中身がうっすら見える",
      "積み重ね可能", "無印の定番PP収納",
    ],
    consumables: [],
    compatible_storage: [],
    url_template: "https://www.muji.com/jp/ja/store/cmdty/detail/{model_number}",
    category: "収納ケース",
    related_items: [
      {
        relation: "enhances_with",
        name: "ポリプロピレン仕切スタンド",
        category: "その他",
        why: "引出し内を縦仕切りで分類でき、衣類やタオルの倒れを抑えられる。PP素材でケースと質感も揃いやすい",
        search_keywords: ["無印良品 ポリプロピレン 仕切スタンド","無印 PP 仕切り"],
        price_range: { min: 290, max: 490 },
        required: false,
      },
      {
        relation: "enhances_with",
        name: "ラベルステッカー（収納用）",
        category: "その他",
        why: "引出し前面や側面に貼り季節物・家族別の管理がしやすい。中身の取り違えを減らせる",
        search_keywords: ["無印良品 ラベル 収納","無印 ラベルシール"],
        price_range: { min: 190, max: 390 },
        required: false,
      },
      {
        relation: "alternative",
        name: "ポリプロピレン衣装ケース 引出式 浅型",
        category: "収納ケース",
        why: "同系統のPP引出しで深さだけ変えたい場合の選択肢。クローゼット段数に合わせてミックスしやすい",
        search_keywords: ["無印良品 衣装ケース 引出 浅型","無印 PP 引出式"],
        price_range: { min: 1490, max: 2490 },
        required: false,
      },
    ],
  },

  // ===== 無印良品 ステンレスユニットシェルフ =====
  {
    id: "muji-sus-unit-shelf-2",
    brand: "無印良品",
    series: "ステンレスユニットシェルフ",
    model_number: "15181497",
    name: "ステンレスユニットシェルフ 小 オーク材棚2段",
    outer_width_mm: 580,
    outer_height_mm: 835,
    outer_depth_mm: 410,
    inner_width_mm: 560,
    inner_height_per_tier_mm: 370,
    inner_depth_mm: 400,
    tiers: 2,
    price_range: { min: 12900, max: 14900 },
    colors: ["オーク材+ステンレス"],
    material: "天然木化粧合板・ステンレス鋼",
    weight_kg: 8.5,
    load_capacity_per_tier_kg: 30,
    visual_features: [
      "ステンレスのポール脚と木の棚板", "棚板追加で拡張可能",
      "オープン構造（背板なし）", "無印のシステム収納",
    ],
    consumables: [],
    compatible_storage: [
      {
        name: "ポリプロピレン収納ボックス・ワイド",
        model_number: "37524956",
        width_mm: 370,
        height_mm: 175,
        depth_mm: 260,
        fits_per_tier: 1,
        note: "棚に載せて引き出し的に使用",
      },
    ],
    url_template: "https://www.muji.com/jp/ja/store/cmdty/detail/{model_number}",
    category: "シェルフ・棚",
    related_items: [
      {
        relation: "enhances_with",
        name: "ステンレスユニットシェルフ 追加棚板 オーク材",
        category: "パーツ・アクセサリ",
        why: "システム収納として段数や間隔を増やせる。オーク棚板で既存の木目と揃えた拡張がしやすい",
        search_keywords: ["無印良品 ステンレスユニットシェルフ 追加棚板","無印 SUS ユニット 棚板"],
        price_range: { min: 1990, max: 3990 },
        required: false,
      },
      {
        relation: "fits_inside",
        name: "ステンレスワイヤーバスケット4",
        category: "収納ケース",
        why: "棚上に載せて通気の良い収納にできる。ステンレス同士でトーンを合わせやすい",
        search_keywords: ["無印良品 ステンレス ワイヤーバスケット","無印 ワイヤーバスケット4"],
        price_range: { min: 1990, max: 2290 },
        required: false,
      },
      {
        relation: "coordinates_with",
        name: "ステンレス S字フック 小 5個入",
        category: "パーツ・アクセサリ",
        why: "ポール径に合えば側面やバーに吊してツールや小物袋を掛けられる。錆びにくい素材でキッチン向き",
        search_keywords: ["無印良品 S字フック ステンレス 小","無印 Sフック 5個"],
        price_range: { min: 350, max: 490 },
        required: false,
      },
    ],
  },

  // ===== 無印良品 パイン材ユニットシェルフ =====
  {
    id: "muji-pine-shelf-small",
    brand: "無印良品",
    series: "パイン材ユニットシェルフ",
    model_number: "18182367",
    name: "パイン材ユニットシェルフ 小",
    outer_width_mm: 860,
    outer_height_mm: 835,
    outer_depth_mm: 260,
    inner_width_mm: 830,
    inner_height_per_tier_mm: 370,
    inner_depth_mm: 250,
    tiers: 2,
    price_range: { min: 5990, max: 6990 },
    colors: ["パイン材ナチュラル"],
    material: "パイン材",
    weight_kg: 7.0,
    load_capacity_per_tier_kg: 20,
    visual_features: [
      "天然パイン材の木目", "棚板追加で拡張可能",
      "ナチュラルテイスト", "背板なしオープン構造",
    ],
    consumables: [],
    compatible_storage: [
      {
        name: "ラタンバスケット",
        model_number: "18821281",
        width_mm: 360,
        height_mm: 320,
        depth_mm: 260,
        fits_per_tier: 2,
        note: "2個並べて棚幅に対応",
      },
    ],
    url_template: "https://www.muji.com/jp/ja/store/cmdty/detail/{model_number}",
    category: "シェルフ・棚",
    related_items: [
      {
        relation: "fits_inside",
        name: "ポリエステル綿麻混 帆布バスケット",
        category: "収納ケース",
        why: "パイン棚の奥行に合わせた布バスケットで軽いものや子ども用品をまとめやすい。ナチュラルな風合いが木と調和する",
        search_keywords: ["無印良品 帆布 バスケット","無印 綿麻混 バスケット"],
        price_range: { min: 790, max: 1990 },
        required: false,
      },
      {
        relation: "enhances_with",
        name: "パイン材ユニットシェルフ 追加棚板",
        category: "パーツ・アクセサリ",
        why: "可動棚タイプの利点を活かして段数や棚位置を増やせる。パイン材で見た目の統一が取りやすい",
        search_keywords: ["無印良品 パイン材 ユニットシェルフ 棚板","無印 パイン 追加棚板"],
        price_range: { min: 1990, max: 3990 },
        required: false,
      },
      {
        relation: "fits_inside",
        name: "重なるラタン長方形バスケット 大",
        category: "収納ケース",
        why: "木の棚とラタンの組み合わせが人気の見せる収納。深めのマスには大サイズでボリュームを活かせる",
        search_keywords: ["無印良品 ラタン バスケット 大","無印 重なるラタン"],
        price_range: { min: 2490, max: 3990 },
        required: false,
      },
      {
        relation: "enhances_with",
        name: "ブックエンド スチール",
        category: "パーツ・アクセサリ",
        why: "オープン棚で本の倒れを防ぎ、見た目もすっきりさせられる。木棚とのコントラストも楽しめる",
        search_keywords: ["無印良品 ブックエンド","無印 本立て スチール"],
        price_range: { min: 490, max: 990 },
        required: false,
      },
    ],
  },

  // ===== アイリスオーヤマ カラーボックス =====
  {
    id: "iris-colorbox-3tier",
    brand: "アイリスオーヤマ",
    series: "カラーボックス",
    model_number: "CX-3",
    name: "カラーボックス 3段 CX-3",
    outer_width_mm: 415,
    outer_height_mm: 880,
    outer_depth_mm: 290,
    inner_width_mm: 390,
    inner_height_per_tier_mm: 270,
    inner_depth_mm: 260,
    tiers: 3,
    price_range: { min: 1080, max: 1580 },
    colors: ["オフホワイト", "ブラウン", "ナチュラル", "ブラック"],
    material: "プリント紙化粧パーティクルボード",
    weight_kg: 8.5,
    load_capacity_per_tier_kg: 5,
    visual_features: [
      "最安価帯のカラーボックス", "ネジ式組み立て",
      "背板あり", "ニトリ製品とほぼ同サイズ",
    ],
    consumables: [],
    compatible_storage: [
      {
        name: "CBボックス用インナーボックス",
        model_number: "FIB-27",
        width_mm: 385,
        height_mm: 225,
        depth_mm: 265,
        fits_per_tier: 1,
        note: "アイリスオーヤマ純正インナー",
      },
    ],
    url_template: "https://www.irisplaza.co.jp/index.php?KB=SHOSAI&SID={model_number}",
    category: "カラーボックス",
    related_items: [
      { relation: "fits_inside", name: "CBボックス用 収納ボックス", category: "収納ケース", why: "アイリス純正のカラーボックス用インナーボックス。内寸390×265mmにジャストフィット", search_keywords: ["アイリスオーヤマ カラーボックス インナー", "CX-3 収納ボックス"], price_range: { min: 398, max: 798 }, required: false },
      { relation: "enhances_with", name: "カラーボックス用 追加棚板", category: "パーツ・アクセサリ", why: "段数を増やして収納効率UP。ダボ穴式で高さ調整可能", search_keywords: ["アイリスオーヤマ カラーボックス 追加棚板", "CX-3 棚板"], price_range: { min: 298, max: 598 }, required: false },
      { relation: "protects_with", name: "耐震ジェルマット", category: "保護・補修材", why: "軽量カラーボックスは地震で滑りやすい。底面に貼って転倒・滑り防止", search_keywords: ["耐震ジェルマット 家具", "カラーボックス 転倒防止"], price_range: { min: 398, max: 1280 }, required: false },
    ],
  },

  // ===== アイリスオーヤマ スタックボックス =====
  {
    id: "iris-stack-box",
    brand: "アイリスオーヤマ",
    series: "スタックボックス",
    model_number: "STB-400",
    name: "スタックボックス 扉付き STB-400",
    outer_width_mm: 400,
    outer_height_mm: 385,
    outer_depth_mm: 382,
    inner_width_mm: 370,
    inner_height_per_tier_mm: 350,
    inner_depth_mm: 350,
    tiers: 1,
    price_range: { min: 1780, max: 2480 },
    colors: ["ナチュラル", "ブラウン", "ホワイト"],
    material: "プリント紙化粧パーティクルボード",
    weight_kg: 4.5,
    load_capacity_per_tier_kg: 10,
    visual_features: [
      "正方形に近い形状", "前面に扉あり", "積み重ね可能",
      "モジュール式で自由に組み合わせ",
    ],
    consumables: [],
    compatible_storage: [],
    url_template: "https://www.irisplaza.co.jp/index.php?KB=SHOSAI&SID={model_number}",
    category: "収納ケース",
    related_items: [
      {
        relation: "coordinates_with",
        name: "スタックボックス 浅型・ハーフサイズ",
        category: "収納ケース",
        why: "同シリーズでサイズ違いを組み合わせると引き出し口や段の使い分けがしやすくなる",
        search_keywords: ["アイリスオーヤマ スタックボックス 浅型","スタックボックス ハーフ"],
        price_range: { min: 400, max: 1200 },
        required: false,
      },
      {
        relation: "enhances_with",
        name: "ラベルシール 無地",
        category: "その他",
        why: "中身の把握が速くなり、家族で使う収納でも取り違えが減る。湿気に強い素材がおすすめ",
        search_keywords: ["収納 ラベルシール 無地","布テープ ラベル"],
        price_range: { min: 200, max: 800 },
        required: false,
      },
      {
        relation: "alternative",
        name: "スタックボックス専用フタ",
        category: "パーツ・アクセサリ",
        why: "ホコリを抑えたい場所ではフタ付き構成に切り替えやすい。既存ボックスとの互換を商品ページで要確認",
        search_keywords: ["アイリスオーヤマ スタックボックス フタ","スタックボックス 蓋"],
        price_range: { min: 300, max: 900 },
        required: false,
      },
    ],
  },

  // ===== アイリスオーヤマ チェスト =====
  {
    id: "iris-wide-chest-3",
    brand: "アイリスオーヤマ",
    series: "ワイドチェスト",
    model_number: "W-543",
    name: "ワイドチェスト 3段 W-543",
    outer_width_mm: 540,
    outer_height_mm: 685,
    outer_depth_mm: 400,
    inner_width_mm: 500,
    inner_height_per_tier_mm: 185,
    inner_depth_mm: 370,
    tiers: 3,
    price_range: { min: 3280, max: 4480 },
    colors: ["ホワイト/クリア", "ブラウン/クリア"],
    material: "ポリプロピレン・スチール",
    weight_kg: 5.5,
    load_capacity_per_tier_kg: 5,
    visual_features: [
      "引き出し式プラスチックチェスト", "半透明の引き出し",
      "天板が木目調", "衣類収納に最適",
    ],
    consumables: [],
    compatible_storage: [],
    url_template: "https://www.irisplaza.co.jp/index.php?KB=SHOSAI&SID={model_number}",
    category: "衣装ケース",
    related_items: [
      {
        relation: "fits_inside",
        name: "衣類収納ケース 不織布",
        category: "収納ケース",
        why: "引き出し内を仕切り、衣類の崩れや取り出し時の手間を減らせる。奥行に合うサイズ選びが重要",
        search_keywords: ["衣類収納ケース チェスト用","不織布 収納ボックス ワイド"],
        price_range: { min: 500, max: 2000 },
        required: false,
      },
      {
        relation: "requires",
        name: "家具転倒防止金具 ベルト式",
        category: "保護・補修材",
        why: "子どもやペットがいる環境では引き出しを足場にされやすく、転倒リスク低減に有効",
        search_keywords: ["家具転倒防止 ベルト","チェスト 転倒防止"],
        price_range: { min: 800, max: 3500 },
        required: true,
      },
      {
        relation: "enhances_with",
        name: "引き出し仕切りトレー",
        category: "収納ケース",
        why: "小物や下着を段ごとに整理し、奥の物も取り出しやすくなる",
        search_keywords: ["引き出し 仕切り トレー","チェスト 仕切り アクリル"],
        price_range: { min: 400, max: 1800 },
        required: false,
      },
    ],
  },

  // ===== アイリスオーヤマ メタルラック 幅120cm =====
  {
    id: "iris-metal-rack-4tier-w120",
    brand: "アイリスオーヤマ",
    series: "メタルラック",
    model_number: "MR-1218J",
    name: "メタルラック 4段 幅121.5cm",
    outer_width_mm: 1215,
    outer_height_mm: 1790,
    outer_depth_mm: 460,
    inner_width_mm: 1205,
    inner_height_per_tier_mm: 410,
    inner_depth_mm: 460,
    tiers: 4,
    price_range: { min: 5980, max: 7980 },
    colors: ["シルバー"],
    material: "スチール（クロムメッキ）",
    weight_kg: 17.0,
    load_capacity_per_tier_kg: 75,
    visual_features: [
      "ワイドなメタルラック", "ワイヤーメッシュ棚板",
      "ポール式で高さ調節可能", "ガレージや倉庫にも",
    ],
    consumables: [
      {
        type: "棚板追加",
        name: "メタルラック棚板 幅121.5cm",
        model_number: "MR-1246T",
        replacement_months: 0,
        note: "段数追加用オプション棚板",
      },
    ],
    compatible_storage: [
      {
        name: "メタルラック用バスケット 幅60cm",
        model_number: "MR-60B",
        width_mm: 595,
        height_mm: 120,
        depth_mm: 420,
        fits_per_tier: 2,
        note: "引き出し式。2個横並びで幅120棚に対応",
      },
    ],
    url_template: "https://www.irisplaza.co.jp/index.php?KB=SHOSAI&SID={model_number}",
    category: "スチールラック",
    related_items: [
      { relation: "fits_inside", name: "メタルラック用 ワイヤーバスケット 幅120cm", category: "収納ケース", why: "棚板間のデッドスペースにバスケットを吊り下げ。ポール径25mm対応のアイリス純正品", search_keywords: ["アイリスオーヤマ メタルラック バスケット", "メタルラック ワイヤーバスケット"], price_range: { min: 1500, max: 3000 }, required: false },
      { relation: "protects_with", name: "PPシート 棚板マット", category: "保護・補修材", why: "ワイヤー棚板の隙間から小物落下を防止。ハサミでカットしてサイズ調整", search_keywords: ["メタルラック PPシート", "100均 メタルラック シート"], price_range: { min: 110, max: 500 }, required: false },
      { relation: "enhances_with", name: "メタルラック用 キャスター 4個セット", category: "パーツ・アクセサリ", why: "段あたり250kg耐荷重のまま移動可能に。掃除時の移動が楽になる", search_keywords: ["アイリスオーヤマ メタルラック キャスター", "メタルラック キャスター 25mm"], price_range: { min: 800, max: 1500 }, required: false },
    ],
  },

  // ===== 山善 スチールラック =====
  {
    id: "yamazen-steel-rack-5tier",
    brand: "山善",
    series: "スチールラック",
    model_number: "SRR-9018J",
    name: "スチールラック 5段 幅90cm",
    outer_width_mm: 900,
    outer_height_mm: 1800,
    outer_depth_mm: 450,
    inner_width_mm: 890,
    inner_height_per_tier_mm: 330,
    inner_depth_mm: 450,
    tiers: 5,
    price_range: { min: 4999, max: 6999 },
    colors: ["シルバー", "ブラック"],
    material: "スチール（亜鉛メッキ）",
    weight_kg: 14.0,
    load_capacity_per_tier_kg: 50,
    visual_features: [
      "楽天売上上位の定番ラック", "ボルト式組み立て",
      "棚板高さ調節可能（2.5cm刻み）", "耐荷重が大きい",
    ],
    consumables: [],
    compatible_storage: [],
    url_template: "https://book.yamazen.co.jp/product/{model_number}/",
    category: "スチールラック",
    related_items: [
      {
        relation: "protects_with",
        name: "スチールラック用 棚板シート 透明",
        category: "パーツ・アクセサリ",
        why: "メッシュ棚の隙間から落ちる小物を防ぎ、文房具やキッチン用品の収納が楽になる",
        search_keywords: ["スチールラック 棚板シート","メタルラック 透明シート"],
        price_range: { min: 600, max: 2400 },
        required: false,
      },
      {
        relation: "fits_inside",
        name: "ワイヤーバスケット ラック用",
        category: "収納ケース",
        why: "棚下スペースを吊り下げ収納に変え、定位置管理がしやすい",
        search_keywords: ["山善 スチールラック バスケット","メタルラック 吊り下げカゴ"],
        price_range: { min: 1200, max: 3800 },
        required: false,
      },
      {
        relation: "enhances_with",
        name: "スチールラック用 キャスター",
        category: "パーツ・アクセサリ",
        why: "掃除や模様替えの移動が楽になり、ロック付きで停止も安心",
        search_keywords: ["スチールラック キャスター","山善 ラック キャスター"],
        price_range: { min: 1500, max: 4000 },
        required: false,
      },
    ],
  },

  // ===== 山善 隙間ラック =====
  {
    id: "yamazen-slim-rack",
    brand: "山善",
    series: "隙間ラック",
    model_number: "SSR-2014",
    name: "隙間ラック 幅20cm 4段",
    outer_width_mm: 200,
    outer_height_mm: 1400,
    outer_depth_mm: 400,
    inner_width_mm: 180,
    inner_height_per_tier_mm: 310,
    inner_depth_mm: 380,
    tiers: 4,
    price_range: { min: 3999, max: 5999 },
    colors: ["ホワイト", "ブラック"],
    material: "スチール（粉体塗装）",
    weight_kg: 5.5,
    load_capacity_per_tier_kg: 10,
    visual_features: [
      "幅20cmの超スリム", "洗面所・キッチンの隙間向け",
      "スチールワイヤー棚板", "キャスター付きモデルあり",
    ],
    consumables: [],
    compatible_storage: [],
    url_template: "https://book.yamazen.co.jp/product/{model_number}/",
    category: "シェルフ・棚",
    related_items: [
      { relation: "fits_inside", name: "隙間収納用 スリムボックス", category: "収納ケース", why: "幅20cmの隙間ラックに合うスリムサイズの収納ボックス。洗剤や小物の整理に", search_keywords: ["隙間収納 スリムボックス", "幅20cm 収納ケース"], price_range: { min: 398, max: 998 }, required: false },
      { relation: "enhances_with", name: "キャスター 取替用 4個セット", category: "パーツ・アクセサリ", why: "キャスター付きモデルの交換用。ストッパー付きに交換すれば固定も可能", search_keywords: ["山善 スリムラック キャスター", "隙間ラック キャスター 交換"], price_range: { min: 598, max: 998 }, required: false },
      { relation: "protects_with", name: "滑り止めシート 30×180cm", category: "保護・補修材", why: "スチール棚板が滑りやすいため敷くと小物が安定。ハサミでカットして幅20cmに調整", search_keywords: ["食器棚 滑り止めシート", "スリムラック 滑り止め"], price_range: { min: 298, max: 598 }, required: false },
    ],
  },

  // ===== 山善 キッチンワゴン =====
  {
    id: "yamazen-kitchen-wagon",
    brand: "山善",
    series: "バスケットトローリー",
    model_number: "LBT-3",
    name: "バスケットトローリー 3段",
    outer_width_mm: 460,
    outer_height_mm: 810,
    outer_depth_mm: 380,
    inner_width_mm: 430,
    inner_height_per_tier_mm: 140,
    inner_depth_mm: 350,
    tiers: 3,
    price_range: { min: 4499, max: 5999 },
    colors: ["ホワイト", "ブラック", "ターコイズ", "ベージュ"],
    material: "スチール（粉体塗装）",
    weight_kg: 4.8,
    load_capacity_per_tier_kg: 8,
    visual_features: [
      "IKEAのRÅSKOGに似たデザイン", "メッシュバスケット3段",
      "キャスター付き移動式", "楽天バスケットトローリー部門1位常連",
    ],
    consumables: [],
    compatible_storage: [],
    url_template: "https://book.yamazen.co.jp/product/{model_number}/",
    category: "ワゴン・可動収納",
    related_items: [
      { relation: "fits_inside", name: "バスケットトローリー用 仕切りケース", category: "収納ケース", why: "メッシュバスケット内を仕切って小物を分類。100均のケースでも代用可能", search_keywords: ["バスケットトローリー 仕切り", "キッチンワゴン 収納ケース"], price_range: { min: 110, max: 598 }, required: false },
      { relation: "enhances_with", name: "キャスターストッパー", category: "パーツ・アクセサリ", why: "移動式ワゴンを定位置で固定。キッチンや洗面所での使用時に安定", search_keywords: ["キャスターストッパー", "ワゴン キャスター 固定"], price_range: { min: 298, max: 698 }, required: false },
      { relation: "coordinates_with", name: "マグネット式小物入れ", category: "パーツ・アクセサリ", why: "スチール製ワゴン側面にマグネットで取り付け。調味料やキッチンツールの追加収納", search_keywords: ["マグネット 小物入れ キッチン", "ワゴン マグネット収納"], price_range: { min: 298, max: 998 }, required: false },
    ],
  },

  // ===== 天馬 Fitケース =====
  {
    id: "tenma-fit-case-deep",
    brand: "天馬",
    series: "Fits",
    model_number: "Fits-L5344",
    name: "Fitsケース ロング 深型",
    outer_width_mm: 530,
    outer_height_mm: 300,
    outer_depth_mm: 740,
    inner_width_mm: 490,
    inner_height_per_tier_mm: 270,
    inner_depth_mm: 700,
    tiers: 1,
    price_range: { min: 2180, max: 2980 },
    colors: ["クリア", "カプチーノ"],
    material: "ポリプロピレン",
    weight_kg: 2.8,
    load_capacity_per_tier_kg: 10,
    visual_features: [
      "押入れ奥行き対応の長尺タイプ", "引き出し式",
      "Fitsロゴが前面下部にある", "レール付きで引き出しスムーズ",
      "積み重ね可能", "透明度が高い",
    ],
    consumables: [],
    compatible_storage: [],
    url_template: "https://www.tenmafitsworld.com/products/detail/{model_number}",
    category: "衣装ケース",
    related_items: [
      {
        relation: "enhances_with",
        name: "天馬 Fits 仕切り板（深型用）",
        category: "パーツ・アクセサリ",
        why: "衣類や布団を縦に立てるときに倒れを防ぎ、引き出し内を家族別・季節別に区切って取り出しやすくできる",
        search_keywords: ["天馬 Fits 仕切り板","Fitsケース 仕切り 深型"],
        price_range: { min: 280, max: 880 },
        required: false,
      },
      {
        relation: "coordinates_with",
        name: "衣類用防虫剤・除湿剤（クローゼット向け）",
        category: "その他",
        why: "長期保管の衣類にカビや衣類害虫のリスクがあり、ケース外に置くタイプと併用すると押入れ全体の環境を整えやすい",
        search_keywords: ["クローゼット 防虫剤 衣類","押入れ 除湿剤 おすすめ"],
        price_range: { min: 398, max: 1980 },
        required: false,
      },
      {
        relation: "protects_with",
        name: "押入れ用すのこ・プラすのこ",
        category: "その他",
        why: "床付近の湿気でケース底面が曇りやすいため、すのこで底面を浮かせて通気を確保しカビ付きを抑えられる",
        search_keywords: ["押入れ すのこ プラスチック","クローゼット 床 すのこ"],
        price_range: { min: 798, max: 3980 },
        required: false,
      },
    ],
  },

  // ===== 天馬 Fitケース 押入れ用 =====
  {
    id: "tenma-fit-case-oshiire",
    brand: "天馬",
    series: "Fits",
    model_number: "Fits-L4430",
    name: "Fitsケース 押入れ用",
    outer_width_mm: 440,
    outer_height_mm: 300,
    outer_depth_mm: 740,
    inner_width_mm: 400,
    inner_height_per_tier_mm: 270,
    inner_depth_mm: 700,
    tiers: 1,
    price_range: { min: 1980, max: 2780 },
    colors: ["クリア", "カプチーノ"],
    material: "ポリプロピレン",
    weight_kg: 2.5,
    load_capacity_per_tier_kg: 10,
    visual_features: [
      "押入れ定番サイズ", "引き出し式",
      "Fitsロゴ付き", "天馬製の高品質レール",
    ],
    consumables: [],
    compatible_storage: [],
    url_template: "https://www.tenmafitsworld.com/products/detail/{model_number}",
    category: "衣装ケース",
    related_items: [
      {
        relation: "enhances_with",
        name: "天馬 Fits 仕切り板（押入れサイズ向け）",
        category: "パーツ・アクセサリ",
        why: "定番奥行に合わせた仕切りでタオルや子ども服を前後に分け、引き出しを開けたときに一目で区画が分かる",
        search_keywords: ["天馬 Fits 仕切り","押入れ Fits 仕切り板"],
        price_range: { min: 280, max: 880 },
        required: false,
      },
      {
        relation: "coordinates_with",
        name: "天然樟脳・防虫ハーブサシェ",
        category: "その他",
        why: "羊毛やカシミヤなど虫食いリスクのある衣類と併用しやすく、香りで季節物の管理意識も上がる",
        search_keywords: ["衣類 防虫 サシェ","樟脳 クローゼット 使い方"],
        price_range: { min: 480, max: 2480 },
        required: false,
      },
      {
        relation: "protects_with",
        name: "シリカゲル除湿剤（衣類ケース用）",
        category: "収納ケース",
        why: "湿気の多い時期に引き出し内の結露やカビ臭さを抑え、衣類の手触りを長く保てる",
        search_keywords: ["衣類ケース 除湿剤","シリカゲル 衣類 収納"],
        price_range: { min: 198, max: 1280 },
        required: false,
      },
    ],
  },

  // ===== 天馬 カバコ =====
  {
    id: "tenma-kabako-m",
    brand: "天馬",
    series: "カバコ",
    model_number: "KABAKO-M",
    name: "カバコ Mサイズ",
    outer_width_mm: 450,
    outer_height_mm: 310,
    outer_depth_mm: 420,
    inner_width_mm: 410,
    inner_height_per_tier_mm: 280,
    inner_depth_mm: 390,
    tiers: 1,
    price_range: { min: 998, max: 1480 },
    colors: ["クリア", "ホワイト", "ブラウン"],
    material: "ポリプロピレン",
    weight_kg: 1.5,
    load_capacity_per_tier_kg: 8,
    visual_features: [
      "前面がパカッと大きく開く", "フラップ式開閉",
      "積み重ね可能", "中身が一目瞭然",
      "取り出しやすさに特化した設計",
    ],
    consumables: [],
    compatible_storage: [],
    url_template: "https://www.tenmafitsworld.com/products/detail/{model_number}",
    category: "衣装ケース",
    related_items: [
      {
        relation: "enhances_with",
        name: "天馬 カバコ 積み重ね連結パーツ",
        category: "その他",
        why: "フラップ式のまま縦積みの安定感を高め、子ども部屋でも倒れにくいタワー収納にしやすい",
        search_keywords: ["カバコ 連結パーツ","天馬 カバコ 積み重ね"],
        price_range: { min: 380, max: 980 },
        required: false,
      },
      {
        relation: "enhances_with",
        name: "収納ケース用キャスター（底面取付タイプ）",
        category: "パーツ・アクセサリ",
        why: "掃除のときにまとめて動かせるようになり、リビングのおもちゃ棚として運用しやすくなる",
        search_keywords: ["収納ケース キャスター 取り付け","カバコ キャスター"],
        price_range: { min: 480, max: 1980 },
        required: false,
      },
      {
        relation: "fits_inside",
        name: "不織布仕切りケース（小物用）",
        category: "収納ケース",
        why: "前面が大きく開く内部を細かく分け、レゴや文房具を種類別に立てて収納できる",
        search_keywords: ["カバコ 仕切り 収納","不織布 仕切りケース 小物"],
        price_range: { min: 300, max: 1500 },
        required: false,
      },
    ],
  },

  // ===== 旧型サンプル（後継検索ツール用・型番は目安） =====
  {
    id: "nitori-legacy-ncolo-2tier-sample",
    brand: "ニトリ",
    series: "Nカラボ",
    model_number: "LEGACY-NCOLO-2",
    name: "Nカラボ系 レギュラー2段（旧世代・例）",
    outer_width_mm: 415,
    outer_height_mm: 590,
    outer_depth_mm: 295,
    inner_width_mm: 390,
    inner_height_per_tier_mm: 270,
    inner_depth_mm: 260,
    tiers: 2,
    price_range: { min: 0, max: 0 },
    colors: ["ホワイト"],
    material: "プリント紙化粧パーティクルボード",
    weight_kg: 7.0,
    load_capacity_per_tier_kg: 5,
    visual_features: [
      "旧世代のネジ式カラーボックス", "Nクリックより前の世代に近い見た目",
    ],
    consumables: [],
    compatible_storage: [],
    url_template: "https://www.nitori-net.jp/ec/search/?q=N%E3%82%AB%E3%83%A9%E3%83%9C",
    category: "カラーボックス",
    related_items: [
      {
        relation: "alternative",
        name: "Nクリック レギュラー2段",
        category: "その他",
        why: "後継としてはめ込み式のNクリック419×298mmが現行ライン。旧ネジ式からの置き換えで工具レス組立に移行しやすい",
        search_keywords: ["ニトリ Nクリック レギュラー 2段","Nクリック ニトリ"],
        price_range: { min: 2490, max: 2990 },
        required: false,
      },
      {
        relation: "fits_inside",
        name: "Nインボックス レギュラー",
        category: "収納ケース",
        why: "旧型内寸幅390×奥260mm前後でもレギュラー389×266mmは同系サイズ感で移行時のインナー再利用がしやすい",
        search_keywords: ["ニトリ Nインボックス レギュラー","Nインボックス"],
        price_range: { min: 679, max: 899 },
        required: false,
      },
      {
        relation: "alternative",
        name: "ニトリ カラーボックス 3段（標準）",
        category: "収納ケース",
        why: "コスト優先なら現行ネジ式カラボ415×295mmが入手しやすく、安価に段数を増やせる",
        search_keywords: ["ニトリ カラーボックス 3段","カラーボックス ニトリ"],
        price_range: { min: 1190, max: 1490 },
        required: false,
      },
    ],
    discontinued: true,
    successors: [
      {
        model_number: "8841424",
        name: "Nクリック レギュラー3段",
        note: "はめ込み式の現行シリーズ。段数が異なる場合は2段・5段も検討",
      },
      {
        model_number: "8841417",
        name: "Nクリック レギュラー2段",
        note: "同じ2段を現行で探す場合の候補",
      },
    ],
  },
];

// -----------------------------------------------------------------------
// 検索・マッチング関数
// -----------------------------------------------------------------------

/**
 * 型番（または型番を含む文字列）で既知製品を1件返す。
 */
export function findProductByModelNumber(raw: string): KnownProduct | undefined {
  const q = raw.normalize("NFKC").trim().toLowerCase();
  const byExact = KNOWN_PRODUCTS_DB.find((p) => p.model_number.toLowerCase() === q);
  if (byExact) return byExact;
  return KNOWN_PRODUCTS_DB.find(
    (p) => q.includes(p.model_number.toLowerCase()) || p.model_number.toLowerCase().includes(q)
  );
}

export interface ProductMatch {
  product: KnownProduct;
  confidence: number;
  match_reasons: string[];
}

/**
 * 特徴テキストから既知製品を検索し、マッチ度付きで返す。
 * AIが画像解析で抽出した特徴（色、形状、ブランド名、段数等）をテキストで受け取る。
 */
export function findMatchingProducts(featureText: string, maxResults: number = 5): ProductMatch[] {
  const lower = featureText.normalize("NFKC").toLowerCase();
  const results: ProductMatch[] = [];

  for (const product of KNOWN_PRODUCTS_DB) {
    let score = 0;
    const reasons: string[] = [];

    // ブランド名一致
    if (lower.includes(product.brand.toLowerCase())) {
      score += 30;
      reasons.push(`ブランド「${product.brand}」一致`);
    }

    // シリーズ名一致
    if (lower.includes(product.series.toLowerCase())) {
      score += 25;
      reasons.push(`シリーズ「${product.series}」一致`);
    }

    // 型番一致
    if (lower.includes(product.model_number.toLowerCase())) {
      score += 50;
      reasons.push(`型番「${product.model_number}」完全一致`);
    }

    // 色一致
    for (const color of product.colors) {
      if (lower.includes(color.toLowerCase())) {
        score += 10;
        reasons.push(`色「${color}」一致`);
        break;
      }
    }

    // 段数一致
    const tierMatch = lower.match(/(\d+)\s*段/);
    if (tierMatch && parseInt(tierMatch[1]!) === product.tiers) {
      score += 15;
      reasons.push(`段数「${product.tiers}段」一致`);
    }

    // 素材キーワード
    if (lower.includes("スチール") && product.material.includes("スチール")) {
      score += 10;
      reasons.push("素材「スチール」一致");
    }
    if (lower.includes("木") && (product.material.includes("木") || product.material.includes("オーク"))) {
      score += 10;
      reasons.push("素材「木」一致");
    }

    // 視覚的特徴
    for (const feature of product.visual_features) {
      const featureLower = feature.toLowerCase();
      const featureKeywords = featureLower.split(/[、。\s]+/).filter((w) => w.length >= 2);
      for (const kw of featureKeywords) {
        if (lower.includes(kw)) {
          score += 5;
          reasons.push(`特徴「${kw}」一致`);
        }
      }
    }

    // 寸法近似マッチ（テキスト中に寸法情報があれば）
    const widthMatch = lower.match(/幅\s*(\d+)/);
    if (widthMatch) {
      const w = parseInt(widthMatch[1]!) * 10;
      if (Math.abs(w - product.outer_width_mm) < 30) {
        score += 15;
        reasons.push(`幅(${product.outer_width_mm}mm)が近似`);
      }
    }

    if (score > 0) {
      const confidence = Math.min(score, 100);
      results.push({ product, confidence, match_reasons: reasons });
    }
  }

  results.sort((a, b) => b.confidence - a.confidence);
  return results.slice(0, maxResults);
}

/**
 * 寸法で既知製品を検索する。空きスペースに入る製品を返す。
 */
export function findByDimensions(
  maxWidth: number, maxDepth: number, maxHeight: number
): KnownProduct[] {
  return KNOWN_PRODUCTS_DB.filter(
    (p) =>
      p.outer_width_mm <= maxWidth &&
      p.outer_depth_mm <= maxDepth &&
      p.outer_height_mm <= maxHeight
  );
}

// -----------------------------------------------------------------------
// カテゴリ・関連アイテム系ヘルパー
// -----------------------------------------------------------------------

export function getProductCategory(product: KnownProduct): ProductCategory {
  return product.category || "その他";
}

export function getProductRelatedItems(productId: string): RelatedItem[] {
  const product = KNOWN_PRODUCTS_DB.find((p) => p.id === productId);
  return product?.related_items || [];
}

export function getRelatedChainDeep(
  productId: string,
  depth: number = 2,
): Array<{ item: RelatedItem; sub_items: RelatedItem[] }> {
  const items = getProductRelatedItems(productId);
  if (depth <= 1) return items.map((item) => ({ item, sub_items: [] }));
  return items.map((item) => ({
    item,
    sub_items: item.product_id
      ? getProductRelatedItems(item.product_id)
      : [],
  }));
}

export function getCategoryStats(): Array<{
  category: ProductCategory;
  count: number;
  brands: string[];
}> {
  const map = new Map<string, { count: number; brands: Set<string> }>();
  for (const p of KNOWN_PRODUCTS_DB) {
    const cat = p.category || "その他";
    if (!map.has(cat)) map.set(cat, { count: 0, brands: new Set() });
    const entry = map.get(cat)!;
    entry.count++;
    entry.brands.add(p.brand);
  }
  return [...map.entries()].map(([category, { count, brands }]) => ({
    category: category as ProductCategory,
    count,
    brands: [...brands],
  }));
}

export function findByCategory(category: ProductCategory): KnownProduct[] {
  return KNOWN_PRODUCTS_DB.filter(
    (p) => (p.category || "その他") === category,
  );
}
