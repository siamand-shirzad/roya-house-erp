import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ChevronLeft, FileText, Plus } from "lucide-react";
import { api } from "@/lib/api";
import { SLUG_TO_TYPE } from "@/lib/documentTypeSlug";
import { cn } from "@/lib/utils";
import { useAuth } from "@/components/auth-provider";
import { DOCUMENT_TYPE_LABELS, DOCUMENT_WRITE_ROLES, type Document } from "@/types";
import { formatToman, formatJalaliDate, toDisplayDigits } from "@/lib/format";

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

export function DocumentListPage() {
  const { typeSlug } = useParams<{ typeSlug: string }>();
  const navigate = useNavigate();
  const type = SLUG_TO_TYPE[typeSlug ?? ""];
  const { user } = useAuth();
  const [docs, setDocs] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!type) return;
    setLoading(true);
    setError(null);
    api.documents
      .list(type)
      .then(setDocs)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [type]);

  if (!type) {
    return <div className="p-8 text-center text-muted-foreground">نوع سند نامعتبر است.</div>;
  }

  const newHref = `/documents/${typeSlug}/new`;
  const canCreate = user ? DOCUMENT_WRITE_ROLES[type].includes(user.role) : false;

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">{DOCUMENT_TYPE_LABELS[type].title}</h2>
          <p className="text-sm text-muted-foreground">
            {loading ? "در حال بارگذاری..." : `${toDisplayDigits(docs.length)} سند`}
          </p>
        </div>
        {canCreate && (
          <Button asChild>
            <Link to={newHref}>
              <Plus /> سند جدید
            </Link>
          </Button>
        )}
      </div>

      <Card className="overflow-hidden py-0">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead className="ps-4">شماره</TableHead>
              <TableHead>تاریخ</TableHead>
              <TableHead>خریدار</TableHead>
              <TableHead>وضعیت</TableHead>
              <TableHead>جمع کل (تومان)</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading &&
              Array.from({ length: 3 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 6 }).map((__, j) => (
                    <TableCell key={j} className={j === 0 ? "ps-4" : undefined}>
                      <Skeleton className="h-4 w-full max-w-24" />
                    </TableCell>
                  ))}
                </TableRow>
              ))}

            {!loading && error && (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-destructive">
                  دریافت اسناد ناموفق بود: {error}
                </TableCell>
              </TableRow>
            )}

            {!loading && !error && docs.length === 0 && (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={6} className="py-14">
                  <div className="flex flex-col items-center gap-3 text-muted-foreground">
                    <div className="flex size-12 items-center justify-center rounded-full bg-muted">
                      <FileText className="size-5" />
                    </div>
                    <div>هنوز سندی ثبت نشده است.</div>
                    {canCreate && (
                      <Button asChild variant="outline" size="sm">
                        <Link to={newHref}>
                          <Plus /> ثبت اولین سند
                        </Link>
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            )}

            {!loading &&
              docs.map((doc) => {
                const href = `/documents/${typeSlug}/${doc.id}`;
                const status = STATUS[doc.status];
                return (
                  <TableRow
                    key={doc.id}
                    className="cursor-pointer"
                    onClick={() => navigate(href)}
                  >
                    <TableCell className="ps-4 font-semibold tabular-nums">
                      <Link
                        to={href}
                        className="hover:text-primary focus-visible:underline focus-visible:outline-none"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {toDisplayDigits(doc.number)}
                      </Link>
                    </TableCell>
                    <TableCell className="tabular-nums text-muted-foreground">
                      {formatJalaliDate(new Date(doc.issueDate))}
                    </TableCell>
                    <TableCell>{doc.buyerName || doc.customer?.name || "—"}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={cn(status.className)}>
                        {status.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium tabular-nums">
                      {formatToman(doc.totals.grandTotal)}
                    </TableCell>
                    <TableCell>
                      <ChevronLeft className="size-4 text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                );
              })}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
