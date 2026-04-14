/**
 * 搬入経路チェッカー
 *
 * ヨドバシカメラ・RaCLEaaS等の家電量販店の搬入基準を参考にした判定ロジック。
 *
 * 基準:
 *   - 搬入経路幅: 本体サイズ + 200mm（冷蔵庫・洗濯機・家具共通）
 *   - 入口・エレベーター: 本体サイズ + 200mm
 *   - 階段・踊り場: 本体サイズ + 200mm
 *   - 大型テレビ（梱包）: 梱包サイズ + 100mm
 *   - 螺旋階段: 階段幅 1500mm 以上
 *   - 屈曲階段: 天井高 2100mm 未満の場合、踊り場奥行 1500mm 以上
 *   - 搬入不可時は引き上げ費用が発生する旨を警告
 */

export interface CarryInDimensions {
  width_mm: number;
  height_mm: number;
  depth_mm: number;
  weight_kg?: number;
}

export type CarryInRisk = "none" | "caution" | "warning" | "critical";

export interface BottleneckResult {
  name: string;
  passable: boolean;
  required_mm: number;
  available_mm: number;
  gap_mm: number;
}

export interface CarryInNote {
  risk: CarryInRisk;
  max_side_mm: number;
  max_diagonal_mm: number;
  weight_kg: number | null;
  required_path_width_mm: number;
  messages: string[];
  tips: string[];
  bottleneck_details: BottleneckResult[];
  checklist: string[];
}

// -----------------------------------------------------------------------
// 日本住宅の標準的なボトルネック寸法
// -----------------------------------------------------------------------

const REQUIRED_CLEARANCE_MM = 200;

interface BottleneckSpec {
  name: string;
  typical_width_mm: number;
  typical_height_mm: number;
  typical_depth_mm?: number;
}

const STANDARD_BOTTLENECKS: BottleneckSpec[] = [
  { name: "玄関ドア", typical_width_mm: 780, typical_height_mm: 2000 },
  { name: "室内ドア", typical_width_mm: 750, typical_height_mm: 2000 },
  { name: "共用廊下", typical_width_mm: 900, typical_height_mm: 2400 },
  { name: "室内廊下", typical_width_mm: 780, typical_height_mm: 2400 },
  { name: "エレベーター", typical_width_mm: 800, typical_height_mm: 2200, typical_depth_mm: 1200 },
  { name: "階段踊り場", typical_width_mm: 900, typical_height_mm: 2100, typical_depth_mm: 1500 },
];

const HEAVY_THRESHOLD_KG = 30;
const VERY_HEAVY_THRESHOLD_KG = 50;
const TWO_PERSON_THRESHOLD_KG = 25;

// -----------------------------------------------------------------------
// 内部ヘルパー
// -----------------------------------------------------------------------

function calcDiagonal2D(a: number, b: number): number {
  return Math.sqrt(a * a + b * b);
}

function sortedSides(dims: CarryInDimensions): [number, number, number] {
  const sides = [dims.width_mm, dims.height_mm, dims.depth_mm].sort((a, b) => b - a);
  return [sides[0]!, sides[1]!, sides[2]!];
}

function checkBottleneck(
  sorted: [number, number, number],
  bn: BottleneckSpec,
): BottleneckResult {
  const [longest, mid, shortest] = sorted;
  const requiredWidth = mid + REQUIRED_CLEARANCE_MM;

  const upright = mid <= bn.typical_width_mm && shortest <= bn.typical_width_mm;

  let tiltPass = false;
  if (!upright) {
    const tiltDiag = calcDiagonal2D(longest, shortest);
    tiltPass = tiltDiag <= bn.typical_height_mm && mid <= bn.typical_width_mm;
  }

  let elevatorPass = false;
  if (!upright && !tiltPass && bn.typical_depth_mm) {
    const diag = calcDiagonal2D(mid, shortest);
    elevatorPass =
      (longest <= bn.typical_height_mm && diag <= Math.max(bn.typical_width_mm, bn.typical_depth_mm)) ||
      (mid <= bn.typical_height_mm && calcDiagonal2D(longest, shortest) <= bn.typical_depth_mm);
  }

  const passable = upright || tiltPass || elevatorPass;
  const gap = bn.typical_width_mm - requiredWidth;

  return {
    name: bn.name,
    passable,
    required_mm: requiredWidth,
    available_mm: bn.typical_width_mm,
    gap_mm: gap,
  };
}

// -----------------------------------------------------------------------
// 搬入チェック本体
// -----------------------------------------------------------------------

export function checkCarryIn(dims: CarryInDimensions): CarryInNote {
  const sorted = sortedSides(dims);
  const maxSide = sorted[0];
  const maxDiag = Math.round(calcDiagonal2D(sorted[0], sorted[1]));
  const weight = dims.weight_kg ?? null;
  const requiredPathWidth = sorted[1] + REQUIRED_CLEARANCE_MM;

  const emptyResult: CarryInNote = {
    risk: "none",
    max_side_mm: maxSide,
    max_diagonal_mm: maxDiag,
    weight_kg: weight,
    required_path_width_mm: requiredPathWidth,
    messages: [],
    tips: [],
    bottleneck_details: [],
    checklist: [],
  };

  if (maxSide < 500) return emptyResult;

  const messages: string[] = [];
  const tips: string[] = [];
  const checklist: string[] = [];
  let risk: CarryInRisk = "none";

  const bottleneckResults = STANDARD_BOTTLENECKS.map((bn) => checkBottleneck(sorted, bn));
  const failedBottlenecks = bottleneckResults.filter((r) => !r.passable);
  const tightBottlenecks = bottleneckResults.filter(
    (r) => r.passable && r.gap_mm < 50 && r.gap_mm >= 0,
  );

  if (failedBottlenecks.length > 0) {
    risk = "critical";
    const failedNames = failedBottlenecks.map((r) => r.name).join("・");
    messages.push(
      `本体+${REQUIRED_CLEARANCE_MM}mm=${requiredPathWidth}mm が必要: 標準的な${failedNames}を通過できない可能性があります`,
    );
    tips.push("搬入前に搬入経路（玄関→廊下→設置場所）の実寸を必ず計測してください");
    tips.push("搬入できない場合、引き上げ費用が発生する場合があります");

    if (failedBottlenecks.some((r) => r.name === "エレベーター")) {
      tips.push("エレベーターに入らない場合は階段搬入（追加料金）が必要です");
    }
    if (failedBottlenecks.some((r) => r.name === "階段踊り場")) {
      tips.push("屈曲階段: 天井高2100mm未満なら踊り場奥行1500mm以上が必要です");
      tips.push("螺旋階段: 階段幅1500mm以上が必要です");
      tips.push("搬入困難な場合、窓・ベランダからの吊り上げ搬入（クレーン等）が選択肢です");
    }
  } else if (tightBottlenecks.length > 0) {
    risk = "warning";
    const tightNames = tightBottlenecks.map((r) => `${r.name}(残り${r.gap_mm}mm)`).join("・");
    messages.push(
      `搬入経路がギリギリです: ${tightNames}`,
    );
    tips.push("搬入前に搬入経路の実寸を計測してください");
    tips.push("ドアノブ・手すり・靴箱等の突起物を含めた有効寸法で計測してください");
  } else if (maxSide >= 1500) {
    risk = "warning";
    messages.push(
      `最大辺 ${maxSide}mm: 大型品のため搬入経路の事前確認を推奨します`,
    );
    tips.push("搬入前に搬入経路（玄関→廊下→設置場所）の実寸を計測しておくと安心です");
  } else if (maxSide >= 700) {
    risk = "caution";
    messages.push(
      `最大辺 ${maxSide}mm: 搬入経路に本体+${REQUIRED_CLEARANCE_MM}mm=${requiredPathWidth}mmの余裕が必要です`,
    );
    tips.push("搬入経路のドア幅・廊下幅を確認してください");
  }

  if (weight !== null) {
    if (weight >= VERY_HEAVY_THRESHOLD_KG) {
      if (risk === "none" || risk === "caution") risk = "warning";
      messages.push(`重量 ${weight}kg: 配送業者による搬入・設置を推奨します`);
      tips.push("配送業者の設置サービスの利用を検討してください");
    } else if (weight >= HEAVY_THRESHOLD_KG) {
      if (risk === "none") risk = "caution";
      messages.push(`重量 ${weight}kg: 搬入時に注意が必要な重さです`);
    }
    if (weight >= TWO_PERSON_THRESHOLD_KG) {
      tips.push("二人以上での搬入を推奨します");
    }
  }

  if (maxDiag > 2000 && risk !== "critical") {
    tips.push("斜め搬入でも天井高に収まるか確認してください");
  }

  checklist.push("□ 玄関ドアの幅・高さを計測（ドアノブ含む有効寸法）");
  checklist.push("□ 廊下の幅を計測（手すり・靴箱等の突起物を含む）");
  checklist.push("□ 室内ドアの幅を計測");
  if (maxSide >= 1000) {
    checklist.push("□ 廊下の曲がり角で旋回できるか確認");
    checklist.push("□ エレベーターの内寸（幅・奥行・高さ）を確認");
    checklist.push("□ 階段を使う場合、踊り場の寸法を確認");
  }
  if (weight !== null && weight >= TWO_PERSON_THRESHOLD_KG) {
    checklist.push("□ 配送・設置サービスの有無を確認");
  }

  if (messages.length === 0) return emptyResult;

  return {
    risk,
    max_side_mm: maxSide,
    max_diagonal_mm: maxDiag,
    weight_kg: weight,
    required_path_width_mm: requiredPathWidth,
    messages,
    tips,
    bottleneck_details: bottleneckResults,
    checklist,
  };
}

// -----------------------------------------------------------------------
// カテゴリ名からの重量推定
// -----------------------------------------------------------------------

export function inferWeightFromDimensions(dims: CarryInDimensions, category?: string): number | null {
  const volumeM3 = (dims.width_mm / 1000) * (dims.height_mm / 1000) * (dims.depth_mm / 1000);
  const norm = (category ?? "").normalize("NFKC").toLowerCase();

  if (/(冷蔵庫|冷凍庫|ワインセラー)/.test(norm)) return Math.round(volumeM3 * 200);
  if (/(洗濯機|乾燥機|ドラム)/.test(norm)) return Math.round(volumeM3 * 180);
  if (/(食洗機|食器洗い|食器乾燥)/.test(norm)) return Math.round(volumeM3 * 150);
  if (/(エアコン室外機|室外機)/.test(norm)) return Math.round(volumeM3 * 160);
  if (/(電子ピアノ|ピアノ)/.test(norm)) return Math.round(volumeM3 * 250);
  if (/(マッサージチェア)/.test(norm)) return Math.round(volumeM3 * 130);
  if (/(スチールラック|メタルラック)/.test(norm)) return Math.round(volumeM3 * 100);
  if (/(デスク|机|テーブル)/.test(norm)) return Math.round(volumeM3 * 80);
  if (/(ソファ|ベッド|マットレス)/.test(norm)) return Math.round(volumeM3 * 60);
  if (/(キャビネット|食器棚|本棚|チェスト|タンス|ワードローブ)/.test(norm)) return Math.round(volumeM3 * 90);
  if (/(テレビ|モニター|ディスプレイ)/.test(norm)) return Math.round(volumeM3 * 40);

  if (volumeM3 > 0.3) return Math.round(volumeM3 * 70);
  return null;
}
