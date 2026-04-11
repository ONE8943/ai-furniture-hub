import { describe, it, expect } from "vitest";
import { calcRoomLayout } from "../tools/calc_room_layout";

describe("calcRoomLayout", () => {
  it("places a single item in a large room", async () => {
    const result = await calcRoomLayout({
      intent: "6畳の寝室にベッドを配置したい",
      room_width_mm: 3600,
      room_depth_mm: 2700,
      items: [{ label: "ベッド", width_mm: 2000, depth_mm: 1000 }],
    });
    expect(result.fits_all).toBe(true);
    expect(result.placements).toHaveLength(1);
    expect(result.unfitted).toHaveLength(0);
  });

  it("detects when items do not fit", async () => {
    const result = await calcRoomLayout({
      intent: "小さいスペースに大きな家具",
      room_width_mm: 500,
      room_depth_mm: 500,
      items: [{ label: "大型棚", width_mm: 1000, depth_mm: 1000 }],
    });
    expect(result.fits_all).toBe(false);
    expect(result.unfitted).toHaveLength(1);
  });

  it("handles multiple items with rotation", async () => {
    const result = await calcRoomLayout({
      intent: "リビングに棚3つ",
      room_width_mm: 3000,
      room_depth_mm: 2000,
      items: [{ label: "棚", width_mm: 900, depth_mm: 300, count: 3 }],
    });
    expect(result.fits_all).toBe(true);
    expect(result.placements).toHaveLength(3);
  });

  it("respects wall clearance", async () => {
    const result = await calcRoomLayout({
      intent: "壁から50mm離して配置",
      room_width_mm: 1000,
      room_depth_mm: 1000,
      items: [{ label: "棚", width_mm: 900, depth_mm: 900 }],
      wall_clearance_mm: 50,
    });
    if (result.fits_all) {
      const p = result.placements[0]!;
      expect(p.x_mm).toBeGreaterThanOrEqual(50);
      expect(p.y_mm).toBeGreaterThanOrEqual(50);
    } else {
      expect(result.unfitted).toHaveLength(1);
    }
  });
});
