/**
 * 家具・収納・家電製品カタログの型定義
 *
 * 全MCPツールが参照するコア型。
 * データ本体は products_db.ts、検索ヘルパーは product_helpers.ts に分離。
 */

export type ProductCategory =
  | "シェルフ・棚" | "カラーボックス" | "収納ケース" | "ワゴン・可動収納"
  | "衣装ケース" | "スチールラック" | "デスク" | "キッチン収納"
  | "ランドリー収納" | "バス・洗面収納" | "玄関収納" | "テレビ台"
  | "本棚" | "クローゼット収納" | "ファイル収納" | "ベビー・安全対策"
  | "突っ張り棒・つっぱり" | "保護・補修材" | "パーツ・アクセサリ"
  | "家電・照明" | "寝具・マットレス" | "ソファ・チェア" | "ダイニング家具"
  | "カーテン・ブラインド"
  | "PC周辺・デスク環境" | "スマートホーム" | "美容家電" | "空気環境家電"
  | "キッチン家電" | "ガジェット・モバイル" | "健康・フィットネス"
  | "その他";

export const CATEGORY_AMAZON_INDEX: Record<ProductCategory, string> = {
  "シェルフ・棚": "kitchen", "カラーボックス": "kitchen", "収納ケース": "kitchen",
  "ワゴン・可動収納": "kitchen", "衣装ケース": "kitchen", "スチールラック": "kitchen",
  "デスク": "office-products", "キッチン収納": "kitchen", "ランドリー収納": "kitchen",
  "バス・洗面収納": "kitchen", "玄関収納": "kitchen", "テレビ台": "kitchen",
  "本棚": "kitchen", "クローゼット収納": "kitchen", "ファイル収納": "office-products",
  "ベビー・安全対策": "baby", "突っ張り棒・つっぱり": "kitchen",
  "保護・補修材": "diy", "パーツ・アクセサリ": "kitchen",
  "家電・照明": "electronics", "寝具・マットレス": "kitchen",
  "ソファ・チェア": "kitchen", "ダイニング家具": "kitchen",
  "カーテン・ブラインド": "kitchen",
  "PC周辺・デスク環境": "computers", "スマートホーム": "electronics",
  "美容家電": "beauty", "空気環境家電": "electronics",
  "キッチン家電": "kitchen", "ガジェット・モバイル": "electronics",
  "健康・フィットネス": "hpc",
  "その他": "aps",
};

export type RelationType =
  | "requires" | "protects_with" | "fits_inside"
  | "coordinates_with" | "enhances_with" | "alternative"
  | "hack_substitute";

export interface HackDetail {
  original_use: string;
  hack_use: string;
  savings_hint: string;
  source_platform?: "youtube" | "blog" | "sns" | "magazine";
  popularity_hint?: string;
  difficulty: "easy" | "medium" | "hard";
  risk_note?: string;
  set_id?: string;
}

export interface RelatedItem {
  relation: RelationType;
  name: string;
  category: string;
  why: string;
  product_id?: string;
  search_keywords: string[];
  price_range?: { min: number; max: number };
  required: boolean;
  hack_detail?: HackDetail;
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
  /** 購入ガイド：AIがユーザーに推薦理由・非推奨理由を伝えるためのヒント */
  buy_guide?: {
    best_for: string[];
    avoid_if: string[];
    decision_hint?: string;
  };
  /** 多言語対応: 海外AIエージェントが参照できる英語メタデータ */
  i18n?: {
    name_en?: string;
    brand_en?: string;
    description_en?: string;
    search_keywords_en?: string[];
  };
  /** 原産国・規格情報 */
  origin?: {
    country: string;
    original_unit?: "mm" | "cm" | "inch";
    jis_compliant?: boolean;
    pse_mark?: boolean;
    voltage?: string;
  };
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

export interface ProductMatch {
  product: KnownProduct;
  confidence: number;
  match_reasons: string[];
}
