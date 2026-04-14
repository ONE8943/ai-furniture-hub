import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, rm, writeFile } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import {
  findProductGaps,
  summarizeDemandSignals,
  type OpportunityLogPaths,
} from "../utils/opportunity_analyzer";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })),
  );
});

async function createFixtureLogs(): Promise<OpportunityLogPaths> {
  const dir = await mkdtemp(join(tmpdir(), "mcp-opportunity-"));
  tempDirs.push(dir);

  const demandSignals = [
    {
      timestamp: "2026-04-11T01:00:00.000Z",
      tool: "suggest_by_space",
      intent: "洗面所の洗濯機横の隙間に収納を置きたい",
      scene_name: "洗面所・脱衣所",
      space: { width_mm: 450, depth_mm: 320, height_mm: 1000 },
      keywords: { categories: ["カラーボックス"] },
      outcome: {
        result_count: 0,
        miss: true,
        miss_reason: "スペースに入る製品が見つからない",
      },
      fit_context: {
        shelf_category: "カラーボックス",
      },
      safety_flags: ["child_reach_zone"],
    },
    {
      timestamp: "2026-04-11T02:00:00.000Z",
      tool: "coordinate_storage",
      intent: "洗面所に合う収納ケースを探したい",
      scene_name: "洗面所・脱衣所",
      space: { width_mm: 450, depth_mm: 300, height_mm: 900 },
      keywords: { shelf_keyword: "スリムラック" },
      outcome: {
        result_count: 1,
        miss: false,
        top_fit_status: "tight_fit",
        top_fit_detail: "余白少なめ",
      },
      fit_context: {
        shelf_category: "カラーボックス",
        safety_policy: "washroom_gap",
      },
      safety_flags: ["child_reach_zone", "pinch_risk"],
    },
    {
      timestamp: "2026-04-11T03:00:00.000Z",
      tool: "suggest_by_space",
      intent: "クローゼットに収まる収納ボックスを探したい",
      scene_name: "押入れ・クローゼット",
      space: { width_mm: 780, depth_mm: 400, height_mm: 1200 },
      keywords: { categories: ["収納ボックス"] },
      outcome: {
        result_count: 2,
        miss: false,
        top_fit_status: "safe_fit",
        top_fit_detail: "安全余白あり",
      },
      fit_context: {
        storage_category: "収納ボックス",
        safety_policy: "closet_storage",
      },
    },
  ];

  const analyticsLogs = [
    {
      timestamp: "2026-04-11T01:00:00.000Z",
      tool: "suggest_by_space",
      query: { width_mm: 450 },
      intent: "洗面所の洗濯機横の隙間に収納を置きたい",
      hit_count: 0,
      miss: true,
      miss_reason: "該当なし",
    },
    {
      timestamp: "2026-04-11T02:00:00.000Z",
      tool: "coordinate_storage",
      query: { keyword: "スリムラック" },
      intent: "洗面所に合う収納ケースを探したい",
      hit_count: 1,
      miss: false,
    },
  ];

  const requirementGaps = [
    {
      timestamp: "2026-04-11T01:10:00.000Z",
      tool: "suggest_by_space",
      intent: "洗面所の洗濯機横の隙間に収納を置きたい",
      detected_attributes: ["water_resistant"],
      keywords_matched: ["洗面所"],
      search_context: {
        had_results: false,
        hit_count: 0,
      },
    },
  ];

  const demandSignalLogPath = join(dir, "demand_signals.jsonl");
  const analyticsLogPath = join(dir, "analytics.jsonl");
  const requirementGapLogPath = join(dir, "requirement_gaps.jsonl");

  await writeFile(
    demandSignalLogPath,
    demandSignals.map((entry) => JSON.stringify(entry)).join("\n") + "\n",
    "utf-8",
  );
  await writeFile(
    analyticsLogPath,
    analyticsLogs.map((entry) => JSON.stringify(entry)).join("\n") + "\n",
    "utf-8",
  );
  await writeFile(
    requirementGapLogPath,
    requirementGaps.map((entry) => JSON.stringify(entry)).join("\n") + "\n",
    "utf-8",
  );

  return {
    demand_signal_log_path: demandSignalLogPath,
    analytics_log_path: analyticsLogPath,
    requirement_gap_log_path: requirementGapLogPath,
  };
}

describe("opportunity_analyzer", () => {
  it("summarizes demand, miss, scene, and safety signal counts", async () => {
    const paths = await createFixtureLogs();

    const summary = summarizeDemandSignals({ limit: 5, paths });

    expect(summary.total_signals).toBe(3);
    expect(summary.total_misses).toBe(1);
    expect(summary.total_analytics_logs).toBe(2);
    expect(summary.total_requirement_gaps).toBe(1);
    expect(summary.top_scenes[0]).toEqual({ key: "洗面所・脱衣所", count: 2 });
    expect(summary.top_safety_flags).toContainEqual({ key: "child_reach_zone", count: 2 });
    expect(summary.top_width_buckets).toContainEqual({ key: "400-499mm", count: 2 });
    expect(summary.top_miss_reasons).toContainEqual({
      key: "スペースに入る製品が見つからない",
      count: 1,
    });
    expect(summary.recent_examples[0]?.intent).toBe("クローゼットに収まる収納ボックスを探したい");
  });

  it("finds grouped product gaps from miss and tight-fit signals", async () => {
    const paths = await createFixtureLogs();

    const opportunities = findProductGaps({
      limit: 5,
      include_tight_fit: true,
      paths,
    });

    expect(opportunities).toHaveLength(1);
    expect(opportunities[0]).toMatchObject({
      scene_name: "洗面所・脱衣所",
      category_hint: "カラーボックス",
      width_bucket: "400-499mm",
      demand_count: 2,
      miss_count: 1,
      tight_fit_count: 1,
    });
    expect(opportunities[0]?.safety_flags).toContain("child_reach_zone");
    expect(opportunities[0]?.safety_flags).toContain("pinch_risk");

    const missOnly = findProductGaps({
      limit: 5,
      include_tight_fit: false,
      paths,
    });

    expect(missOnly).toHaveLength(1);
    expect(missOnly[0]?.demand_count).toBe(1);
    expect(missOnly[0]?.tight_fit_count).toBe(0);
  });
});
