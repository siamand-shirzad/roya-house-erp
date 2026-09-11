import { cn } from "@/lib/utils";

// Roya House logo. Both files are generated from the original JPEG
// (public/brand/roya-house-logo-original.jpg) with a transparent background:
//   roya-house-logo.png          for light surfaces (original charcoal greys)
//   roya-house-logo-on-dark.png  for dark surfaces (greys lifted, red kept)
const LIGHT = "/brand/roya-house-logo.png";
const ON_DARK = "/brand/roya-house-logo-on-dark.png";
const WIDTH = 494;
const HEIGHT = 267;

/**
 * `surface` picks the variant: "light"/"dark" for a fixed background (the
 * charcoal sidebar, the white PDF paper), "auto" to follow the theme.
 * Size it with a height class, e.g. `h-10`.
 */
export function BrandLogo({
  surface = "auto",
  className,
}: {
  surface?: "auto" | "light" | "dark";
  className?: string;
}) {
  const img = (src: string, extra?: string, decorative = false) => (
    <img
      src={src}
      alt={decorative ? "" : "لوگوی رویا هاوس"}
      aria-hidden={decorative || undefined}
      width={WIDTH}
      height={HEIGHT}
      draggable={false}
      className={cn("w-auto select-none", extra, className)}
    />
  );

  if (surface === "light") return img(LIGHT);
  if (surface === "dark") return img(ON_DARK);
  return (
    <>
      {img(LIGHT, "dark:hidden")}
      {img(ON_DARK, "hidden dark:block", true)}
    </>
  );
}
