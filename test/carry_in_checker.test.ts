import { describe, it, expect } from "vitest";
import { checkCarryIn, inferWeightFromDimensions } from "../utils/carry_in_checker";

describe("checkCarryIn", () => {
  it("returns no risk for small items", () => {
    const result = checkCarryIn({ width_mm: 300, height_mm: 400, depth_mm: 200 });
    expect(result.risk).toBe("none");
    expect(result.messages).toHaveLength(0);
    expect(result.checklist).toHaveLength(0);
  });

  it("returns caution for small-medium items with +200mm rule", () => {
    const result = checkCarryIn({ width_mm: 500, height_mm: 700, depth_mm: 300 });
    expect(result.risk).toBe("caution");
    expect(result.required_path_width_mm).toBe(700);
    expect(result.messages[0]).toContain("+200mm");
  });

  it("returns warning when tight fit on bottlenecks", () => {
    const result = checkCarryIn({ width_mm: 600, height_mm: 1800, depth_mm: 350 });
    expect(result.risk).toBe("warning");
    expect(result.messages[0]).toContain("ギリギリ");
  });

  it("returns critical for items that cannot pass standard bottlenecks", () => {
    const result = checkCarryIn({ width_mm: 900, height_mm: 900, depth_mm: 600 });
    expect(result.risk).toBe("critical");
    expect(result.messages[0]).toContain("通過できない");
    expect(result.tips.some((t) => t.includes("引き上げ費用"))).toBe(true);
    expect(result.bottleneck_details.length).toBeGreaterThan(0);
  });

  it("includes bottleneck details with gap calculations", () => {
    const result = checkCarryIn({ width_mm: 900, height_mm: 900, depth_mm: 600 });
    const door = result.bottleneck_details.find((b) => b.name === "玄関ドア");
    expect(door).toBeDefined();
    expect(door!.required_mm).toBeGreaterThan(0);
    expect(door!.available_mm).toBe(780);
  });

  it("escalates risk for heavy items", () => {
    const result = checkCarryIn({ width_mm: 600, height_mm: 850, depth_mm: 500, weight_kg: 55 });
    expect(result.risk).toBe("warning");
    expect(result.messages.some((m) => m.includes("55kg"))).toBe(true);
    expect(result.tips.some((t) => t.includes("設置サービス"))).toBe(true);
    expect(result.tips.some((t) => t.includes("二人以上"))).toBe(true);
  });

  it("generates a measurement checklist", () => {
    const result = checkCarryIn({ width_mm: 650, height_mm: 1800, depth_mm: 400 });
    expect(result.checklist.length).toBeGreaterThanOrEqual(3);
    expect(result.checklist.some((c) => c.includes("玄関ドア"))).toBe(true);
    expect(result.checklist.some((c) => c.includes("廊下"))).toBe(true);
  });

  it("adds stairway-specific tips for large items failing stair check", () => {
    const result = checkCarryIn({ width_mm: 900, height_mm: 900, depth_mm: 600 });
    if (result.bottleneck_details.find((b) => b.name === "階段踊り場" && !b.passable)) {
      expect(result.tips.some((t) => t.includes("螺旋階段"))).toBe(true);
      expect(result.tips.some((t) => t.includes("屈曲階段"))).toBe(true);
    }
  });

  it("returns required_path_width_mm based on second-longest side + 200mm", () => {
    const result = checkCarryIn({ width_mm: 650, height_mm: 1800, depth_mm: 300 });
    expect(result.required_path_width_mm).toBe(850);
  });
});

describe("inferWeightFromDimensions", () => {
  it("returns null for small items", () => {
    expect(inferWeightFromDimensions({ width_mm: 300, height_mm: 300, depth_mm: 200 })).toBeNull();
  });

  it("estimates weight for a refrigerator", () => {
    const result = inferWeightFromDimensions(
      { width_mm: 600, height_mm: 1700, depth_mm: 650 },
      "冷蔵庫",
    );
    expect(result).toBeGreaterThan(100);
  });

  it("estimates weight for a steel rack", () => {
    const result = inferWeightFromDimensions(
      { width_mm: 900, height_mm: 1800, depth_mm: 450 },
      "スチールラック",
    );
    expect(result).toBeGreaterThan(50);
  });

  it("estimates weight for a piano", () => {
    const result = inferWeightFromDimensions(
      { width_mm: 1400, height_mm: 850, depth_mm: 450 },
      "電子ピアノ",
    );
    expect(result).toBeGreaterThan(100);
  });

  it("estimates from volume alone for large unlabeled items", () => {
    expect(
      inferWeightFromDimensions({ width_mm: 1200, height_mm: 800, depth_mm: 600 }),
    ).toBeGreaterThan(30);
  });
});
