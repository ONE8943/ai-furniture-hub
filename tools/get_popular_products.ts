import {
  KNOWN_PRODUCTS_DB,
  getProductCategory,
  ProductCategory,
} from "../shared/catalog/known_products";
import { logAnalytics, buildHitLog } from "../utils/logger";
import {
  attachAffiliateUrls,
  logConversions,
} from "../services/affiliate";
import { searchRakutenProducts } from "../adapters/rakuten_api";
import { buildRakutenAffiliateUrl } from "../adapters/rakuten";

const SEASONAL_HINTS: Record<number, string[]> = {
  1: ["年末年始の片付け需要。クローゼット整理・断捨離向け収納が人気"],
  2: ["新生活準備スタート。引越し先の採寸→家具選びの時期", "花粉対策で空気清浄機の需要増"],
  3: ["新生活セール最盛期。家電セット買いが最安になりやすい", "引越し前にカーテンの採寸を忘れずに（買い忘れ1位）"],
  4: ["新生活セールFinal。Amazon/楽天で家電が数千〜1万円引き", "GW前にデスク環境整備の需要増"],
  5: ["梅雨前の湿気対策。除湿機・除湿剤の準備時期"],
  6: ["梅雨本番。部屋干し対策でランドリーラック・サーキュレーターが人気"],
  7: ["夏の冷房効率UP。遮光カーテン・サーキュレーターの需要増"],
  8: ["夏休み。子供部屋の整理・学習デスク環境の見直し時期"],
  9: ["秋の模様替え。ラグ・カーテン交換の需要", "新学期でランドセルラック等"],
  10: ["冬支度。加湿器・暖房器具の準備", "Amazon/楽天のセール時期"],
  11: ["ブラックフライデー・サイバーマンデー。年間最安で家電が買えるチャンス"],
  12: ["大掃除・年末整理。収納ボックス・ラベルライターの需要増", "ふるさと納税駆け込みで家電も選択肢"],
};

const TREND_TAGS: Record<string, string[]> = {
  "カラーボックス": ["SNS定番", "横置きDIY人気", "100均ボックスとの組み合わせがトレンド"],
  "スチールラック": ["ファミリークローゼット活用がSNSで話題", "PPシート敷き(100均)で小物落下防止"],
  "デスク": ["電動昇降デスクが在宅ワークの標準装備化", "ケーブルトレー必須"],
  "キッチン収納": ["ファイルボックスでフライパン立て収納が定番化", "マグネット収納(tower)が人気"],
  "美容家電": ["ドライヤースタンドでサニタリーをスッキリ", "ReFa/Panasonicの2強"],
  "スマートホーム": ["SwitchBot Hub 2でエアコン操作自動化が普及", "Matter対応が選定基準に"],
  "PC周辺・デスク環境": ["モニターアーム+BenQ ScreenBar+デスクマットが三種の神器", "USB-Cドッキングステーションでケーブル1本化"],
  "空気環境家電": ["セカンド冷凍庫(スキマックス等)が2025年ヒット", "まとめ買い派に必須"],
  "収納ケース": ["ダイソー折りたたみ収納ケース(550円)がSNSでバズ", "セリア後付け引き出しが110円神アイテム"],
};

function getSeasonalHints(): string[] {
  const month = new Date().getMonth() + 1;
  return SEASONAL_HINTS[month] ?? [];
}

function getTrendTags(category: string): string[] {
  return TREND_TAGS[category] ?? [];
}

export interface PopularProductsResult {
  products: Array<{
    name: string;
    brand: string;
    series: string;
    category: string;
    price_range: string;
    outer_dimensions: string;
    visual_features: string[];
    affiliate_url?: string;
    trend_tags?: string[];
  }>;
  total: number;
  miss: boolean;
  category_filter?: string;
  brand_filter?: string;
  seasonal_hints: string[];
  rakuten_trending?: Array<{
    name: string;
    price: number;
    review_count: number;
    review_average: number;
    affiliate_url: string;
  }>;
}

export async function getPopularProducts(rawInput: unknown): Promise<PopularProductsResult> {
  const params = rawInput as {
    intent: string;
    category?: string;
    brand?: string;
    limit?: number;
    include_rakuten_trending?: boolean;
  };

  const limit = Math.min(params.limit ?? 10, 30);
  let filtered = [...KNOWN_PRODUCTS_DB];

  if (params.category) {
    filtered = filtered.filter((p) => getProductCategory(p) === params.category);
  }
  if (params.brand) {
    const brandLower = params.brand.toLowerCase();
    filtered = filtered.filter((p) => p.brand.toLowerCase().includes(brandLower));
  }

  filtered.sort((a, b) => {
    const aScore = a.compatible_storage.length * 10 + a.visual_features.length * 3 + (a.consumables.length > 0 ? 5 : 0);
    const bScore = b.compatible_storage.length * 10 + b.visual_features.length * 3 + (b.consumables.length > 0 ? 5 : 0);
    return bScore - aScore;
  });

  const topProducts = filtered.slice(0, limit);

  const logEntry = buildHitLog("get_popular_products", {
    category: params.category,
    brand: params.brand,
  }, params.intent, topProducts.length);
  logAnalytics(logEntry).catch((e) => console.error("[Analytics]", e));

  if (topProducts.length === 0) {
    return {
      products: [],
      total: 0,
      miss: true,
      category_filter: params.category,
      brand_filter: params.brand,
      seasonal_hints: getSeasonalHints(),
    };
  }

  let rakutenTrending: PopularProductsResult["rakuten_trending"];
  if (params.include_rakuten_trending !== false) {
    try {
      const keyword = params.category ?? params.brand ?? "家具 収納 人気";
      const rakutenResult = await searchRakutenProducts({
        keyword,
        sort: "-reviewCount",
        hits: 5,
      });
      rakutenTrending = rakutenResult.products.map((rp) => ({
        name: rp.name,
        price: rp.price,
        review_count: rp.review_count ?? 0,
        review_average: rp.review_average ?? 0,
        affiliate_url: rp.affiliate_url ?? buildRakutenAffiliateUrl(
          rp.url ?? "",
          process.env.AFFILIATE_ID_RAKUTEN ?? "",
          process.env.UTM_SOURCE ?? "mcp_hub",
          process.env.UTM_MEDIUM ?? "ai_agent",
        ),
      }));
    } catch {
      rakutenTrending = undefined;
    }
  }

  return {
    products: topProducts.map((p) => {
      const cat = getProductCategory(p);
      const tags = getTrendTags(cat);
      return {
        name: p.name,
        brand: p.brand,
        series: p.series,
        category: cat,
        price_range: `¥${p.price_range.min.toLocaleString()}~¥${p.price_range.max.toLocaleString()}`,
        outer_dimensions: `${p.outer_width_mm}×${p.outer_depth_mm}×${p.outer_height_mm}mm`,
        visual_features: p.visual_features,
        affiliate_url: p.url_template.replace("{model_number}", p.model_number),
        ...(tags.length > 0 && { trend_tags: tags }),
      };
    }),
    total: topProducts.length,
    miss: false,
    category_filter: params.category,
    brand_filter: params.brand,
    seasonal_hints: getSeasonalHints(),
    rakuten_trending: rakutenTrending,
  };
}
