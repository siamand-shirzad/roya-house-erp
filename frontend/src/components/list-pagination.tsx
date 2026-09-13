import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { toDisplayDigits } from "@/lib/format";
import { cn } from "@/lib/utils";

export const PAGE_SIZE = 10;

/**
 * Client-side paging over an already filtered list. `resetKey` should change
 * whenever the filters or the list itself change (a tab switch, a search), so
 * the view jumps back to page 1 instead of landing on an empty page.
 */
export function usePagination<T>(rows: T[], resetKey: unknown, pageSize = PAGE_SIZE) {
  const [page, setPage] = useState(1);
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));

  useEffect(() => setPage(1), [resetKey]);
  // Deleting the last row on the last page shouldn't strand the view.
  useEffect(() => setPage((p) => Math.min(p, pageCount)), [pageCount]);

  const current = Math.min(page, pageCount);
  const pageRows = useMemo(
    () => rows.slice((current - 1) * pageSize, current * pageSize),
    [rows, current, pageSize]
  );

  return { page: current, pageCount, pageRows, setPage, pageSize, total: rows.length };
}

// 1 … 4 5 6 … 12: first, last, and the neighbours of the current page.
function pageItems(page: number, count: number): (number | "gap")[] {
  const keep = new Set([1, count, page - 1, page, page + 1].filter((p) => p >= 1 && p <= count));
  const sorted = [...keep].sort((a, b) => a - b);
  const out: (number | "gap")[] = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) out.push("gap");
    out.push(p);
  });
  return out;
}

export function ListPagination({
  page,
  pageCount,
  total,
  pageSize,
  onPageChange,
  className,
}: {
  page: number;
  pageCount: number;
  total: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  className?: string;
}) {
  if (total <= pageSize) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <nav aria-label="صفحه‌بندی" className={cn("flex flex-wrap items-center justify-between gap-2", className)}>
      <span className="text-xs text-muted-foreground tabular-nums">
        {toDisplayDigits(from)}–{toDisplayDigits(to)} از {toDisplayDigits(total)}
      </span>
      <div className="flex items-center gap-1">
        {/* RTL: "previous" points right, "next" points left. */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          aria-label="صفحه قبل"
        >
          <ChevronRight /> قبلی
        </Button>
        {pageItems(page, pageCount).map((p, i) =>
          p === "gap" ? (
            <span key={`gap-${i}`} className="px-1 text-muted-foreground">
              …
            </span>
          ) : (
            <Button
              key={p}
              variant={p === page ? "outline" : "ghost"}
              size="sm"
              className={cn("min-w-8 px-2 tabular-nums", p === page && "border-primary/40 text-primary")}
              onClick={() => onPageChange(p)}
              aria-current={p === page ? "page" : undefined}
            >
              {toDisplayDigits(p)}
            </Button>
          )
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= pageCount}
          aria-label="صفحه بعد"
        >
          بعدی <ChevronLeft />
        </Button>
      </div>
    </nav>
  );
}
