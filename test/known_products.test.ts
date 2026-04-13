import { describe, it, expect } from "vitest";
import {
  KNOWN_PRODUCTS_DB,
  findProductByModelNumber,
  findMatchingProducts,
  findByDimensions,
} from "../shared/catalog/known_products";

describe("KNOWN_PRODUCTS_DB", () => {
  it("has at least 20 products", () => {
    expect(KNOWN_PRODUCTS_DB.length).toBeGreaterThanOrEqual(20);
  });

  it("all products have required fields", () => {
    for (const p of KNOWN_PRODUCTS_DB) {
      expect(p.brand).toBeTruthy();
      expect(typeof p.model_number).toBe("string");
      expect(p.name).toBeTruthy();
      expect(p.outer_width_mm).toBeGreaterThan(0);
      expect(p.outer_height_mm).toBeGreaterThan(0);
      expect(p.outer_depth_mm).toBeGreaterThan(0);
    }
  });
});

describe("findProductByModelNumber", () => {
  it("finds Nクリック by model number", () => {
    const product = findProductByModelNumber("8841424");
    expect(product).toBeDefined();
    expect(product!.brand).toBe("ニトリ");
  });

  it("returns undefined for unknown model", () => {
    const product = findProductByModelNumber("NONEXISTENT-999");
    expect(product).toBeUndefined();
  });
});

describe("findMatchingProducts", () => {
  it("finds products by text features", () => {
    const results = findMatchingProducts("ニトリ Nクリック 3段", 3);
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results[0]!.confidence).toBeGreaterThan(0);
  });
});

describe("findByDimensions", () => {
  it("finds products within dimension range", () => {
    const results = findByDimensions(500, 350, 1000);
    expect(results.length).toBeGreaterThanOrEqual(1);
    for (const p of results) {
      expect(p.outer_width_mm).toBeLessThanOrEqual(500);
      expect(p.outer_depth_mm).toBeLessThanOrEqual(350);
      expect(p.outer_height_mm).toBeLessThanOrEqual(1000);
    }
  });
});
