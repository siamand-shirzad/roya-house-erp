import * as React from "react"

import { cn } from "@/lib/utils"

// A plain width-based bar instead of Radix Progress: Radix moves the indicator
// with translateX(-n%), which runs the wrong way in RTL. Here the fill is a
// block child, so it starts at the inline start (the right edge in RTL).
function Progress({
  className,
  indicatorClassName,
  value = 0,
  ...props
}: React.ComponentProps<"div"> & { value?: number; indicatorClassName?: string }) {
  const clamped = Math.max(0, Math.min(100, value))
  return (
    <div
      data-slot="progress"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(clamped)}
      className={cn("relative h-2 w-full overflow-hidden rounded-full bg-muted", className)}
      {...props}
    >
      <div
        data-slot="progress-indicator"
        className={cn("h-full rounded-full bg-chart-1 motion-safe:animate-bar-grow", indicatorClassName)}
        style={{ width: `${clamped}%` }}
      />
    </div>
  )
}

export { Progress }
