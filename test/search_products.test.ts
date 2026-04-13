import { describe, it, expect } from "vitest";
import { searchProducts } from "../tools/search_products";

describe("search_products", () => {
  it("returns products for valid dimension query", async () => {
    const result = await searchProducts({
      width_mm_max: 450,
      in_stock_only: true,
      intent: "脱衣所の洗濯機横に幅450mm以内の収納棚を置きたい",
    });
    expect(result.total).toBeGreaterThanOrEqual(1);
    expect(result.miss).toBe(false);
    expect(Array.isArray(result.products)).toBe(true);
  });

  it("returns products under price limit", async () => {
    const result = await searchProducts({
      price_max: 10000,
      category: "カラーボックス",
      in_stock_only: true,
      intent: "子供部屋に安価なカラーボックスを置きたい",
    });
    expect(result.total).toBeGreaterThanOrEqual(1);
    expect(result.miss).toBe(false);
    for (const p of result.products) {
      expect(p.price).toBeLessThanOrEqual(10000);
    }
  });

  it("flags miss when no products match", async () => {
    const result = await searchProducts({
      width_mm_min: 1,
      width_mm_max: 15,
      in_stock_only: true,
      intent: "幅15mm以下の超極小スペースに入る収納を探している",
    });
    expect(result.miss).toBe(true);
    expect(result.suggestion).toBeDefined();
  });

  it("includes affiliate_url on hit products", async () => {
    const result = await searchProducts({
      price_max: 50000,
      in_stock_only: false,
      intent: "引っ越し先にラインナップを見たい",
    });
    expect(result.total).toBeGreaterThanOrEqual(1);
    for (const p of result.products) {
      expect(typeof p.affiliate_url).toBe("string");
    }
  });
});
