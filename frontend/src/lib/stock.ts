import type { StockRow } from "@/types";

export type StockLevel = "negative" | "low" | "ok";

/**
 * Negative: more was issued than was ever received (stock needs a receipt or
 * a count). Low: below the product's minimum level. Products without a
 * minimum are never "low", or every uncounted product would be flagged.
 */
export function stockLevel(row: Pick<StockRow, "onHand" | "minStock">): StockLevel {
  if (row.onHand < 0) return "negative";
  if (row.minStock !== null && row.onHand < row.minStock) return "low";
  return "ok";
}
