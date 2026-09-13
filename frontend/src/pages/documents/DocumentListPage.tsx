import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Download, Ellipsis, Eye, LoaderCircle, Plus, Search, Trash } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/components/auth-provider";
import { DocumentTypeTabs } from "@/components/documents/DocumentTypeTabs";
import { useDocumentPdfExport } from "@/components/documents/useDocumentPdfExport";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api, errorMessage } from "@/lib/api";
import { SLUG_TO_TYPE } from "@/lib/documentTypeSlug";
import { formatJalaliDate, formatToman, toDisplayDigits } from "@/lib/format";
import { DocumentTypeIcon } from "@/lib/icons";
import { matchesSearch } from "@/lib/search";
import { cn } from "@/lib/utils";
import { DOCUMENT_WRITE_ROLES, type Document, type DocumentType } from "@/types";

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

const NEW_LABEL: Record<DocumentType, string> = {
  PROFORMA: "پیش‌فاکتور جدید",
  INVOICE: "فاکتور جدید",
  GOODS_ISSUE: "حواله خروج جدید",
};

type StatusFilter = "ALL" | Document["status"];
const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: "ALL", label: "همه" },
  { value: "DRAFT", label: "پیش‌نویس" },
  { value: "ISSUED", label: "صادر شده" },
  { value: "CANCELLED", label: "باطل شده" },
];

export function DocumentListPage() {
  const { typeSlug } = useParams<{ typeSlug: string }>();
  const navigate = useNavigate();
  const type = SLUG_TO_TYPE[typeSlug ?? ""];
  const { user } = useAuth();
  const [docs, setDocs] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<StatusFilter>("ALL");
  const [deleting, setDeleting] = useState<Document | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const pdf = useDocumentPdfExport();

  useEffect(() => {
    if (!type) return;
    setLoading(true);
    setError(null);
    api.documents
      .list(type)
      .then(setDocs)
      .catch((err) => setError(errorMessage(err)))
      .finally(() => setLoading(false));
  }, [type]);

  const rows = useMemo(
    () =>
      docs.filter(
        (d) =>
          (status === "ALL" || d.status === status) &&
          matchesSearch(`${d.number} ${d.buyerName ?? ""} ${d.customer?.name ?? ""}`, q)
      ),
    [docs, q, status]
  );

  if (!type) {
    return <div className="p-8 text-center text-muted-foreground">نوع سند نامعتبر است.</div>;
  }

  const newHref = `/documents/${typeSlug}/new`;
  const canWrite = user ? DOCUMENT_WRITE_ROLES[type].includes(user.role) : false;
  const filtered = q.trim() !== "" || status !== "ALL";

  async function confirmDelete() {
    if (!deleting) return;
    setDeleteBusy(true);
    try {
      await api.documents.remove(deleting.id);
      setDocs((list) => list.filter((d) => d.id !== deleting.id));
      toast.success(`پیش‌نویس ${toDisplayDigits(deleting.number)} حذف شد.`);
      setDeleting(null);
    } catch (err) {
      setDeleting(null);
      toast.error("حذف پیش‌نویس ناموفق بود.", { description: errorMessage(err) });
    } finally {
      setDeleteBusy(false);
    }
  }

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <DocumentTypeTabs active={type} />
        {canWrite && (
          <Button asChild>
            <Link to={newHref}>
              <Plus /> {NEW_LABEL[type]}
            </Link>
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-72">
          <Search className="absolute top-2.5 right-2.5 size-4 text-muted-foreground" />
          <Input
            placeholder="جستجوی شماره یا نام خریدار..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="pr-8"
          />
        </div>
        <div className="inline-flex rounded-md border p-0.5" role="group" aria-label="وضعیت سند">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setStatus(f.value)}
              aria-pressed={status === f.value}
              className={cn(
                "rounded px-2.5 py-1 text-sm transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                status === f.value ? "bg-muted font-medium text-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        <span className="text-sm text-muted-foreground tabular-nums sm:ms-auto">
          {loading
            ? "در حال بارگذاری..."
            : filtered
              ? `${toDisplayDigits(rows.length)} از ${toDisplayDigits(docs.length)} سند`
              : `${toDisplayDigits(docs.length)} سند`}
        </span>
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
              <TableHead className="w-12">
                <span className="sr-only">عملیات</span>
              </TableHead>
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

            {!loading && !error && rows.length === 0 && (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={6} className="py-14">
                  <div className="flex flex-col items-center gap-3 text-muted-foreground">
                    <div className="flex size-12 items-center justify-center rounded-full bg-muted">
                      <DocumentTypeIcon type={type} className="size-5" />
                    </div>
                    {docs.length === 0 ? (
                      <>
                        <div>هنوز سندی ثبت نشده است.</div>
                        {canWrite && (
                          <Button asChild variant="outline" size="sm">
                            <Link to={newHref}>
                              <Plus /> ثبت اولین سند
                            </Link>
                          </Button>
                        )}
                      </>
                    ) : (
                      <>
                        <div>سندی با این جستجو یا وضعیت پیدا نشد.</div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setQ("");
                            setStatus("ALL");
                          }}
                        >
                          پاک کردن فیلترها
                        </Button>
                      </>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            )}

            {!loading &&
              rows.map((doc) => {
                const href = `/documents/${typeSlug}/${doc.id}`;
                const badge = STATUS[doc.status];
                const exporting = pdf.exportingId === doc.id;
                return (
                  <TableRow key={doc.id} className="cursor-pointer" onClick={() => navigate(href)}>
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
                      <Badge variant="outline" className={cn(badge.className)}>
                        {badge.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium tabular-nums">{formatToman(doc.totals.grandTotal)}</TableCell>
                    {/* Menu clicks bubble through the portal in React's tree; keep them off the row. */}
                    <TableCell className="pe-2" onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu dir="rtl" modal={false}>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" aria-label={`عملیات سند ${toDisplayDigits(doc.number)}`}>
                            {exporting ? <LoaderCircle className="animate-spin" /> : <Ellipsis />}
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="min-w-44">
                          <DropdownMenuItem onSelect={() => navigate(href)}>
                            <Eye /> باز کردن
                          </DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => pdf.exportDocument(doc)} disabled={pdf.exportingId !== null}>
                            <Download /> دانلود PDF
                          </DropdownMenuItem>
                          {canWrite && doc.status === "DRAFT" && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem variant="destructive" onSelect={() => setDeleting(doc)}>
                                <Trash /> حذف پیش‌نویس
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}
          </TableBody>
        </Table>
      </Card>

      {pdf.host}

      <AlertDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open && !deleteBusy) setDeleting(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              پیش‌نویس {deleting ? toDisplayDigits(deleting.number) : ""} حذف شود؟
            </AlertDialogTitle>
            <AlertDialogDescription>
              این پیش‌نویس و همه‌ی ردیف‌هایش برای همیشه پاک می‌شود و برگشت‌پذیر نیست. اسناد صادرشده حذف
              نمی‌شوند؛ آن‌ها را باید باطل کرد.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteBusy}>انصراف</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={deleteBusy}
              onClick={(e) => {
                e.preventDefault();
                confirmDelete();
              }}
            >
              {deleteBusy ? <LoaderCircle className="animate-spin" /> : <Trash />}
              حذف پیش‌نویس
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
