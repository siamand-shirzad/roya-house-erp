import { can, type Module } from "@/lib/permissions";
import { ShamsiDatePicker } from "@/components/shamsi-date-picker";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ChevronDown, Download, Ellipsis, Eye, LoaderCircle, Plus, Search, Settings2, Trash, X } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/components/auth-provider";
import { DocumentTypeTabs } from "@/components/documents/DocumentTypeTabs";
import { useDocumentPdfExport } from "@/components/documents/useDocumentPdfExport";
import { StatusBadge } from "@/components/documents/StatusBadge";
import { PaymentStateBadge } from "@/components/payments/InvoicePaymentsCard";
import { toIsoDate } from "@/lib/format";
import { ListPagination } from "@/components/list-pagination";
import { useListState } from "@/lib/list-state";
import { SegmentedControl } from "@/components/segmented-control";
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
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
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
import { cn } from "@/lib/utils";
import { type Document, type DocumentType } from "@/types";

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
  const [pageInfo, setPageInfo] = useState({ total: 0, page: 1, pageSize: 10 });
  const [retryKey, setRetryKey] = useState(0);
  const [docs, setDocs] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { params, update } = useListState();
  const q = params.get("q") ?? "";
  const from = params.get("from") ?? "";
  const to = params.get("to") ?? "";
  const requestedPage = params.get("page") ?? "1";
  const rawStatus = params.get("status");
  const status: StatusFilter = STATUS_FILTERS.find((s) => s.value === rawStatus)?.value ?? "ALL";
  const setQ = (value: string) => update({ q: value });
  const setStatus = (value: StatusFilter) => update({ status: value === "ALL" ? null : value });
  const [deleting, setDeleting] = useState<Document | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [columns, setColumns] = useState({ date: true, total: true });
  const visibleColumnCount = 4 + (columns.date ? 1 : 0) + (columns.total ? 1 : 0);
  const pdf = useDocumentPdfExport();
  // ?customer=<id> (from the customers page) narrows the list to one customer.
  const [searchParams] = useSearchParams();
  const customerId = searchParams.get("customer");
  const [customerName, setCustomerName] = useState<string | null>(null);

  useEffect(() => {
    if (!type) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    const timer = window.setTimeout(() => {
      api.documents.page({ type, customerId: customerId ?? undefined, q: q || undefined,
        status: status === "ALL" ? undefined : status, from: from || undefined, to: to || undefined, page: requestedPage })
        .then(({ rows, ...info }) => { if (!cancelled) { setDocs(rows); setPageInfo(info); } })
        .catch((err) => { if (!cancelled) setError(errorMessage(err)); })
        .finally(() => { if (!cancelled) setLoading(false); });
    }, 200);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [type, customerId, q, status, from, to, requestedPage, retryKey]);

  useEffect(() => {
    setCustomerName(null);
    if (!customerId) return;
    api.customers
      .get(customerId)
      .then((c) => setCustomerName(c.name))
      .catch(() => setCustomerName("مشتری"));
  }, [customerId]);

  const rows = docs;
  const pager = {
    ...pageInfo, pageCount: Math.max(1, Math.ceil(pageInfo.total / pageInfo.pageSize)), pageRows: docs,
    setPage: (page: number) => update({ page: String(page) }, false),
  };

  if (!type) {
    return <div className="p-8 text-center text-muted-foreground">نوع سند نامعتبر است.</div>;
  }

  const customerSearch = customerId ? `?customer=${encodeURIComponent(customerId)}` : "";
  // A new document from a customer-filtered list starts with that customer as buyer.
  const newHref = `/documents/${typeSlug}/new${customerSearch}`;
  const canWrite = user ? can(user, type.toLowerCase() as Module, true) : false;

  async function confirmDelete() {
    if (!deleting) return;
    setDeleteBusy(true);
    try {
      await api.documents.remove(deleting.id);
      setRetryKey((v) => v + 1);
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
      {/* Phones: tabs and an icon-only "new" button share one row. */}
      <div className="flex flex-wrap items-center justify-between gap-3 max-sm:flex-nowrap max-sm:gap-2">
        <DocumentTypeTabs active={type} search={`?${new URLSearchParams([...params].filter(([key]) => key !== "page"))}`} />
        {canWrite && (
          <Button asChild className="max-sm:size-11 max-sm:shrink-0 max-sm:px-0" aria-label={NEW_LABEL[type]}>
            <Link to={newHref}>
              <Plus /> <span className="max-sm:sr-only">{NEW_LABEL[type]}</span>
            </Link>
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-72">
          <Search className="absolute top-2.5 right-2.5 size-4 text-muted-foreground" />
          <Input
            aria-label="جستجوی اسناد"
            placeholder="جستجوی شماره یا نام خریدار..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="pr-8"
          />
        </div>
        <ShamsiDatePicker label="از تاریخ (شمسی)" value={from} max={to} onChange={(value) => update({ from: value })} />
        <ShamsiDatePicker label="تا تاریخ (شمسی)" value={to} min={from} onChange={(value) => update({ to: value })} />
        <SegmentedControl size="sm" ariaLabel="وضعیت سند" items={STATUS_FILTERS} value={status} onValueChange={setStatus} />
        {customerId && (
          <Badge variant="outline" className="gap-1 py-1">
            مشتری: {customerName ?? "..."}
            <button
              type="button"
              onClick={() => update({ customer: null })}
              className="rounded-sm opacity-60 hover:opacity-100"
              title="نمایش اسناد همه مشتریان"
            >
              <X className="size-3.5" />
              <span className="sr-only">نمایش اسناد همه مشتریان</span>
            </button>
          </Badge>
        )}
      </div>

      <Card className="overflow-hidden p-0">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3 max-sm:py-2 md:px-5">
          <p className="text-sm text-muted-foreground tabular-nums">
            {loading ? "در حال بارگذاری..." : `${toDisplayDigits(pageInfo.total)} سند`}
          </p>
          {/* Column choice only matters for the desktop table; phones show cards. */}
          <DropdownMenu dir="rtl">
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="max-sm:hidden">
                <Settings2 /> نمایش ستون‌ها <ChevronDown />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuLabel>ستون‌های جدول</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuCheckboxItem checked={columns.date} onCheckedChange={(v) => setColumns((c) => ({ ...c, date: Boolean(v) }))}>
                تاریخ
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem checked={columns.total} onCheckedChange={(v) => setColumns((c) => ({ ...c, total: Boolean(v) }))}>
                جمع کل
              </DropdownMenuCheckboxItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <Table className="mobile-data-table">
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead className="ps-4">شماره</TableHead>
              {columns.date && <TableHead>تاریخ</TableHead>}
              <TableHead>خریدار</TableHead>
              <TableHead>وضعیت</TableHead>
              {columns.total && <TableHead>جمع کل (تومان)</TableHead>}
              <TableHead className="w-12">
                <span className="sr-only">عملیات</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading &&
              Array.from({ length: 3 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: visibleColumnCount }).map((__, j) => (
                    <TableCell key={j} className={j === 0 ? "ps-4" : undefined}>
                      <Skeleton className="h-4 w-full max-w-24" />
                    </TableCell>
                  ))}
                </TableRow>
              ))}

            {!loading && error && (
              <TableRow>
                <TableCell colSpan={visibleColumnCount} className="py-10 text-center text-destructive">
                  دریافت اسناد ناموفق بود: {error}
                  <Button variant="outline" size="sm" onClick={() => setRetryKey((v) => v + 1)}>تلاش مجدد</Button>
                </TableCell>
              </TableRow>
            )}

            {!loading && !error && rows.length === 0 && (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={visibleColumnCount} className="py-14">
                  <div className="flex flex-col items-center gap-3 text-muted-foreground">
                    <div className="flex size-12 items-center justify-center rounded-full bg-muted">
                      <DocumentTypeIcon type={type} className="size-5" />
                    </div>
                    {!q && status === "ALL" && !from && !to ? (
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
                            update({ q: null, status: null, from: null, to: null });
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
              pager.pageRows.map((doc) => {
                const href = `/documents/${typeSlug}/${doc.id}`;
                const exporting = pdf.exportingId === doc.id;
                return (
                  <TableRow key={doc.id} className="cursor-pointer" onClick={() => navigate(href)}>
                    <TableCell data-label="شماره" className="ps-4 font-semibold tabular-nums">
                      <Link
                        to={href}
                        className="hover:text-primary focus-visible:underline focus-visible:outline-none"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {toDisplayDigits(doc.number)}
                      </Link>
                    </TableCell>
                    {columns.date && (
                      <TableCell data-label="تاریخ" className="tabular-nums text-muted-foreground">
                        {formatJalaliDate(new Date(doc.issueDate))}
                      </TableCell>
                    )}
                    <TableCell data-label="خریدار">{doc.buyerName || doc.customer?.name || "—"}</TableCell>
                    <TableCell data-label="وضعیت">
                      <span className="inline-flex flex-wrap items-center gap-1">
                        <StatusBadge status={doc.status} />
                        <PaymentStateBadge doc={doc} />
                        {doc.type === "PROFORMA" && doc.status === "ISSUED" && doc.validUntil && doc.validUntil < toIsoDate(new Date()) && (
                          <span className="rounded-md border border-destructive/30 px-1.5 py-0.5 text-xs text-destructive">منقضی</span>
                        )}
                      </span>
                    </TableCell>
                    {columns.total && (
                      <TableCell data-label="جمع کل (تومان)" className="font-medium tabular-nums">{formatToman(doc.totals.grandTotal)}</TableCell>
                    )}
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

      {!loading && !error && (
        <ListPagination
          page={pager.page}
          pageCount={pager.pageCount}
          total={pager.total}
          pageSize={pager.pageSize}
          onPageChange={pager.setPage}
        />
      )}

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
