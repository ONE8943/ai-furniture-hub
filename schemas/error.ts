import { z } from "zod";

export const McpErrorSchema = z.object({
  status: z.literal("error"),
  error_code: z.enum([
    "VALIDATION_ERROR",
    "API_RATE_LIMIT",
    "API_AUTH_ERROR",
    "API_TIMEOUT",
    "API_NETWORK_ERROR",
    "NOT_FOUND",
    "INTERNAL_ERROR",
  ]),
  message: z.string(),
  retry_after_ms: z.number().int().nonnegative().optional(),
  fallback_used: z.boolean().optional(),
});

export type McpError = z.infer<typeof McpErrorSchema>;

export function buildMcpError(
  code: McpError["error_code"],
  message: string,
  opts?: { retry_after_ms?: number; fallback_used?: boolean },
): McpError {
  return {
    status: "error",
    error_code: code,
    message,
    ...(opts?.retry_after_ms !== undefined && { retry_after_ms: opts.retry_after_ms }),
    ...(opts?.fallback_used !== undefined && { fallback_used: opts.fallback_used }),
  };
}
