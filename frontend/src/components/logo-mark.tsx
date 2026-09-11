import { cn } from "@/lib/utils";

// The tile grid from the Roya House logo as a compact square mark (collapsed
// sidebar, favicon). Same geometry as the favicon in index.html: 3x3 rounded
// tiles in an isometric diamond, taupe centre, red bottom tile.
const POSITIONS = [-10.5, -3, 4.5];

export function LogoMark({ onDark = false, className }: { onDark?: boolean; className?: string }) {
  const grey = onDark ? "#d4d4d8" : "#5a5a5c";
  const taupe = onDark ? "#a0918b" : "#6d625c";
  const red = onDark ? "#d0404a" : "#ab2c33";
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={cn("shrink-0", className)}>
      <g transform="translate(16 17) scale(1 .64) rotate(45)">
        {POSITIONS.flatMap((y) =>
          POSITIONS.map((x) => (
            <rect
              key={`${x},${y}`}
              x={x}
              y={y}
              width={6}
              height={6}
              rx={1.4}
              fill={x === -3 && y === -3 ? taupe : x === 4.5 && y === 4.5 ? red : grey}
            />
          ))
        )}
      </g>
    </svg>
  );
}
