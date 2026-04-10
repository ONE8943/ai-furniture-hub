import { z } from "zod";

export const ProposalStatusSchema = z.enum(["pending", "approved", "rejected"]);
export type ProposalStatus = z.infer<typeof ProposalStatusSchema>;

export const ProposalSchema = z.object({
  id: z.string(),
  attribute_key: z.string(),
  status: ProposalStatusSchema,
  created_at: z.string(),
  demand_count: z.number().int().nonnegative(),
  description: z.string(),
  zod_schema_suggestion: z.string(),
  scraping_hint: z.string(),
  sample_intents: z.array(z.string()),
  // 承認・却下時に追加されるフィールド
  reviewed_at: z.string().optional(),
  rejection_reason: z.string().optional(),
});

export type Proposal = z.infer<typeof ProposalSchema>;
