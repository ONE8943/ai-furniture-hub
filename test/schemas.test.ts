import { describe, it, expect } from "vitest";
import { AnalyticsLogSchema, ConversionLogSchema } from "../schemas/analytics";
import { SearchParamsSchema } from "../schemas/search";

describe("AnalyticsLogSchema", () => {
  it("accepts valid hit log", () => {
    const result = AnalyticsLogSchema.safeParse({
      timestamp: new Date().toISOString(),
      tool: "search_products",
      query: { keyword: "棚" },
      intent: "リビングに棚が欲しい",
      hit_count: 5,
      miss: false,
    });
    expect(result.success).toBe(true);
  });

  it("accepts valid miss log with reason", () => {
    const result = AnalyticsLogSchema.safeParse({
      timestamp: new Date().toISOString(),
      tool: "search_products",
      query: { width_mm_max: 200 },
      intent: "幅200mmの棚",
      hit_count: 0,
      miss: true,
      miss_reason: "該当なし",
    });
    expect(result.success).toBe(true);
  });

  it("rejects log without required fields", () => {
    const result = AnalyticsLogSchema.safeParse({
      tool: "search_products",
    });
    expect(result.success).toBe(false);
  });
});

describe("ConversionLogSchema", () => {
  it("accepts valid conversion log", () => {
    const result = ConversionLogSchema.safeParse({
      timestamp: new Date().toISOString(),
      product_id: "prod-001",
      product_name: "テスト棚",
      platform: "rakuten",
      affiliate_url: "https://example.com/aff",
      intent_summary: "テスト",
      price: 3000,
    });
    expect(result.success).toBe(true);
  });
});

describe("SearchParamsSchema", () => {
  it("accepts minimal params with intent only", () => {
    const result = SearchParamsSchema.safeParse({
      intent: "棚が欲しい",
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing intent", () => {
    const result = SearchParamsSchema.safeParse({
      price_max: 10000,
    });
    expect(result.success).toBe(false);
  });
});
