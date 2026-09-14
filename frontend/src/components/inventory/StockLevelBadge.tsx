import { Badge } from "@/components/ui/badge";
import { stockLevel } from "@/lib/stock";
import { cn } from "@/lib/utils";
import type { StockRow } from "@/types";

const STYLES = {
  negative: {
    label: "منفی",
    className: "border-red-600/20 bg-red-50 text-red-700 dark:border-red-400/20 dark:bg-red-400/10 dark:text-red-300",
  },
  low: {
    label: "کمتر از حداقل",
    className:
      "border-amber-600/20 bg-amber-50 text-amber-700 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-300",
  },
};

export function StockLevelBadge({ row, className }: { row: Pick<StockRow, "onHand" | "minStock">; className?: string }) {
  const level = stockLevel(row);
  if (level === "ok") return null;
  return (
    <Badge variant="outline" className={cn(STYLES[level].className, className)}>
      {STYLES[level].label}
    </Badge>
  );
}
