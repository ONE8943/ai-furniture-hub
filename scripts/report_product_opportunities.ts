#!/usr/bin/env ts-node
import {
  findProductGaps,
  summarizeDemandSignals,
} from "../utils/opportunity_analyzer";

async function main(): Promise<void> {
  const summary = summarizeDemandSignals({ limit: 5 });
  const gaps = findProductGaps({ limit: 10, include_tight_fit: true });

  process.stdout.write("\n");
  process.stdout.write("╔══════════════════════════════════════════════════════════╗\n");
  process.stdout.write("║   MCP Hub - Product Opportunity Report                  ║\n");
  process.stdout.write("╚══════════════════════════════════════════════════════════╝\n\n");

  process.stdout.write("## Demand Summary\n");
  process.stdout.write(`- Signals: ${summary.total_signals}\n`);
  process.stdout.write(`- Misses: ${summary.total_misses}\n`);
  process.stdout.write(`- Analytics Logs: ${summary.total_analytics_logs}\n`);
  process.stdout.write(`- Requirement Gaps: ${summary.total_requirement_gaps}\n\n`);

  process.stdout.write("## Top Scenes\n");
  for (const scene of summary.top_scenes) {
    process.stdout.write(`- ${scene.key}: ${scene.count}\n`);
  }
  process.stdout.write("\n");

  process.stdout.write("## Top Safety Flags\n");
  for (const flag of summary.top_safety_flags) {
    process.stdout.write(`- ${flag.key}: ${flag.count}\n`);
  }
  process.stdout.write("\n");

  process.stdout.write("## Product Gaps\n");
  if (gaps.length === 0) {
    process.stdout.write("- まだ gap 候補がありません。demand_signals を蓄積してください。\n");
  } else {
    for (const gap of gaps) {
      process.stdout.write(
        `- ${gap.scene_name} / ${gap.category_hint} / ${gap.width_bucket}: demand=${gap.demand_count}, miss=${gap.miss_count}, tight=${gap.tight_fit_count}\n`,
      );
      process.stdout.write(`  focus: ${gap.suggested_focus}\n`);
      if (gap.safety_flags.length > 0) {
        process.stdout.write(`  safety: ${gap.safety_flags.join(", ")}\n`);
      }
      if (gap.representative_intents.length > 0) {
        process.stdout.write(`  intents: ${gap.representative_intents.join(" | ")}\n`);
      }
    }
  }

  process.stdout.write("\n");
}

main().catch((e) => {
  process.stderr.write(`Error: ${e}\n`);
  process.exit(1);
});
