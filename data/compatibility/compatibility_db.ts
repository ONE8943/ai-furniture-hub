import { CompatibilityEntry } from "./types";

/**
 * 手動検証済みの寸法互換マッピング
 *
 * fit_score は fit_scorer.ts の計算ロジックに加えて、
 * 実際の使用感（収納ケースの互換性等）を加味して手動調整している場合がある。
 */
export const COMPATIBILITY_DB: CompatibilityEntry[] = [
  {
    discontinued_id: "nitori-legacy-ncolo-2tier-sample",
    replacement_id: "nitori-nclick-regular-2",
    dimension_match: "close",
    dimension_diff_mm: { width: -1, height: 2, depth: 0 },
    fit_score: 95,
    note: "旧Nコロ2段の後継。外寸ほぼ同一で収納ケースも流用可能。組み立てがNクリック方式に改良。",
    verified: true,
  },
  {
    discontinued_id: "nitori-legacy-ncolo-2tier-sample",
    replacement_id: "ikea-kallax-2x2",
    dimension_match: "close",
    dimension_diff_mm: { width: -37, height: -30, depth: 49 },
    fit_score: 65,
    note: "KALLAX 2x2は奥行が49mm深い。Nコロ用のインナーボックスは使えないが、同じ壁面スペースに置ける。",
    verified: true,
  },
  {
    discontinued_id: "nitori-legacy-ncolo-2tier-sample",
    replacement_id: "iris-colorbox-3tier",
    dimension_match: "similar_category",
    dimension_diff_mm: { width: -4, height: 310, depth: -8 },
    fit_score: 45,
    note: "アイリス3段は高さが310mm大きいが幅・奥行はほぼ同じ。高さに余裕がある場所なら代替可能。",
    verified: true,
  },
  {
    discontinued_id: "iris-metal-rack-3tier-w90",
    replacement_id: "luminous-regular-5tier-w120",
    dimension_match: "similar_category",
    dimension_diff_mm: { width: 305, height: 410, depth: 110 },
    fit_score: 30,
    note: "サイズアップになるが同じスチールラックカテゴリ。設置スペースに余裕があれば容量2倍以上。",
    verified: false,
  },
  {
    discontinued_id: "iris-metal-rack-3tier-w90",
    replacement_id: "yamazen-steel-rack-5tier",
    dimension_match: "close",
    dimension_diff_mm: { width: 0, height: 300, depth: 0 },
    fit_score: 75,
    note: "同じ幅900mm・奥行450mm。高さが300mm大きい5段タイプ。既存の棚板やPPシートも流用可。",
    verified: true,
  },
  {
    discontinued_id: "ikea-micke-desk-105",
    replacement_id: "nitori-desk-n-click-120",
    dimension_match: "close",
    dimension_diff_mm: { width: 150, height: -5, depth: -100 },
    fit_score: 60,
    note: "幅が150mm大きく奥行は100mm小さい。MICKEの引き出しユニットは使えないが、壁面配置なら置き換え可能。",
    verified: true,
  },
  {
    discontinued_id: "ikea-micke-desk-105",
    replacement_id: "lowya-desk-120",
    dimension_match: "close",
    dimension_diff_mm: { width: 150, height: 0, depth: -50 },
    fit_score: 65,
    note: "同価格帯でデザインも近い。幅が広い分、モニターアーム設置に余裕がある。",
    verified: false,
  },
  {
    discontinued_id: "muji-stacking-2tier",
    replacement_id: "muji-pine-shelf-small",
    dimension_match: "close",
    dimension_diff_mm: { width: 0, height: -5, depth: -80 },
    fit_score: 70,
    note: "同じ無印のパイン材シェルフ。奥行が80mm浅いが幅は同一。スタッキングシェルフ用のインナーは一部流用可。",
    verified: true,
  },
  {
    discontinued_id: "nitori-tv-lowboard-150",
    replacement_id: "lowya-tv-board-150",
    dimension_match: "exact",
    dimension_diff_mm: { width: 0, height: 0, depth: 0 },
    fit_score: 98,
    note: "外寸が完全一致。同じテレビ台スペースにそのまま置き換え可能。デザインは異なるが機能は同等。",
    verified: true,
  },
  {
    discontinued_id: "yamazen-desk-rdp-9060",
    replacement_id: "sanwa-desk-100-0990",
    dimension_match: "close",
    dimension_diff_mm: { width: 100, height: 0, depth: -40 },
    fit_score: 72,
    note: "サンワの方が幅100mm広く奥行40mm浅い。同じシンプルデスクカテゴリで天板厚もほぼ同じ。",
    verified: false,
  },
];
