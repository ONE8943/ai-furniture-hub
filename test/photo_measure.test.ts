import { describe, it, expect } from "vitest";
import { measureFromPhoto } from "../utils/photo_measure";
import { findReferenceObject, REFERENCE_OBJECTS, listReferenceNames } from "../utils/reference_objects";

describe("reference_objects", () => {
  it("finds business card by name", () => {
    const ref = findReferenceObject("名刺を横に置いて撮影");
    expect(ref).not.toBeNull();
    expect(ref!.id).toBe("business_card_jp");
    expect(ref!.width_mm).toBe(91);
  });

  it("finds credit card case-insensitively", () => {
    expect(findReferenceObject("Suica")).not.toBeNull();
    expect(findReferenceObject("クレジットカード")).not.toBeNull();
  });

  it("finds pet bottle", () => {
    const ref = findReferenceObject("ペットボトルと一緒に撮りました");
    expect(ref!.id).toBe("pet_bottle_500");
  });

  it("returns null for unknown object", () => {
    expect(findReferenceObject("猫")).toBeNull();
  });

  it("listReferenceNames returns all items", () => {
    const names = listReferenceNames();
    expect(names.length).toBe(REFERENCE_OBJECTS.length);
  });
});

describe("measureFromPhoto", () => {
  it("estimates dimensions from business card reference", () => {
    const result = measureFromPhoto({
      intent: "洗面台横の隙間を測りたい",
      reference_object: "名刺",
      reference_px: { width_px: 182, height_px: 110 },
      target_description: "洗面台横の隙間",
      target_px: { width_px: 600, height_px: 1200 },
    });

    expect(result.reference_used).not.toBeNull();
    expect(result.reference_used!.name).toBe("名刺");
    expect(result.scale_mm_per_px).toBeGreaterThan(0);
    expect(result.width_mm).toBeGreaterThan(200);
    expect(result.height_mm).toBeGreaterThan(400);
    expect(result.confidence).toBe("medium");
    expect(result.method).toBe("reference_scaling");
    expect(result.search_dimensions.width_mm_max).toBeGreaterThan(result.width_mm);
    expect(result.search_dimensions.width_mm_min).toBeLessThan(result.width_mm);
  });

  it("uses perfect 1:1 scale for exact pixel match", () => {
    const result = measureFromPhoto({
      intent: "テスト",
      reference_object: "名刺",
      reference_px: { width_px: 91, height_px: 55 },
      target_description: "対象物",
      target_px: { width_px: 300, height_px: 400 },
    });

    expect(result.scale_mm_per_px).toBeCloseTo(1.0, 1);
    expect(result.width_mm).toBeCloseTo(300, -1);
    expect(result.height_mm).toBeCloseTo(400, -1);
  });

  it("overrides with manual dimensions when provided", () => {
    const result = measureFromPhoto({
      intent: "実測値で上書き",
      reference_object: "A4用紙",
      reference_px: { width_px: 210, height_px: 297 },
      target_description: "棚",
      target_px: { width_px: 420, height_px: 880 },
      manual_dimensions_mm: {
        width_mm: 420,
        height_mm: 880,
        depth_mm: 290,
      },
    });

    expect(result.method).toBe("manual_override");
    expect(result.confidence).toBe("high");
    expect(result.width_mm).toBe(420);
    expect(result.height_mm).toBe(880);
    expect(result.depth_mm).toBe(290);
    expect(result.margin_applied_mm).toBe(10);
  });

  it("uses hybrid when only some manual dimensions given", () => {
    const result = measureFromPhoto({
      intent: "幅だけ実測",
      reference_object: "ペットボトル",
      reference_px: { width_px: 65, height_px: 205 },
      target_description: "隙間",
      target_px: { width_px: 300, height_px: 500 },
      manual_dimensions_mm: { width_mm: 300 },
    });

    expect(result.method).toBe("hybrid");
    expect(result.width_mm).toBe(300);
  });

  it("uses estimated_depth_mm when depth_px is absent", () => {
    const result = measureFromPhoto({
      intent: "奥行き推定",
      reference_object: "名刺",
      reference_px: { width_px: 91, height_px: 55 },
      target_description: "棚",
      target_px: { width_px: 400, height_px: 800 },
      estimated_depth_mm: 350,
    });

    expect(result.depth_mm).toBe(350);
    expect(result.notes.some((n) => n.includes("Vision推定値"))).toBe(true);
  });

  it("calculates depth from pixels when depth_px is provided", () => {
    const result = measureFromPhoto({
      intent: "斜め撮影",
      reference_object: "名刺",
      reference_px: { width_px: 91, height_px: 55 },
      target_description: "棚",
      target_px: { width_px: 400, height_px: 800, depth_px: 200 },
    });

    expect(result.depth_mm).toBeCloseTo(200, -1);
    expect(result.notes.some((n) => n.includes("ピクセル比率から算出"))).toBe(true);
  });

  it("warns on low scale consistency", () => {
    const result = measureFromPhoto({
      intent: "歪んだ写真",
      reference_object: "名刺",
      reference_px: { width_px: 200, height_px: 30 },
      target_description: "棚",
      target_px: { width_px: 400, height_px: 800 },
    });

    expect(result.notes.some((n) => n.includes("アスペクト比"))).toBe(true);
    expect(result.confidence).toBe("low");
  });

  it("throws for unknown reference object", () => {
    expect(() =>
      measureFromPhoto({
        intent: "テスト",
        reference_object: "猫",
        reference_px: { width_px: 100, height_px: 100 },
        target_description: "棚",
        target_px: { width_px: 200, height_px: 300 },
      }),
    ).toThrow("参照物「猫」が見つかりません");
  });

  it("produces search_dimensions with correct margin", () => {
    const result = measureFromPhoto({
      intent: "マージン確認",
      reference_object: "クレジットカード",
      reference_px: { width_px: 85.6, height_px: 53.98 },
      target_description: "隙間",
      target_px: { width_px: 400, height_px: 600 },
    });

    const margin = result.margin_applied_mm;
    expect(result.search_dimensions.width_mm_max).toBe(result.width_mm + margin);
    expect(result.search_dimensions.width_mm_min).toBe(Math.max(0, result.width_mm - margin));
  });
});
