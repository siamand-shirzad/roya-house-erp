import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";

import { cn } from "@/lib/utils";

// A row of mutually exclusive options with one selection pill that slides to
// the chosen option. Items with `href` render as links (tabs that own a URL);
// the rest are buttons driven by value/onValueChange.

export type SegmentItem<T extends string> = { value: T; label: ReactNode; icon?: ReactNode; href?: string };

export function SegmentedControl<T extends string>({
  items,
  value,
  onValueChange,
  ariaLabel,
  size = "md",
  className,
}: {
  items: SegmentItem<T>[];
  value: T;
  onValueChange?: (value: T) => void;
  ariaLabel: string;
  size?: "sm" | "md";
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [pill, setPill] = useState<{ left: number; width: number } | null>(null);

  // Measure before paint so the pill never flashes in the wrong place; keep
  // measuring when fonts load or the container resizes.
  useLayoutEffect(() => {
    const container = containerRef.current;
    const active = container?.querySelector<HTMLElement>(`[data-segment="${CSS.escape(value)}"]`);
    if (!container || !active) {
      setPill(null);
      return;
    }
    const update = () => setPill({ left: active.offsetLeft, width: active.offsetWidth });
    update();
    const observer = new ResizeObserver(update);
    observer.observe(container);
    observer.observe(active);
    return () => observer.disconnect();
  }, [value, items]);

  const isNav = items.some((item) => item.href);

  return (
    <div
      ref={containerRef}
      role={isNav ? undefined : "group"}
      aria-label={isNav ? undefined : ariaLabel}
      className={cn("relative inline-flex max-w-full overflow-x-auto rounded-lg bg-muted p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden", className)}
    >
      {pill && (
        <span
          aria-hidden
          className="absolute top-1 bottom-1 rounded-md bg-card shadow-raised ring-1 ring-border/60 dark:bg-white/10 motion-safe:transition-[left,width] motion-safe:duration-300 motion-safe:ease-out"
          style={{ left: pill.left, width: pill.width }}
        />
      )}
      {items.map((item) => {
        const selected = item.value === value;
        const itemClass = cn(
          "relative z-10 inline-flex shrink-0 items-center gap-2 rounded-md font-medium whitespace-nowrap transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none [&_svg]:size-4",
          size === "sm" ? "px-2.5 py-1 text-sm" : "px-3 py-1.5 text-sm",
          selected ? "text-foreground [&_svg]:text-primary" : "text-muted-foreground hover:text-foreground"
        );
        const content = (
          <>
            {item.icon}
            {item.label}
          </>
        );
        return item.href ? (
          <Link
            key={item.value}
            to={item.href}
            data-segment={item.value}
            aria-current={selected ? "page" : undefined}
            className={itemClass}
          >
            {content}
          </Link>
        ) : (
          <button
            key={item.value}
            type="button"
            data-segment={item.value}
            aria-pressed={selected}
            onClick={() => onValueChange?.(item.value)}
            className={itemClass}
          >
            {content}
          </button>
        );
      })}
    </div>
  );
}
