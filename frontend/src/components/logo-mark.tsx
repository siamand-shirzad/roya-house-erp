import { cn } from "@/lib/utils";

// The app mark: a geometric "S" folded out of two hexagon halves (black) with
// grey facets between them. Drawn in `currentColor` with the facets as lower
// opacities of the same colour, so one SVG works on light and dark surfaces —
// set the colour with a text class (`text-foreground`, `text-sidebar-foreground`).
// The shape is point-symmetric around the origin; index.html's favicon uses
// the same paths.
export const S_MARK_PATHS = {
  top: "M-316-332L0-516L316-332L-316-52Z",
  bottom: "M316 332L0 516L-316 332L316 52Z",
  facetTop: "M316-332L316-68L43-211Z",
  facetBottom: "M-316 332L-316 68L-43 211Z",
  middleStart: "M-316-52L-80-156L0-114L0 114Z",
  middleEnd: "M0-114L316 52L80 156L0 114Z",
} as const;

export const S_MARK_VIEWBOX = "-340 -540 680 1080";

export function LogoMark({ className, title }: { className?: string; title?: string }) {
  return (
    <svg
      viewBox={S_MARK_VIEWBOX}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
      className={cn("shrink-0", className)}
      fill="currentColor"
    >
      <path d={S_MARK_PATHS.top} />
      <path d={S_MARK_PATHS.bottom} />
      <path d={S_MARK_PATHS.middleStart} fillOpacity={0.55} />
      <path d={S_MARK_PATHS.middleEnd} fillOpacity={0.42} />
      <path d={S_MARK_PATHS.facetTop} fillOpacity={0.3} />
      <path d={S_MARK_PATHS.facetBottom} fillOpacity={0.3} />
    </svg>
  );
}
