import { appendFile, mkdir } from "fs/promises";
import { dirname } from "path";
import { GapKeywordEntry, RequirementGap } from "../schemas/requirement_gap";

const GAP_LOG_PATH = "logs/requirement_gaps.jsonl";

// -----------------------------------------------------------------------
// 検知キーワード辞書
// キーワードは全角・半角・大小文字の正規化後にマッチされる
// -----------------------------------------------------------------------
export const GAP_KEYWORD_DICT: GapKeywordEntry[] = [
  {
    attribute_key: "load_capacity_kg",
    keywords: ["耐荷重", "荷重", "kg以上", "kgまで", "何kg", "重いもの", "重量物"],
    description: "棚の耐えられる最大荷重（kg）",
  },
  {
    attribute_key: "fire_resistant",
    keywords: ["防炎", "難燃", "消防法", "不燃", "炎", "火事", "火災"],
    description: "防炎・難燃性能",
  },
  {
    attribute_key: "formaldehyde_grade",
    keywords: ["ホルムアルデヒド", "f☆☆☆☆", "f4", "低voc", "voc", "シックハウス", "化学物質"],
    description: "化学物質放散等級（F☆☆☆☆等）",
  },
  {
    attribute_key: "assembly_difficulty",
    keywords: ["組み立て難易度", "組み立て時間", "工具不要", "組み立て簡単", "diy", "一人で組み立て"],
    description: "組み立てのしやすさ・所要時間",
  },
  {
    attribute_key: "child_safe",
    keywords: ["子供", "子ども", "幼児", "赤ちゃん", "安全", "角が丸い", "丸み", "角丸", "転落防止", "落下防止"],
    description: "子供向け安全設計",
  },
  {
    attribute_key: "has_casters",
    keywords: ["キャスター", "移動", "車輪", "ローラー", "動かせる", "キャスタ付き"],
    description: "キャスター（車輪）の有無",
  },
  {
    attribute_key: "water_resistant",
    keywords: ["防水", "耐水", "防湿", "浴室", "洗面所", "水回り", "湿気", "結露", "水に強い"],
    description: "水濡れ・湿気への耐性",
  },
  {
    attribute_key: "earthquake_resistant",
    keywords: ["地震", "転倒防止", "耐震", "固定", "アンカー", "突っ張り"],
    description: "転倒防止・耐震機能",
  },
  {
    attribute_key: "has_drawers",
    keywords: ["引き出し", "ドロワー", "引出し", "スライド"],
    description: "引き出しの有無・数",
  },
  {
    attribute_key: "has_lock",
    keywords: ["鍵", "ロック", "施錠", "カギ", "鍵付き", "セキュリティ"],
    description: "鍵・ロック機能の有無",
  },
  {
    attribute_key: "weight_kg",
    keywords: ["重さ", "重量", "本体重量", "何キロ", "軽い", "持ち運び"],
    description: "商品自体の重量（kg）",
  },
  {
    attribute_key: "made_in_japan",
    keywords: ["日本製", "国産", "メイドインジャパン", "made in japan", "日本で作"],
    description: "製造国（日本製かどうか）",
  },
  {
    attribute_key: "warranty_years",
    keywords: ["保証", "品質保証", "アフターサービス", "保証期間", "修理"],
    description: "品質保証の有無・期間",
  },
  {
    attribute_key: "eco_certified",
    keywords: ["エコ", "環境", "fsc", "再生材", "リサイクル", "サステナブル", "持続可能"],
    description: "環境認証・エコ素材",
  },
  {
    attribute_key: "shelf_count",
    keywords: ["段数", "棚板", "棚の数", "何段", "段", "棚板枚数"],
    description: "棚板の枚数・段数",
  },
  {
    attribute_key: "assembly_time_minutes",
    keywords: ["何分", "組み立て時間", "工事", "取り付け時間"],
    description: "組み立て所要時間（分）",
  },
  {
    attribute_key: "color_variation_count",
    keywords: ["カラーバリエーション", "色展開", "何色", "色違い"],
    description: "カラーバリエーションの数",
  },
];

// -----------------------------------------------------------------------
// テキスト正規化（全角→半角・大文字→小文字）
// -----------------------------------------------------------------------
function normalizeText(text: string): string {
  return text
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

// -----------------------------------------------------------------------
// Gap Detection: intent テキストをスキャンして不足属性を検知
// -----------------------------------------------------------------------
export interface GapDetectionResult {
  detected_attributes: string[];
  keywords_matched: string[];
  has_gaps: boolean;
}

export function detectGaps(intent: string): GapDetectionResult {
  const normalized = normalizeText(intent);
  const detected_attributes: string[] = [];
  const keywords_matched: string[] = [];

  for (const entry of GAP_KEYWORD_DICT) {
    for (const kw of entry.keywords) {
      const normalizedKw = normalizeText(kw);
      if (normalized.includes(normalizedKw)) {
        if (!detected_attributes.includes(entry.attribute_key)) {
          detected_attributes.push(entry.attribute_key);
        }
        if (!keywords_matched.includes(kw)) {
          keywords_matched.push(kw);
        }
      }
    }
  }

  return {
    detected_attributes,
    keywords_matched,
    has_gaps: detected_attributes.length > 0,
  };
}

// -----------------------------------------------------------------------
// Gap ログの書き込み（ノンブロッキング）
// -----------------------------------------------------------------------
async function ensureGapLogDir(): Promise<void> {
  await mkdir(dirname(GAP_LOG_PATH), { recursive: true });
}

export async function logRequirementGap(entry: RequirementGap): Promise<void> {
  try {
    await ensureGapLogDir();
    const line = JSON.stringify(entry) + "\n";
    await appendFile(GAP_LOG_PATH, line, "utf-8");
  } catch (e) {
    console.error("[GapDetector] Log write failed:", e);
  }
}

// -----------------------------------------------------------------------
// Gap フィードバックメッセージの生成
// -----------------------------------------------------------------------
export function buildGapFeedback(
  detectedAttributes: string[],
  keywords: string[]
): { message: string; detected_needs: string[]; note: string } {
  const readableKeywords = keywords.slice(0, 4).join("・");
  const readableAttributes = detectedAttributes.slice(0, 4).join("、");

  return {
    message: `ご要望の「${readableKeywords}」に関するデータは現在収集中です。ニーズとして記録しました。`,
    detected_needs: detectedAttributes,
    note: `検出された属性（${readableAttributes}）は今後のデータ拡充の優先項目として反映されます。`,
  };
}
