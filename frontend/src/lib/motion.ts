import { useEffect, useRef, useState, type CSSProperties } from "react";

// Shared motion helpers. Everything here stands still when the user has asked
// for reduced motion: entrance classes go through motion-safe:, and the
// count-up jumps straight to its value.

/** Entrance for cards and panels: fade in while rising a few pixels. */
export const REVEAL =
  "motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-2 motion-safe:duration-500 motion-safe:ease-out";

/** Delay a REVEAL by the item's position, so a row of cards arrives one after another. */
export function stagger(index: number, stepMs = 70): CSSProperties {
  return { animationDelay: `${index * stepMs}ms`, animationFillMode: "both" };
}

export function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Counts a number up (or down) to `target` with an ease-out curve. The first
 * value counts up from zero; later changes animate from whatever is showing.
 */
export function useCountUp(target: number, durationMs = 800): number {
  const [value, setValue] = useState(0);
  const shown = useRef(0);

  useEffect(() => {
    if (prefersReducedMotion() || !Number.isFinite(target)) {
      shown.current = target;
      setValue(target);
      return;
    }
    const from = shown.current;
    const start = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      shown.current = from + (target - from) * eased;
      setValue(shown.current);
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, durationMs]);

  return value;
}
