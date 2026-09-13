import type { FormEvent, ReactNode } from "react";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

// Add and edit forms open as a centred modal that is sized to fit, not to
// scroll: forms lay their fields out several per row with compact inputs
// (see FIELD / INPUT below), so even a short laptop window shows the whole
// form and its buttons at once. Only on a phone-width screen, where a form
// can't fit, does the body fall back to scrolling. While `busy` (saving), Esc
// and outside clicks can't close it.

/** Wrapper for one label + input pair. */
export const FIELD = "grid gap-1";
/** Label text inside a compact form. */
export const LABEL = "text-xs font-normal text-muted-foreground";
/** Height for inputs and select triggers inside a compact form. */
export const INPUT = "h-8";

export function FormDialog({
  open,
  onOpenChange,
  busy = false,
  title,
  description,
  onSubmit,
  footer,
  children,
  size = "md",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  busy?: boolean;
  title: ReactNode;
  description?: ReactNode;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  footer: ReactNode;
  children: ReactNode;
  size?: "md" | "lg" | "xl";
}) {
  return (
    <Dialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <DialogContent
        dir="rtl"
        onInteractOutside={(e) => busy && e.preventDefault()}
        onEscapeKeyDown={(e) => busy && e.preventDefault()}
        className={cn(
          "flex flex-col gap-0 overflow-visible p-0 max-sm:max-h-[calc(100svh-2rem)] max-sm:overflow-hidden",
          size === "md" && "sm:max-w-xl",
          size === "lg" && "sm:max-w-3xl",
          size === "xl" && "sm:max-w-4xl"
        )}
      >
        <DialogHeader className="shrink-0 gap-1 border-b px-5 pt-4 pb-3 pe-12 text-start">
          <DialogTitle className="text-base leading-snug">{title}</DialogTitle>
          {description && <DialogDescription className="text-xs">{description}</DialogDescription>}
        </DialogHeader>
        <form onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-3 px-5 py-4 max-sm:overflow-y-auto">{children}</div>
          <div className="flex shrink-0 flex-row flex-wrap items-center gap-2 border-t bg-muted/30 px-5 py-2.5">
            {footer}
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
