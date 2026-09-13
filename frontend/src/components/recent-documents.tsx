import { useMemo } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, FileStack } from "lucide-react";

import { StatusBadge } from "@/components/documents/StatusBadge";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { TYPE_TO_SLUG } from "@/lib/documentTypeSlug";
import { formatJalaliDate, formatToman, toDisplayDigits } from "@/lib/format";
import { DocumentTypeIcon } from "@/lib/icons";
import { REVEAL, stagger } from "@/lib/motion";
import { DOCUMENT_TYPE_LABELS, type Document } from "@/types";

const SHOWN = 7;

// The dashboard's "what just happened" list, across all three document types.
// It replaces a read-only copy of the price list, which already has its own page.
export function RecentDocuments({ documents, loading }: { documents: Document[]; loading: boolean }) {
  const recent = useMemo(
    () =>
      [...documents]
        .sort((a, b) => (a.issueDate === b.issueDate ? b.number - a.number : a.issueDate < b.issueDate ? 1 : -1))
        .slice(0, SHOWN),
    [documents]
  );

  return (
    <Card className={REVEAL} style={stagger(5)}>
      <CardHeader>
        <CardTitle>آخرین اسناد</CardTitle>
        <CardDescription>پیش‌فاکتور، فاکتور و حواله، جدیدترین اول</CardDescription>
        <CardAction>
          <Link
            to="/documents/proforma"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            همه‌ی اسناد <ChevronLeft className="size-4" />
          </Link>
        </CardAction>
      </CardHeader>
      <CardContent className="px-3">
        {loading ? (
          <div className="space-y-3 px-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : recent.length === 0 ? (
          <div className="flex h-[200px] flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
            <FileStack className="size-6 opacity-50" />
            هنوز سندی ثبت نشده است.
          </div>
        ) : (
          <ul className="divide-y">
            {recent.map((doc, i) => (
              <li
                key={doc.id}
                className="motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-1 motion-safe:duration-300"
                style={stagger(i, 40)}
              >
                <Link
                  to={`/documents/${TYPE_TO_SLUG[doc.type]}/${doc.id}`}
                  className="group flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-muted/60"
                >
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary transition-transform duration-200 motion-safe:group-hover:scale-105">
                    <DocumentTypeIcon type={doc.type} className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2 text-sm font-medium">
                      <span className="tabular-nums">{toDisplayDigits(doc.number)}</span>
                      <span className="text-xs font-normal text-muted-foreground">
                        {DOCUMENT_TYPE_LABELS[doc.type].short}
                      </span>
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {doc.buyerName || doc.customer?.name || "بدون نام"} · {formatJalaliDate(new Date(doc.issueDate))}
                    </span>
                  </span>
                  <span className="flex shrink-0 flex-col items-end gap-1">
                    {doc.type !== "GOODS_ISSUE" && (
                      <span className="text-sm font-medium tabular-nums">{formatToman(doc.totals.grandTotal)}</span>
                    )}
                    <StatusBadge status={doc.status} className="text-[11px]" />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
