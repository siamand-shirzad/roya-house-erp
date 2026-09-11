import { useState } from "react";
import { ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";

// Landing-page photos live in frontend/public/site/ (see the README there).
// Until a file exists, a neutral patterned frame holds the space so the layout
// doesn't shift; in dev the frame is labelled so empty slots are easy to find.
export function SitePhoto({
  src,
  alt,
  slot,
  priority = false,
  className,
}: {
  src: string;
  alt: string;
  slot: string;
  priority?: boolean;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div
        role="img"
        aria-label={alt}
        className={cn("relative overflow-hidden bg-muted", className)}
        style={{
          backgroundImage:
            "repeating-linear-gradient(135deg, transparent 0 14px, color-mix(in oklch, var(--foreground) 6%, transparent) 14px 15px)",
        }}
      >
        {import.meta.env.DEV && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 p-4 text-center text-xs text-muted-foreground">
            <ImageIcon className="size-5" />
            <span>جای عکس: {slot}</span>
            <span dir="ltr" className="font-mono">
              public{src}
            </span>
          </div>
        )}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : "auto"}
      decoding="async"
      onError={() => setFailed(true)}
      className={cn("object-cover", className)}
    />
  );
}
