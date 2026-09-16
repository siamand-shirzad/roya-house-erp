import { TrendingDown, TrendingUp } from "lucide-react";

import { toDisplayDigits } from "@/lib/format";
import { cn } from "@/lib/utils";

export type Trend = { pct: number; up: boolean };

// Percentage change against the previous period. Skipped (not "0%") when
// there's nothing to compare against or nothing changed — a real zero would
// read as noise, not a fabricated stat.
export function periodTrend(current: number, previous: number): Trend | null {
  if (previous <= 0) return null;
  const pct = Math.round(((current - previous) / previous) * 100);
  return pct === 0 ? null : { pct: Math.abs(pct), up: pct > 0 };
}

/** Change in percentage points, for figures that are already percentages. */
export function pointTrend(current: number | null, previous: number | null): Trend | null {
  if (current === null || previous === null) return null;
  const pct = Math.round(current - previous);
  return pct === 0 ? null : { pct: Math.abs(pct), up: pct > 0 };
}

// Direction is carried by the icon and the sign as well as the colour.
export function TrendBadge({ pct, up, title, unit = "%" }: Trend & { title?: string; unit?: string }) {
  const Icon = up ? TrendingUp : TrendingDown;
  return (
    <span
      title={title}
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-md border px-1.5 py-0.5 text-xs font-medium tabular-nums",
        up
          ? "border-emerald-200 bg-emerald-500/10 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-500/15 dark:text-emerald-300"
          : "border-destructive/20 bg-destructive/10 text-destructive",
      )}
    >
      <Icon className="size-3.5" />
      <span dir="ltr">
        {up ? "+" : "-"}
        {toDisplayDigits(pct)}
        {unit}
      </span>
    </span>
  );
}
