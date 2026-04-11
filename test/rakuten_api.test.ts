import { describe, it, expect } from "vitest";
import { extractDimensions, searchRakutenProducts } from "../adapters/rakuten_api";

describe("extractDimensions", () => {
  it("parses Japanese labeled format", () => {
    const dims = extractDimensions("幅41.9×奥行29.8×高さ87.8cm");
    expect(dims.width_mm).toBe(419);
    expect(dims.depth_mm).toBe(298);
    expect(dims.height_mm).toBe(878);
  });

  it("parses W×D×H English format", () => {
    const dims = extractDimensions("W90×D40×H180cm");
    expect(dims.width_mm).toBe(900);
    expect(dims.depth_mm).toBe(400);
    expect(dims.height_mm).toBe(1800);
  });

  it("parses mm unit", () => {
    const dims = extractDimensions("サイズ:900×400×1800mm");
    expect(dims.width_mm).toBe(900);
    expect(dims.depth_mm).toBe(400);
    expect(dims.height_mm).toBe(1800);
  });

  it("returns null for unparseable text", () => {
    const dims = extractDimensions("素敵な棚です");
    expect(dims.width_mm).toBeNull();
    expect(dims.height_mm).toBeNull();
    expect(dims.depth_mm).toBeNull();
  });
});

describe("searchRakutenProducts (mock)", () => {
  it("returns mock products for valid keyword", async () => {
    const result = await searchRakutenProducts({ keyword: "Nクリック" });
    expect(result.source).toBe("mock");
    expect(result.products.length).toBeGreaterThanOrEqual(1);
  });

  it("applies price filter on mock", async () => {
    const result = await searchRakutenProducts({
      keyword: "棚",
      maxPrice: 5000,
    });
    for (const p of result.products) {
      expect(p.price).toBeLessThanOrEqual(5000);
    }
  });
});
