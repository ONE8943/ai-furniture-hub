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
];

// -----------------------------------------------------------------------
// 検索・マッチング関数
// -----------------------------------------------------------------------

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
