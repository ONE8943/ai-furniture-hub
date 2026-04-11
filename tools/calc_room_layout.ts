/**
 * 部屋レイアウト簡易計算ツール
 *
 * 床面（幅×奥行）に家具矩形を重ならないよう配置できるかをグリッド探索する。
 * AIエージェントが「6畳にベッドとデスクと本棚が入る？」に答える補助。
 */
import { z } from "zod";
import { logAnalytics, buildHitLog, buildMissLog } from "../utils/logger";
import { detectGaps, buildGapFeedback, GapDetectionResult } from "../utils/gap_detector";
import { parseOrThrow } from "../utils/validation";

const ItemSchema = z.object({
  label: z.string().min(1).describe("家具の呼び名"),
  width_mm: z.number().positive().describe("床に投影した幅（mm）"),
  depth_mm: z.number().positive().describe("床に投影した奥行き（mm）"),
  count: z.number().int().min(1).max(20).optional().default(1).describe("同じサイズの個数"),
});

export const CalcRoomLayoutParamsSchema = z.object({
  intent: z.string().min(1).describe("【必須】部屋の用途・誰が使うか・制約"),
  room_width_mm: z.number().positive().describe("部屋の有効幅（mm）"),
  room_depth_mm: z.number().positive().describe("部屋の有効奥行き（mm）"),
  items: z.array(ItemSchema).min(1).max(30).describe("配置したい家具リスト"),
  margin_between_mm: z.number().int().min(0).max(500).optional().default(0).describe("家具同士の最小すき間（mm）"),
  wall_clearance_mm: z.number().int().min(0).max(500).optional().default(0).describe("壁からのクリアランス（mm、四辺共通）"),
  grid_step_mm: z.number().int().min(10).max(200).optional().default(50).describe("探索グリッド（mm）。小さいほど精密だが重い"),
});

export type CalcRoomLayoutParams = z.infer<typeof CalcRoomLayoutParamsSchema>;

interface Placement {
  label: string;
  index: number;
  x_mm: number;
  y_mm: number;
  width_mm: number;
  depth_mm: number;
  rotated: boolean;
}

function rectanglesOverlap(
  ax: number, ay: number, aw: number, ad: number,
  bx: number, by: number, bw: number, bd: number,
  margin: number,
): boolean {
  const m = margin / 2;
  return !(
    ax + aw + m <= bx ||
    bx + bw + m <= ax ||
    ay + ad + m <= by ||
    by + bd + m <= ay
  );
}

function canPlace(
  roomW: number,
  roomD: number,
  placed: Placement[],
  x: number,
  y: number,
  w: number,
  d: number,
  margin: number,
): boolean {
  if (x < 0 || y < 0 || x + w > roomW || y + d > roomD) return false;
  for (const p of placed) {
    if (rectanglesOverlap(x, y, w, d, p.x_mm, p.y_mm, p.width_mm, p.depth_mm, margin)) {
      return false;
    }
  }
  return true;
}

export interface CalcRoomLayoutResult {
  fits_all: boolean;
  room: { width_mm: number; depth_mm: number; usable_area_mm2: number };
  placements: Placement[];
  unfitted: Array<{ label: string; index: number; width_mm: number; depth_mm: number }>;
  floor_coverage_percent: number;
  note: string;
  miss: boolean;
  gap_feedback?: { message: string; detected_needs: string[]; note: string };
}

export async function calcRoomLayout(rawInput: unknown): Promise<CalcRoomLayoutResult> {
  const params = parseOrThrow(CalcRoomLayoutParamsSchema, rawInput);

  const gapResult: GapDetectionResult = detectGaps(params.intent);
  const gapFeedback = gapResult.has_gaps
    ? buildGapFeedback(gapResult.detected_attributes, gapResult.keywords_matched)
    : undefined;

  const wall = params.wall_clearance_mm;
  const roomW = Math.max(params.room_width_mm - wall * 2, 1);
  const roomD = Math.max(params.room_depth_mm - wall * 2, 1);
  const margin = params.margin_between_mm;
  const step = params.grid_step_mm;

  type Flat = { label: string; index: number; w: number; d: number };
  const flat: Flat[] = [];
  let idx = 0;
  for (const it of params.items) {
    const n = it.count ?? 1;
    for (let c = 0; c < n; c++) {
      flat.push({ label: it.label, index: idx++, w: it.width_mm, d: it.depth_mm });
    }
  }

  flat.sort((a, b) => Math.max(b.w, b.d) - Math.max(a.w, a.d));

  const placed: Placement[] = [];
  const unfitted: CalcRoomLayoutResult["unfitted"] = [];

  for (const f of flat) {
    let done = false;
    const tries: Array<{ w: number; d: number; rot: boolean }> = [
      { w: f.w, d: f.d, rot: false },
      { w: f.d, d: f.w, rot: true },
    ];
    outer:
    for (let y = 0; y <= roomD && !done; y += step) {
      for (let x = 0; x <= roomW && !done; x += step) {
        for (const t of tries) {
          if (canPlace(roomW, roomD, placed, x, y, t.w, t.d, margin)) {
            placed.push({
              label: f.label,
              index: f.index,
              x_mm: x + wall,
              y_mm: y + wall,
              width_mm: t.w,
              depth_mm: t.d,
              rotated: t.rot,
            });
            done = true;
            break outer;
          }
        }
      }
    }
    if (!done) {
      unfitted.push({ label: f.label, index: f.index, width_mm: f.w, depth_mm: f.d });
    }
  }

  let covered = 0;
  for (const p of placed) {
    covered += p.width_mm * p.depth_mm;
  }
  const usable = roomW * roomD;
  const floor_coverage_percent = Math.round((covered / usable) * 1000) / 10;

  const fits_all = unfitted.length === 0;

  const hitLog = buildHitLog(
    "calc_room_layout",
    {
      room_width_mm: params.room_width_mm,
      placed: placed.length,
      unfitted: unfitted.length,
    },
    params.intent,
    placed.length,
  );
  logAnalytics(hitLog).catch(() => {});
  if (!fits_all) {
    logAnalytics(
      buildMissLog(
        "calc_room_layout",
        { room_width_mm: params.room_width_mm, unfitted_count: unfitted.length },
        params.intent,
        "配置しきれない家具あり",
      ),
    ).catch(() => {});
  }

  return {
    fits_all,
    room: {
      width_mm: params.room_width_mm,
      depth_mm: params.room_depth_mm,
      usable_area_mm2: usable,
    },
    placements: placed,
    unfitted,
    floor_coverage_percent,
    note:
      "床面の矩形パッキングの簡易シミュレーションです。扉の開閉・動線・コンセント位置は考慮していません。" +
      (wall > 0 ? ` 壁クリアランス${wall}mmを内側の有効エリアに反映済み。` : ""),
    miss: false,
    ...(gapFeedback && { gap_feedback: gapFeedback }),
  };
}
