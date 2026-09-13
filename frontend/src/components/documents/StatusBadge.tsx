import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Document } from "@/types";

// Document status as a badge. Status colours are semantic (grey draft, green
// issued, red cancelled) and always come with the word, never colour alone.
const STATUS: Record<Document["status"], { label: string; className: string }> = {
  DRAFT: {
    label: "پیش‌نویس",
    className: "border-border bg-muted text-muted-foreground",
  },
  ISSUED: {
    label: "صادر شده",
    className:
      "border-emerald-600/20 bg-emerald-50 text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-300",
  },
  CANCELLED: {
    label: "باطل شده",
    className:
      "border-red-600/20 bg-red-50 text-red-700 dark:border-red-400/20 dark:bg-red-400/10 dark:text-red-300",
  },
};

export function StatusBadge({ status, className }: { status: Document["status"]; className?: string }) {
  const s = STATUS[status];
  return (
    <Badge variant="outline" className={cn(s.className, className)}>
      {s.label}
    </Badge>
  );
}
