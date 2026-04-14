import { existsSync, readFileSync } from "fs";
import { AnalyticsLog, AnalyticsLogSchema } from "../schemas/analytics";
import { DemandSignal, DemandSignalSchema } from "../schemas/demand_signal";
import { RequirementGap, RequirementGapSchema } from "../schemas/requirement_gap";

const DEMAND_SIGNAL_LOG_PATH = "logs/demand_signals.jsonl";
const REQUIREMENT_GAP_LOG_PATH = "logs/requirement_gaps.jsonl";
const ANALYTICS_LOG_PATH = "logs/analytics.jsonl";

export interface OpportunityLogPaths {
  demand_signal_log_path?: string;
  requirement_gap_log_path?: string;
  analytics_log_path?: string;
}

interface TopEntry {
  key: string;
  count: number;
}

export interface DemandSummary {
  total_signals: number;
  total_misses: number;
  total_analytics_logs: number;
  total_requirement_gaps: number;
  fit_status_breakdown: TopEntry[];
  top_scenes: TopEntry[];
  top_safety_flags: TopEntry[];
  top_miss_reasons: TopEntry[];
  top_width_buckets: TopEntry[];
  recent_examples: Array<{
    tool: string;
    scene_name: string | null;
    intent: string;
    top_fit_status?: string;
    miss: boolean;
  }>;
}

export interface ProductGapCandidate {
  scene_name: string;
  category_hint: string;
  width_bucket: string;
  demand_count: number;
  miss_count: number;
  tight_fit_count: number;
  safety_flags: string[];
  representative_intents: string[];
  suggested_focus: string;
}

function readJsonlFile<T>(
  path: string,
  validate: (raw: unknown) => T | null,
): T[] {
  if (!existsSync(path)) return [];

  const content = readFileSync(path, "utf-8");
  return content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      try {
        return validate(JSON.parse(line));
      } catch {
        return null;
      }
    })
    .filter((entry): entry is T => entry !== null);
}

function countValues(values: Array<string | null | undefined>): TopEntry[] {
  const counts = new Map<string, number>();
  for (const value of values) {
    const key = value && value.trim() ? value : "不明";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count);
}

function bucketMm(value: number | undefined): string {
  if (!value || value <= 0) return "不明";
  const lower = Math.floor(value / 100) * 100;
  const upper = lower + 99;
  return `${lower}-${upper}mm`;
}

function resolveLogPaths(paths?: OpportunityLogPaths): Required<OpportunityLogPaths> {
  return {
    demand_signal_log_path: paths?.demand_signal_log_path ?? DEMAND_SIGNAL_LOG_PATH,
    requirement_gap_log_path: paths?.requirement_gap_log_path ?? REQUIREMENT_GAP_LOG_PATH,
    analytics_log_path: paths?.analytics_log_path ?? ANALYTICS_LOG_PATH,
  };
}

export function loadDemandSignals(paths?: OpportunityLogPaths): DemandSignal[] {
  const resolved = resolveLogPaths(paths);
  return readJsonlFile(resolved.demand_signal_log_path, (raw) => {
    const parsed = DemandSignalSchema.safeParse(raw);
    return parsed.success ? parsed.data : null;
  });
}

export function loadRequirementGaps(paths?: OpportunityLogPaths): RequirementGap[] {
  const resolved = resolveLogPaths(paths);
  return readJsonlFile(resolved.requirement_gap_log_path, (raw) => {
    const parsed = RequirementGapSchema.safeParse(raw);
    return parsed.success ? parsed.data : null;
  });
}

export function loadAnalyticsLogs(paths?: OpportunityLogPaths): AnalyticsLog[] {
  const resolved = resolveLogPaths(paths);
  return readJsonlFile(resolved.analytics_log_path, (raw) => {
    const parsed = AnalyticsLogSchema.safeParse(raw);
    return parsed.success ? parsed.data : null;
  });
}

export function summarizeDemandSignals(params?: {
  limit?: number;
  scene_name?: string;
  paths?: OpportunityLogPaths;
}): DemandSummary {
  const limit = Math.max(1, Math.min(params?.limit ?? 10, 30));
  const demandSignals = loadDemandSignals(params?.paths).filter((signal) => (
    params?.scene_name ? signal.scene_name === params.scene_name : true
  ));
  const requirementGaps = loadRequirementGaps(params?.paths);
  const analyticsLogs = loadAnalyticsLogs(params?.paths);

  return {
    total_signals: demandSignals.length,
    total_misses: demandSignals.filter((signal) => signal.outcome.miss).length,
    total_analytics_logs: analyticsLogs.length,
    total_requirement_gaps: requirementGaps.length,
    fit_status_breakdown: countValues(
      demandSignals.map((signal) => signal.outcome.top_fit_status ?? (signal.outcome.miss ? "miss" : undefined)),
    ).slice(0, limit),
    top_scenes: countValues(demandSignals.map((signal) => signal.scene_name)).slice(0, limit),
    top_safety_flags: countValues(demandSignals.flatMap((signal) => signal.safety_flags ?? [])).slice(0, limit),
    top_miss_reasons: countValues(
      demandSignals
        .filter((signal) => signal.outcome.miss)
        .map((signal) => signal.outcome.miss_reason),
    ).slice(0, limit),
    top_width_buckets: countValues(
      demandSignals.map((signal) => bucketMm(signal.space?.width_mm)),
    ).slice(0, limit),
    recent_examples: demandSignals
      .slice(-limit)
      .reverse()
      .map((signal) => ({
        tool: signal.tool,
        scene_name: signal.scene_name ?? null,
        intent: signal.intent,
        top_fit_status: signal.outcome.top_fit_status,
        miss: signal.outcome.miss,
      })),
  };
}

export function findProductGaps(params?: {
  limit?: number;
  scene_name?: string;
  include_tight_fit?: boolean;
  paths?: OpportunityLogPaths;
}): ProductGapCandidate[] {
  const limit = Math.max(1, Math.min(params?.limit ?? 10, 30));
  const includeTightFit = params?.include_tight_fit ?? true;
  const signals = loadDemandSignals(params?.paths).filter((signal) => (
    params?.scene_name ? signal.scene_name === params.scene_name : true
  ));

  const buckets = new Map<string, {
    scene_name: string;
    category_hint: string;
    width_bucket: string;
    demand_count: number;
    miss_count: number;
    tight_fit_count: number;
    safety_flags: Set<string>;
    representative_intents: string[];
  }>();

  for (const signal of signals) {
    const status = signal.outcome.top_fit_status ?? (signal.outcome.miss ? "miss" : undefined);
    if (!signal.outcome.miss && !(includeTightFit && status === "tight_fit")) {
      continue;
    }

    const sceneName = signal.scene_name ?? "不明";
    const categoryHint =
      signal.fit_context?.shelf_category ??
      signal.fit_context?.storage_category ??
      signal.keywords?.categories?.[0] ??
      signal.keywords?.shelf_keyword ??
      "未分類";
    const widthBucket = bucketMm(signal.space?.width_mm);
    const key = `${sceneName}::${categoryHint}::${widthBucket}`;

    const current = buckets.get(key) ?? {
      scene_name: sceneName,
      category_hint: categoryHint,
      width_bucket: widthBucket,
      demand_count: 0,
      miss_count: 0,
      tight_fit_count: 0,
      safety_flags: new Set<string>(),
      representative_intents: [],
    };

    current.demand_count += 1;
    if (signal.outcome.miss) current.miss_count += 1;
    if (status === "tight_fit") current.tight_fit_count += 1;
    for (const flag of signal.safety_flags ?? []) current.safety_flags.add(flag);
    if (current.representative_intents.length < 3 && !current.representative_intents.includes(signal.intent)) {
      current.representative_intents.push(signal.intent);
    }

    buckets.set(key, current);
  }

  return Array.from(buckets.values())
    .map((bucket) => ({
      scene_name: bucket.scene_name,
      category_hint: bucket.category_hint,
      width_bucket: bucket.width_bucket,
      demand_count: bucket.demand_count,
      miss_count: bucket.miss_count,
      tight_fit_count: bucket.tight_fit_count,
      safety_flags: Array.from(bucket.safety_flags),
      representative_intents: bucket.representative_intents,
      suggested_focus: bucket.miss_count >= bucket.tight_fit_count
        ? `${bucket.scene_name} の ${bucket.width_bucket} 帯で ${bucket.category_hint} の不足が強い`
        : `${bucket.scene_name} の ${bucket.width_bucket} 帯で ${bucket.category_hint} はあるが余白改善余地が大きい`,
    }))
    .sort((a, b) => {
      if (b.demand_count !== a.demand_count) return b.demand_count - a.demand_count;
      return b.miss_count - a.miss_count;
    })
    .slice(0, limit);
}
