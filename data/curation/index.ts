export * from "./types";
export { BUNDLES } from "./bundles";
export { INFLUENCER_PICKS } from "./influencer_picks";
export { ROOM_PRESETS } from "./room_presets";
export { HACK_SETS } from "./hack_sets";

import { BUNDLES } from "./bundles";
import { INFLUENCER_PICKS } from "./influencer_picks";
import { ROOM_PRESETS } from "./room_presets";
import { HACK_SETS } from "./hack_sets";
import type { CurationType } from "./types";

/**
 * 商品IDから、その商品が含まれるキュレーションのIDリストを返す
 */
export function findCurationsForProduct(productId: string): Array<{
  type: CurationType;
  id: string;
  title: string;
}> {
  const results: Array<{ type: CurationType; id: string; title: string }> = [];

  for (const b of BUNDLES) {
    if (b.product_ids.includes(productId)) {
      results.push({ type: "bundle", id: b.id, title: b.title });
    }
  }
  for (const p of INFLUENCER_PICKS) {
    if (p.product_ids.includes(productId)) {
      results.push({ type: "influencer_pick", id: p.id, title: p.title });
    }
  }
  for (const r of ROOM_PRESETS) {
    if (r.product_ids.includes(productId)) {
      results.push({ type: "room_preset", id: r.id, title: r.title });
    }
  }
  for (const h of HACK_SETS) {
    if (h.target_product_ids.includes(productId)) {
      results.push({ type: "hack_set", id: h.id, title: h.title });
    }
  }

  return results;
}

/**
 * シーンに一致するルームプリセットを返す
 */
export function findPresetsByScene(scene: string) {
  const lower = scene.toLowerCase();
  return ROOM_PRESETS.filter(
    (r) => r.scene.toLowerCase().includes(lower) || r.target_persona.toLowerCase().includes(lower)
  );
}

/**
 * オケージョンに一致するバンドルを返す
 */
export function findBundlesByOccasion(occasion: string) {
  const lower = occasion.toLowerCase();
  return BUNDLES.filter(
    (b) => b.occasion.toLowerCase().includes(lower) || b.title.toLowerCase().includes(lower)
  );
}
