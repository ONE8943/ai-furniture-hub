import { z } from "zod";

/**
 * Zod スキーマでバリデーションし、失敗時は整形されたエラーメッセージでスローする。
 * search_products / get_product_detail 等のツール入力バリデーションに共通利用する。
 */
export function parseOrThrow<T extends z.ZodType>(
  schema: T,
  input: unknown
): z.infer<T> {
  try {
    return schema.parse(input);
  } catch (e) {
    if (e instanceof z.ZodError) {
      throw new Error(`Invalid parameters: ${JSON.stringify(e.issues)}`);
    }
    throw e;
  }
}
