import type { FormEvent, ReactNode } from "react";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

// Add and edit forms open as a centred modal. Only the body scrolls: the
// title and the action buttons stay in view however long the form is, the
// scroll never chains through to the page, and Radix locks the page behind.
// While `busy` (saving), the dialog can't be dismissed by Esc or a click outside.
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
          "flex max-h-[calc(100svh-2rem)] flex-col gap-0 overflow-hidden p-0",
          size === "md" && "sm:max-w-lg",
          size === "lg" && "sm:max-w-2xl",
          size === "xl" && "sm:max-w-3xl"
        )}
      >
        <DialogHeader className="shrink-0 border-b px-6 pt-5 pb-4 pe-12 text-start">
          <DialogTitle className="leading-snug">{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <form onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-6 py-4">{children}</div>
          <div className="flex shrink-0 flex-row flex-wrap items-center gap-2 border-t bg-muted/30 px-6 py-3">
            {footer}
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
