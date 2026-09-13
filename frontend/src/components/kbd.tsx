import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** A keyboard key as printed on the keycap. Always LTR, so "Ctrl K" reads the right way round. */
export function Kbd({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <kbd
      dir="ltr"
      className={cn(
        "inline-flex h-5 min-w-5 items-center justify-center gap-0.5 rounded border bg-muted px-1 font-sans text-[11px] font-medium text-muted-foreground",
        className
      )}
    >
      {children}
    </kbd>
  );
}
