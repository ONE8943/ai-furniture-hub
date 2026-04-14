import { describe, it, expect, vi } from "vitest";

describe("fit-oriented tools", () => {
  it("suggest_by_space returns stable miss output in mock mode", async () => {
    process.env.RAKUTEN_API_MOCK = "true";
    vi.resetModules();
    const { suggestBySpace } = await import("../tools/suggest_by_space");

    const result = await suggestBySpace({
      intent: "洗面所の洗濯機横の隙間に収納を置きたい",
      width_mm: 450,
      depth_mm: 320,
      height_mm: 1000,
      categories: ["カラーボックス", "収納ボックス"],
    });

    expect(result.miss).toBe(true);
    expect(result.total_candidates).toBe(0);
    expect(result.suggestion).toBeDefined();
    expect(result.scene_name).toBe("洗面所・脱衣所");
  });

  it("coordinate_storage surfaces inner confidence even when storage misses", async () => {
    process.env.RAKUTEN_API_MOCK = "true";
    vi.resetModules();
    const { coordinateStorage } = await import("../tools/coordinate_storage");

    const result = await coordinateStorage({
      intent: "クローゼットに合う収納ケースを探したい",
      keyword: "Nクリック",
      storage_keyword: "収納ボックス",
      shelf_count: 2,
    });

    expect(result.shelves.length).toBeGreaterThanOrEqual(1);
    expect(result.miss).toBe(true);
    expect(result.shelves[0]?.estimated_inner.confidence).toMatch(/high|medium|low/);
    expect(result.shelves[0]?.estimated_inner.reason.length).toBeGreaterThan(0);
    expect(result.shelves[0]?.shelf.category).toBeDefined();
    expect(result.shelves[0]?.fitting_storage.length).toBe(0);
  });
});
