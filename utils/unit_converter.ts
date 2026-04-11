/**
 * 寸法単位変換ユーティリティ
 * rules/typescript.md: 寸法は必ず mm 単位で統一する
 *
 * 対応フォーマット（ニトリ商品ページの表記パターン）:
 *   "幅40×奥行29×高さ180cm"
 *   "幅400mm×奥行290mm×高さ1800mm"
 *   "40cm"
 *   "400"  (単位なし → mm とみなす)
 */

// -----------------------------------------------------------------------
// 基本変換
// -----------------------------------------------------------------------

/** cm を mm に変換（小数対応） */
export function cmToMm(cm: number): number {
  return Math.round(cm * 10);
}

/** inch を mm に変換 */
export function inchToMm(inch: number): number {
  return Math.round(inch * 25.4);
}

/** mm をそのまま返す（型安全のためのパススルー） */
export function mmToMm(mm: number): number {
  return Math.round(mm);
}

/** 任意の単位から mm に正規化 */
export function normalizeDimension(value: number, from: "mm" | "cm" | "inch"): number {
  switch (from) {
    case "inch": return inchToMm(value);
    case "cm": return cmToMm(value);
    case "mm": return mmToMm(value);
  }
}

/**
 * 文字列から数値と単位を抽出して mm に変換する
 * 例: "40cm" → 400, "400mm" → 400, "40" → 40（mm扱い）
 */
export function parseToMm(raw: string): number | null {
  const trimmed = raw.trim().replace(/,/g, "").replace(/，/g, "");

  // "40cm" / "40.5cm" / "40ｃｍ"（全角）
  const cmMatch = trimmed.match(/^(\d+(?:\.\d+)?)\s*(?:cm|ｃｍ|センチ)$/i);
  if (cmMatch) {
    return cmToMm(parseFloat(cmMatch[1]!));
  }

  // "400mm" / "400.5mm"
  const mmMatch = trimmed.match(/^(\d+(?:\.\d+)?)\s*(?:mm|ｍｍ|ミリ)$/i);
  if (mmMatch) {
    return mmToMm(parseFloat(mmMatch[1]!));
  }

  // "24in" / "24inch" / "24inches" / "24\""
  const inchMatch = trimmed.match(/^(\d+(?:\.\d+)?)\s*(?:in(?:ch(?:es)?)?|"|″|インチ)$/i);
  if (inchMatch) {
    return inchToMm(parseFloat(inchMatch[1]!));
  }

  // 数字のみ（mm とみなす）
  const numOnly = trimmed.match(/^(\d+(?:\.\d+)?)$/);
  if (numOnly) {
    return mmToMm(parseFloat(numOnly[1]!));
  }

  return null;
}

// -----------------------------------------------------------------------
// 寸法文字列のパース
// -----------------------------------------------------------------------

export interface ParsedDimensions {
  width_mm: number;
  height_mm: number;
  depth_mm: number;
}

/**
 * ニトリ商品ページの寸法文字列を解析して mm に変換する
 *
 * 対応パターン:
 *   "幅40×奥行29×高さ180cm"
 *   "幅40cm×奥行29cm×高さ180cm"
 *   "W400×D290×H1800mm"
 *   "幅:40cm / 奥行:29cm / 高さ:180cm"
 */
export function parseDimensionString(raw: string): ParsedDimensions | null {
  const normalized = raw
    .normalize("NFKC")   // 全角→半角
    .replace(/\s+/g, ""); // スペース除去

  // ── パターン1: "幅40×奥行29×高さ180cm" 系 ──
  // cm が末尾に1つだけの場合、全フィールドに適用
  const pattern1 = normalized.match(
    /幅(\d+(?:\.\d+)?)(?:cm)?[×xX*・,]奥行(?:き)?(\d+(?:\.\d+)?)(?:cm)?[×xX*・,]高さ(\d+(?:\.\d+)?)(cm|mm)/i
  );
  if (pattern1) {
    const unit = pattern1[4]!.toLowerCase();
    const convert = unit === "cm" ? cmToMm : mmToMm;
    return {
      width_mm: convert(parseFloat(pattern1[1]!)),
      depth_mm: convert(parseFloat(pattern1[2]!)),
      height_mm: convert(parseFloat(pattern1[3]!)),
    };
  }

  // ── パターン2: "W400×D290×H1800mm" 系 ──
  const pattern2 = normalized.match(
    /W(\d+(?:\.\d+)?)[×xX]D(\d+(?:\.\d+)?)[×xX]H(\d+(?:\.\d+)?)(mm|cm)/i
  );
  if (pattern2) {
    const unit = pattern2[4]!.toLowerCase();
    const convert = unit === "cm" ? cmToMm : mmToMm;
    return {
      width_mm: convert(parseFloat(pattern2[1]!)),
      depth_mm: convert(parseFloat(pattern2[2]!)),
      height_mm: convert(parseFloat(pattern2[3]!)),
    };
  }

  // ── パターン2.5: "24 x 12 x 36 inches" / "24" x 12" x 36"" 系（海外製品） ──
  const patternInch = normalized.match(
    /(\d+(?:\.\d+)?)\s*[×xX*]\s*(\d+(?:\.\d+)?)\s*[×xX*]\s*(\d+(?:\.\d+)?)\s*(?:in(?:ch(?:es)?)?|"|″)/i
  );
  if (patternInch) {
    return {
      width_mm: inchToMm(parseFloat(patternInch[1]!)),
      depth_mm: inchToMm(parseFloat(patternInch[2]!)),
      height_mm: inchToMm(parseFloat(patternInch[3]!)),
    };
  }

  // ── パターン3: "幅:40cm / 奥行:29cm / 高さ:180cm" 系 ──
  const wMatch = normalized.match(/幅[：:]\s*(\d+(?:\.\d+)?)\s*(cm|mm)/i);
  const dMatch = normalized.match(/奥行[き]?[：:]\s*(\d+(?:\.\d+)?)\s*(cm|mm)/i);
  const hMatch = normalized.match(/高さ[：:]\s*(\d+(?:\.\d+)?)\s*(cm|mm)/i);

  if (wMatch && dMatch && hMatch) {
    const convertW = wMatch[2]!.toLowerCase() === "cm" ? cmToMm : mmToMm;
    const convertD = dMatch[2]!.toLowerCase() === "cm" ? cmToMm : mmToMm;
    const convertH = hMatch[2]!.toLowerCase() === "cm" ? cmToMm : mmToMm;
    return {
      width_mm: convertW(parseFloat(wMatch[1]!)),
      depth_mm: convertD(parseFloat(dMatch[1]!)),
      height_mm: convertH(parseFloat(hMatch[1]!)),
    };
  }

  return null;
}

// -----------------------------------------------------------------------
// 価格文字列のパース
// -----------------------------------------------------------------------

/**
 * 価格文字列を整数（円）に変換する
 * 例: "7,990円（税込）" → 7990, "¥12,990" → 12990
 */
export function parsePriceJpy(raw: string): number | null {
  const normalized = raw.normalize("NFKC").replace(/[¥￥$,，\s]/g, "");
  const match = normalized.match(/(\d+)(?:円|円\(税込\)|円（税込）)?/);
  if (match) {
    const value = parseInt(match[1]!, 10);
    return isNaN(value) ? null : value;
  }
  return null;
}
