import { readFile } from "fs/promises";
import { RequirementGap } from "../schemas/requirement_gap";
import { GAP_KEYWORD_DICT } from "./gap_detector";

const GAP_LOG_PATH = "logs/requirement_gaps.jsonl";

export interface AttributeDemand {
  attribute_key: string;
  demand_count: number;
  description: string;
  sample_intents: string[];
  keywords_seen: string[];
}

/**
 * requirement_gaps.jsonl を読み込み、属性ごとの需要件数を集計する
 */
export async function analyzeDemand(): Promise<AttributeDemand[]> {
  let content = "";
  try {
    content = await readFile(GAP_LOG_PATH, "utf-8");
  } catch {
    return [];
  }

  const lines = content
    .trim()
    .split("\n")
    .filter((l) => l.trim().length > 0);

  const countMap = new Map<
    string,
    { count: number; intents: Set<string>; keywords: Set<string> }
  >();

  for (const line of lines) {
    let entry: RequirementGap;
    try {
      entry = JSON.parse(line) as RequirementGap;
    } catch {
      continue;
    }

    for (const attr of entry.detected_attributes) {
      if (!countMap.has(attr)) {
        countMap.set(attr, { count: 0, intents: new Set(), keywords: new Set() });
      }
      const record = countMap.get(attr)!;
      record.count++;
      // 重複を避けてサンプルintentを最大3件まで収集
      if (record.intents.size < 3) {
        record.intents.add(entry.intent.slice(0, 100));
      }
      for (const kw of entry.keywords_matched) {
        record.keywords.add(kw);
      }
    }
  }

  // 辞書から説明文を引く
  const descriptionMap = new Map(
    GAP_KEYWORD_DICT.map((e) => [e.attribute_key, e.description])
  );

  const results: AttributeDemand[] = Array.from(countMap.entries())
    .map(([attr, data]) => ({
      attribute_key: attr,
      demand_count: data.count,
      description: descriptionMap.get(attr) ?? attr,
      sample_intents: Array.from(data.intents),
      keywords_seen: Array.from(data.keywords),
    }))
    .sort((a, b) => b.demand_count - a.demand_count);

  return results;
}

/**
 * 閾値以上の需要がある属性だけを返す
 */
export async function getHotGaps(threshold = 2): Promise<AttributeDemand[]> {
  const all = await analyzeDemand();
  return all.filter((d) => d.demand_count >= threshold);
}
