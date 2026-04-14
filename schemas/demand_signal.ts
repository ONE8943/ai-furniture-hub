import { z } from "zod";

export const FitStatusSchema = z.enum(["safe_fit", "tight_fit", "near_miss", "miss"]);
export const FailedAxisSchema = z.enum(["width", "depth", "height"]);
export const InnerResolutionSchema = z.enum(["curated", "text_inner", "known_spec", "estimated"]);
export const ConfidenceSchema = z.enum(["high", "medium", "low"]);

export const DemandSignalSchema = z.object({
  timestamp: z.string(),
  tool: z.enum(["suggest_by_space", "coordinate_storage"]),
  intent: z.string(),
  scene_name: z.string().nullable().optional(),
  space: z.object({
    width_mm: z.number().int().positive().optional(),
    depth_mm: z.number().int().positive().optional(),
    height_mm: z.number().int().positive().optional(),
  }).optional(),
  keywords: z.object({
    shelf_keyword: z.string().optional(),
    storage_keywords: z.array(z.string()).optional(),
    categories: z.array(z.string()).optional(),
  }).optional(),
  outcome: z.object({
    result_count: z.number().int().nonnegative(),
    miss: z.boolean(),
    top_fit_status: FitStatusSchema.optional(),
    top_fit_detail: z.string().optional(),
    miss_reason: z.string().optional(),
  }),
  fit_context: z.object({
    shelf_category: z.string().optional(),
    storage_category: z.string().optional(),
    inner_source: InnerResolutionSchema.optional(),
    inner_confidence: ConfidenceSchema.optional(),
    safety_policy: z.string().optional(),
    used_rotation: z.boolean().optional(),
    failed_axes: z.array(FailedAxisSchema).optional(),
  }).optional(),
  safety_flags: z.array(z.string()).optional(),
});

export type DemandSignal = z.infer<typeof DemandSignalSchema>;
