import { describe, it, expect } from "vitest";
import {
  estimateInnerSize,
  calcFittingCount,
  classifySpaceFit,
  type EstimatedInner,
} from "../utils/inner_size_estimator";

describe("estimateInnerSize", () => {
  it("prefers text inner dimensions when available", () => {
    const inner = estimateInnerSize(
      420,
      870,
      290,
      "収納棚 3段 内寸 幅38×奥行26×高さ27cm",
    );

    expect(inner.source).toBe("text_inner");
    expect(inner.confidence).toBe("high");
    expect(inner.reason).toBe("text_inner_triple");
    expect(inner.width_mm).toBe(380);
    expect(inner.depth_mm).toBe(260);
    expect(inner.height_per_tier_mm).toBe(270);
    expect(inner.tiers).toBe(3);
  });

  it("uses known specs for major series", () => {
    const inner = estimateInnerSize(
      770,
      1470,
      390,
      "IKEA KALLAX カラックス 4段 シェルフ",
    );

    expect(inner.source).toBe("known_spec");
    expect(inner.confidence).toBe("high");
    expect(inner.width_mm).toBe(330);
    expect(inner.depth_mm).toBe(380);
  });
});

describe("calcFittingCount", () => {
  const baseShelf: EstimatedInner = {
    width_mm: 400,
    height_per_tier_mm: 300,
    depth_mm: 300,
    tiers: 2,
    source: "estimated",
    confidence: "medium",
    reason: "test_rule",
  };

  it("classifies safe fit and counts capacity", () => {
    const fit = calcFittingCount(
      baseShelf,
      380,
      280,
      280,
      { intent_text: "棚に収納ケースを入れたい" },
    );

    expect(fit.fits).toBe(true);
    expect(fit.status).toBe("safe_fit");
    expect(fit.total).toBe(2);
  });

  it("classifies tight fit when margins are small", () => {
    const fit = calcFittingCount(
      baseShelf,
      398,
      298,
      298,
      { intent_text: "棚に収納ケースを入れたい" },
    );

    expect(fit.fits).toBe(true);
    expect(fit.status).toBe("tight_fit");
  });

  it("uses rotated orientation when that fits better", () => {
    const fit = calcFittingCount(
      {
        ...baseShelf,
        width_mm: 300,
        depth_mm: 220,
        tiers: 1,
      },
      210,
      200,
      290,
      { intent_text: "棚に収納ケースを入れたい" },
    );

    expect(fit.fits).toBe(true);
    expect(fit.used_rotation).toBe(true);
    expect(fit.status).toBe("safe_fit");
  });

  it("classifies slight overflow as near miss", () => {
    const fit = calcFittingCount(
      baseShelf,
      405,
      280,
      280,
      { intent_text: "棚に収納ケースを入れたい" },
    );

    expect(fit.fits).toBe(false);
    expect(fit.status).toBe("near_miss");
  });
});

describe("classifySpaceFit", () => {
  it("uses stricter margins for desks and chairs", () => {
    const fit = classifySpaceFit(
      { width_mm: 600, depth_mm: 500, height_mm: 700 },
      { width_mm: 560, depth_mm: 470, height_mm: 680 },
      { intent_text: "デスク下に椅子をしまいたい" },
    );

    expect(fit.fits).toBe(true);
    expect(fit.status).toBe("tight_fit");
    expect(fit.safety_margin_mm.policy).toBe("desk_chair");
  });
});
