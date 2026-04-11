/**
 * メジャー家具・収納製品の既知スペックDB
 *
 * AIが画像から「これはニトリのNクリックっぽい」と推定してきたとき、
 * このDBで型番・内寸・消耗品情報まで返せるようにする。
 *
 * identify_product ツールのバックエンド。
 */

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
