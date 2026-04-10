import { readdir, readFile, writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { Proposal } from "../schemas/proposal";
import { AttributeDemand, getHotGaps } from "./demand_analyzer";

// -----------------------------------------------------------------------
// 定数
// -----------------------------------------------------------------------
export const PROPOSAL_THRESHOLD = 2;
export const MAX_PROPOSALS_PER_RUN = 5;
const PROPOSALS_DIR = "proposals";
const PENDING_DIR = join(PROPOSALS_DIR, "pending");
const APPROVED_DIR = join(PROPOSALS_DIR, "approved");
const REJECTED_DIR = join(PROPOSALS_DIR, "rejected");

// -----------------------------------------------------------------------
// 属性ごとの Zod スキーマ提案・スクレイピングヒント辞書
// -----------------------------------------------------------------------
const SCHEMA_HINT_MAP: Record<string, { zodSuggestion: string; scrapingHint: string }> = {
  load_capacity_kg: {
    zodSuggestion:
      "load_capacity_kg: z.number().positive().optional().describe('最大耐荷重（kg）')",
    scrapingHint: "商品仕様テーブルの「耐荷重」「最大積載量」「棚板耐荷重」を取得",
  },
  fire_resistant: {
    zodSuggestion:
      "fire_resistant: z.boolean().optional().describe('防炎・難燃性能の有無')",
    scrapingHint: "商品説明・安全性能欄の「防炎」「難燃」「不燃」表記を取得",
  },
  formaldehyde_grade: {
    zodSuggestion:
      "formaldehyde_grade: z.string().optional().describe('化学物質放散等級（例：F☆☆☆☆）')",
    scrapingHint: "商品仕様テーブルの「ホルムアルデヒド放散量」「F☆☆☆☆」表記を取得",
  },
  assembly_difficulty: {
    zodSuggestion:
      "assembly_difficulty: z.enum(['easy','medium','hard']).optional().describe('組み立て難易度')",
    scrapingHint: "商品説明の「組み立て時間の目安」「工具不要」等の記載を取得",
  },
  child_safe: {
    zodSuggestion:
      "child_safe: z.boolean().optional().describe('子供向け安全設計（角丸・転落防止等）')",
    scrapingHint: "商品説明・安全機能欄の「角が丸い」「子供部屋向け」表記を取得",
  },
  has_casters: {
    zodSuggestion: "has_casters: z.boolean().optional().describe('キャスター（車輪）付きか')",
    scrapingHint: "商品名・仕様の「キャスター付き」「移動式」表記を取得",
  },
  water_resistant: {
    zodSuggestion:
      "water_resistant: z.boolean().optional().describe('防水・耐水・防湿加工の有無')",
    scrapingHint: "商品説明の「防水」「耐水」「防湿」「水回り対応」表記を取得",
  },
  earthquake_resistant: {
    zodSuggestion:
      "earthquake_resistant: z.boolean().optional().describe('転倒防止・耐震機能の有無')",
    scrapingHint: "商品説明の「転倒防止金具付き」「耐震」「突っ張り対応」表記を取得",
  },
  has_drawers: {
    zodSuggestion:
      "has_drawers: z.boolean().optional().describe('引き出しの有無')",
    scrapingHint: "商品名・仕様の「引き出し付き」「ドロワー」表記と段数を取得",
  },
  has_lock: {
    zodSuggestion: "has_lock: z.boolean().optional().describe('鍵・ロック機能の有無')",
    scrapingHint: "商品説明の「鍵付き」「ロック付き」「施錠可能」表記を取得",
  },
  weight_kg: {
    zodSuggestion:
      "weight_kg: z.number().positive().optional().describe('商品本体の重量（kg）')",
    scrapingHint: "商品仕様テーブルの「重量」「本体重量」「重さ」を取得",
  },
  made_in_japan: {
    zodSuggestion: "made_in_japan: z.boolean().optional().describe('日本製かどうか')",
    scrapingHint: "商品仕様テーブルの「製造国」「生産国」「Made in Japan」表記を取得",
  },
  warranty_years: {
    zodSuggestion:
      "warranty_years: z.number().int().nonnegative().optional().describe('保証期間（年）')",
    scrapingHint: "商品説明の「保証期間」「品質保証」「アフターサービス」表記を取得",
  },
  eco_certified: {
    zodSuggestion:
      "eco_certified: z.boolean().optional().describe('環境認証（FSC・エコマーク等）の有無')",
    scrapingHint: "商品説明の「FSC認証」「エコマーク」「再生材使用」表記を取得",
  },
  shelf_count: {
    zodSuggestion:
      "shelf_count: z.number().int().positive().optional().describe('棚板の段数')",
    scrapingHint: "商品名・仕様の「〇段」「棚板枚数」「段数」を取得",
  },
  assembly_time_minutes: {
    zodSuggestion:
      "assembly_time_minutes: z.number().int().positive().optional().describe('組み立て所要時間（分）')",
    scrapingHint: "商品説明の「組み立て時間の目安〇分」表記を取得",
  },
  color_variation_count: {
    zodSuggestion:
      "color_variation_count: z.number().int().positive().optional().describe('カラーバリエーション数')",
    scrapingHint: "商品ページのカラーバリエーション選択肢の数を取得",
  },
};

// -----------------------------------------------------------------------
// ディレクトリ初期化
// -----------------------------------------------------------------------
async function ensureProposalDirs(): Promise<void> {
  await mkdir(PENDING_DIR, { recursive: true });
  await mkdir(APPROVED_DIR, { recursive: true });
  await mkdir(REJECTED_DIR, { recursive: true });
}

// -----------------------------------------------------------------------
// 既存の提案IDを取得（重複防止）
// -----------------------------------------------------------------------
async function getExistingProposalKeys(): Promise<Set<string>> {
  const existing = new Set<string>();
  for (const dir of [PENDING_DIR, APPROVED_DIR, REJECTED_DIR]) {
    try {
      const files = await readdir(dir);
      for (const f of files) {
        if (f.endsWith(".json")) {
          try {
            const content = await readFile(join(dir, f), "utf-8");
            const proposal = JSON.parse(content) as Proposal;
            existing.add(proposal.attribute_key);
          } catch {
            // パース失敗は無視
          }
        }
      }
    } catch {
      // ディレクトリが存在しない場合は無視
    }
  }
  return existing;
}

// -----------------------------------------------------------------------
// 単一プロポーザルの生成
// -----------------------------------------------------------------------
function buildProposal(demand: AttributeDemand): Proposal {
  const hint = SCHEMA_HINT_MAP[demand.attribute_key] ?? {
    zodSuggestion: `${demand.attribute_key}: z.string().optional().describe('${demand.description}')`,
    scrapingHint: `商品仕様テーブルから「${demand.description}」に関する情報を取得`,
  };

  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const id = `prop_${dateStr}_${demand.attribute_key}`;

  return {
    id,
    attribute_key: demand.attribute_key,
    status: "pending",
    created_at: new Date().toISOString(),
    demand_count: demand.demand_count,
    description: demand.description,
    zod_schema_suggestion: hint.zodSuggestion,
    scraping_hint: hint.scrapingHint,
    sample_intents: demand.sample_intents,
  };
}

// -----------------------------------------------------------------------
// メイン：需要集計 → プロポーザル自動生成
// -----------------------------------------------------------------------
export interface GenerationResult {
  generated: Proposal[];
  skipped_existing: string[];
  total_hot_gaps: number;
}

export async function generateProposals(
  threshold = PROPOSAL_THRESHOLD,
  maxCount = MAX_PROPOSALS_PER_RUN
): Promise<GenerationResult> {
  await ensureProposalDirs();

  const hotGaps = await getHotGaps(threshold);
  const existingKeys = await getExistingProposalKeys();

  const generated: Proposal[] = [];
  const skippedExisting: string[] = [];

  for (const demand of hotGaps) {
    if (generated.length >= maxCount) break;

    if (existingKeys.has(demand.attribute_key)) {
      skippedExisting.push(demand.attribute_key);
      continue;
    }

    const proposal = buildProposal(demand);
    const filename = `${proposal.id}.json`;
    await writeFile(join(PENDING_DIR, filename), JSON.stringify(proposal, null, 2), "utf-8");
    generated.push(proposal);
  }

  return {
    generated,
    skipped_existing: skippedExisting,
    total_hot_gaps: hotGaps.length,
  };
}
