import { useCountUp } from "@/lib/motion";

/** A figure that counts up to its value; `format` adds the commas, % or units. */
export function AnimatedNumber({ value, format }: { value: number; format: (n: number) => string }) {
  const shown = useCountUp(value);
  // Screen readers get the final value, not every frame of the count.
  return (
    <>
      <span aria-hidden>{format(Math.round(shown))}</span>
      <span className="sr-only">{format(value)}</span>
    </>
  );
}
