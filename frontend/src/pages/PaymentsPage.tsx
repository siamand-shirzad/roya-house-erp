import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Ban, CircleCheck, Ellipsis, HandCoins, Plus, Search, TriangleAlert, Undo2 } from "lucide-react";
import { toast } from "sonner";

import { AnimatedNumber } from "@/components/animated-number";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/components/auth-provider";
import { invalidateHeaderAlerts } from "@/components/header/header-notifications";
import { ListPagination, usePagination } from "@/components/list-pagination";
import { PaymentDialog } from "@/components/payments/PaymentDialog";
import { SegmentedControl } from "@/components/segmented-control";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { api, errorMessage } from "@/lib/api";
import { formatJalaliDate, formatNumber, formatToman, jalaliToGregorian, toDisplayDigits, toIsoDate, toJalali } from "@/lib/format";
import { REVEAL, stagger } from "@/lib/motion";
import { can } from "@/lib/permissions";
import { matchesSearch } from "@/lib/search";
import { cn } from "@/lib/utils";
import {
  CHEQUE_STATUS_LABELS,
  PAYMENT_METHOD_LABELS,
  type ChequeStatus,
  type CustomerBalance,
  type Payment,
} from "@/types";

// Payments received, cheques in hand, and what each customer still owes.
// URL state: ?tab=cheques|balances, ?new=1 opens the payment form.

type Tab = "payments" | "cheques" | "balances";
const TH = "px-3 py-2.5 text-right font-medium";
const day = (iso: string | null) => (iso ? formatJalaliDate(new Date(`${iso}T12:00:00`)) : "—");

const CHEQUE_TONE: Record<ChequeStatus, string> = {
  PENDING: "border-amber-600/25 bg-amber-50 text-amber-800 dark:border-amber-400/25 dark:bg-amber-400/10 dark:text-amber-300",
  CLEARED: "border-emerald-600/20 bg-emerald-50 text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-300",
  BOUNCED: "border-red-600/20 bg-red-50 text-red-700 dark:border-red-400/20 dark:bg-red-400/10 dark:text-red-300",
};

export function PaymentsPage() {
  const { user } = useAuth();
  const canWrite = can(user, "payments", true);
  const [params, setParams] = useSearchParams();
  const tabParam = params.get("tab");
  const tab: Tab = tabParam === "cheques" || tabParam === "balances" ? tabParam : "payments";

  const [payments, setPayments] = useState<Payment[]>([]);
  const [balances, setBalances] = useState<CustomerBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const [q, setQ] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [cancelling, setCancelling] = useState<Payment | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [busy, setBusy] = useState(false);

  const setQuery = (patch: Record<string, string | null>) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        for (const [k, v] of Object.entries(patch)) (v === null ? next.delete(k) : next.set(k, v));
        return next;
      },
      { replace: true }
    );

  // Quick create in the header links here with ?new=1; the flag is consumed once.
  const wantsNew = params.get("new") === "1";
  useEffect(() => {
    if (!wantsNew) return;
    if (canWrite) setDialogOpen(true);
    setQuery({ new: null });
  }, [wantsNew]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([api.payments.list(), api.payments.balances()])
      .then(([p, b]) => {
        if (cancelled) return;
        setPayments(p);
        setBalances(b);
      })
      .catch((err) => !cancelled && setError(`دریافت اطلاعات ناموفق بود: ${errorMessage(err)}`))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [version]);

  const reload = () => {
    invalidateHeaderAlerts();
    setVersion((v) => v + 1);
  };

  const today = toIsoDate(new Date());
  const { jy, jm } = toJalali(new Date());
  const monthStart = toIsoDate(jalaliToGregorian(jy, jm, 1));
  const active = payments.filter((p) => p.status === "ACTIVE");
  const counted = active.filter((p) => p.chequeStatus !== "BOUNCED");
  const pendingCheques = active.filter((p) => p.method === "CHEQUE" && p.chequeStatus === "PENDING");
  const receivable = balances.reduce((s, b) => s + Math.max(0, b.balance), 0);
  const receivedThisMonth = counted.filter((p) => p.paidAt >= monthStart).reduce((s, p) => s + p.amount, 0);

  const paymentRows = useMemo(
    () =>
      payments.filter((p) =>
        matchesSearch(
          `${p.number} ${p.customerName ?? ""} ${p.payerName ?? ""} ${p.document?.number ?? ""} ${p.reference ?? ""} ${p.chequeNumber ?? ""} ${PAYMENT_METHOD_LABELS[p.method]}`,
          q
        )
      ),
    [payments, q]
  );
  const chequeRows = useMemo(
    () =>
      payments
        .filter((p) => p.method === "CHEQUE" && p.status === "ACTIVE")
        .filter((p) => matchesSearch(`${p.chequeNumber ?? ""} ${p.chequeBank ?? ""} ${p.customerName ?? ""} ${p.payerName ?? ""}`, q))
        .sort((a, b) => (a.chequeDueDate ?? "").localeCompare(b.chequeDueDate ?? "")),
    [payments, q]
  );
  const balanceRows = useMemo(
    () => balances.filter((b) => matchesSearch(`${b.name} ${b.customerCode ?? ""} ${b.phone ?? ""}`, q)),
    [balances, q]
  );
  const listRows: (Payment | CustomerBalance)[] =
    tab === "payments" ? paymentRows : tab === "cheques" ? chequeRows : balanceRows;
  const pager = usePagination(listRows, `${tab}|${q}`, 15);

  async function setChequeStatus(p: Payment, status: ChequeStatus) {
    try {
      await api.payments.setChequeStatus(p.id, status);
      toast.success(`چک ${p.chequeNumber}: ${CHEQUE_STATUS_LABELS[status]}`);
      reload();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  async function confirmCancel() {
    if (!cancelling) return;
    setBusy(true);
    try {
      await api.payments.cancel(cancelling.id, cancelReason.trim());
      toast.success(`رسید ${toDisplayDigits(cancelling.number)} باطل شد.`);
      setCancelling(null);
      setCancelReason("");
      reload();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const kpis = [
    { label: "مانده طلب از مشتریان (تومان)", value: receivable, hint: `${toDisplayDigits(balances.filter((b) => b.balance > 0).length)} مشتری بدهکار` },
    { label: "دریافتی این ماه (تومان)", value: receivedThisMonth, hint: `از ${toDisplayDigits(counted.length)} رسید فعال در کل` },
    {
      label: "چک‌های در جریان وصول (تومان)",
      value: pendingCheques.reduce((s, p) => s + p.amount, 0),
      hint: `${toDisplayDigits(pendingCheques.length)} چک · ${toDisplayDigits(pendingCheques.filter((p) => (p.chequeDueDate ?? "") < today).length)} سررسید گذشته`,
    },
  ];

  const rowMenu = (p: Payment) => (
    <DropdownMenu dir="rtl" modal={false}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={`عملیات رسید ${p.number}`} onClick={(e) => e.stopPropagation()}>
          <Ellipsis />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-48">
        {p.method === "CHEQUE" && p.chequeStatus !== "CLEARED" && (
          <DropdownMenuItem onSelect={() => setChequeStatus(p, "CLEARED")}>
            <CircleCheck /> وصول شد
          </DropdownMenuItem>
        )}
        {p.method === "CHEQUE" && p.chequeStatus !== "BOUNCED" && (
          <DropdownMenuItem onSelect={() => setChequeStatus(p, "BOUNCED")}>
            <Undo2 /> برگشت خورد
          </DropdownMenuItem>
        )}
        {p.method === "CHEQUE" && p.chequeStatus !== "PENDING" && (
          <DropdownMenuItem onSelect={() => setChequeStatus(p, "PENDING")}>
            <HandCoins /> بازگشت به در جریان وصول
          </DropdownMenuItem>
        )}
        {p.method === "CHEQUE" && <DropdownMenuSeparator />}
        <DropdownMenuItem variant="destructive" onSelect={() => setCancelling(p)}>
          <Ban /> ابطال رسید
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const party = (p: Payment) =>
    p.customerId ? (
      <Link to={`/customers/${p.customerId}`} className="hover:text-primary">
        {p.customerName}
      </Link>
    ) : (
      (p.payerName ?? "—")
    );

  return (
    <AppShell
      title="دریافت‌ها و چک‌ها"
      actions={
        canWrite && (
          <Button size="sm" onClick={() => setDialogOpen(true)}>
            <Plus /> دریافت وجه
          </Button>
        )
      }
    >
      <div className="space-y-4 p-4 md:space-y-6 md:p-6">
        <div className="grid gap-4 sm:grid-cols-3">
          {kpis.map((k, i) => (
            <Card key={k.label} className={cn("gap-2", REVEAL)} style={stagger(i)}>
              <CardHeader>
                <CardDescription>{k.label}</CardDescription>
                <CardTitle className="font-display text-2xl font-semibold tabular-nums">
                  {loading ? <Skeleton className="h-8 w-28" /> : <AnimatedNumber value={k.value} format={formatToman} />}
                </CardTitle>
                <CardDescription className="text-xs">{loading ? "" : k.hint}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <SegmentedControl
            ariaLabel="بخش دریافت‌ها"
            value={tab}
            onValueChange={(v) => setQuery({ tab: v === "payments" ? null : v })}
            items={[
              { value: "payments", label: "رسیدهای دریافت" },
              { value: "cheques", label: `چک‌ها (${toDisplayDigits(pendingCheques.length)})` },
              { value: "balances", label: "مانده حساب مشتریان" },
            ]}
          />
          <div className="relative w-full sm:w-72">
            <Search className="absolute top-2.5 right-2.5 size-4 text-muted-foreground" />
            <Input placeholder="جستجو..." value={q} onChange={(e) => setQ(e.target.value)} className="pr-8" />
          </div>
          <span className="text-sm text-muted-foreground tabular-nums sm:ms-auto">{toDisplayDigits(pager.total)} ردیف</span>
        </div>

        {error && (
          <Alert variant="destructive">
            <TriangleAlert />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="overflow-x-auto rounded-xl border bg-card">
          <table className="mobile-data-table w-full text-sm md:min-w-[760px]">
            <thead className="bg-muted/50 text-muted-foreground">
              {tab === "balances" ? (
                <tr className="border-b">
                  <th className={TH}>مشتری</th>
                  <th className={cn(TH, "w-40")}>جمع فاکتورها</th>
                  <th className={cn(TH, "w-40")}>دریافت‌شده</th>
                  <th className={cn(TH, "w-40")}>مانده</th>
                  <th className={cn(TH, "w-36")}>چک در جریان</th>
                  <th className="w-12" />
                </tr>
              ) : (
                <tr className="border-b">
                  <th className={cn(TH, "w-20")}>{tab === "cheques" ? "سررسید" : "شماره"}</th>
                  <th className={cn(TH, "w-28")}>{tab === "cheques" ? "شماره چک" : "تاریخ"}</th>
                  <th className={TH}>طرف حساب</th>
                  <th className={cn(TH, "w-28")}>{tab === "cheques" ? "بانک" : "نوع"}</th>
                  <th className={cn(TH, "w-36")}>مبلغ (تومان)</th>
                  <th className={cn(TH, "w-24")}>فاکتور</th>
                  <th className={cn(TH, "w-32")}>وضعیت</th>
                  <th className="w-12" />
                </tr>
              )}
            </thead>
            <tbody className="divide-y">
              {loading &&
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    <td colSpan={8} className="px-3 py-3">
                      <Skeleton className="h-4 w-full" />
                    </td>
                  </tr>
                ))}
              {!loading && pager.total === 0 && (
                <tr>
                  <td colSpan={8} className="px-3 py-14 text-center text-muted-foreground">
                    {tab === "balances"
                      ? "هنوز فاکتوری برای مشتریِ ثبت‌شده صادر نشده است."
                      : tab === "cheques"
                        ? "چک فعالی ثبت نشده است."
                        : "هنوز دریافتی ثبت نشده است. با «دریافت وجه» شروع کنید."}
                  </td>
                </tr>
              )}
              {!loading &&
                tab === "balances" &&
                (pager.pageRows as CustomerBalance[]).map((b) => (
                  <tr key={b.customerId} className="hover:bg-muted/40">
                    <td data-label="مشتری" className="px-3 py-2 font-medium">
                      <Link to={`/customers/${b.customerId}`} className="hover:text-primary">
                        {b.name}
                      </Link>
                      {b.customerCode && <span className="ms-2 text-xs text-muted-foreground tabular-nums">{b.customerCode}</span>}
                    </td>
                    <td data-label="جمع فاکتورها" className="px-3 py-2 tabular-nums">{formatToman(b.invoiced)}</td>
                    <td data-label="دریافت‌شده" className="px-3 py-2 tabular-nums">{formatToman(b.paid)}</td>
                    <td data-label="مانده" className={cn("px-3 py-2 font-semibold tabular-nums", b.balance > 0 ? "text-destructive" : "text-emerald-700 dark:text-emerald-300")}>
                      {formatToman(Math.abs(b.balance))} {b.balance > 0 ? "بدهکار" : b.balance < 0 ? "بستانکار" : "تسویه"}
                    </td>
                    <td data-label="چک در جریان" className="px-3 py-2 tabular-nums text-muted-foreground">
                      {b.pendingCheques ? formatToman(b.pendingCheques) : "—"}
                    </td>
                    <td />
                  </tr>
                ))}
              {!loading &&
                tab !== "balances" &&
                (pager.pageRows as Payment[]).map((p) => {
                  const cancelled = p.status === "CANCELLED";
                  const overdue = p.chequeStatus === "PENDING" && (p.chequeDueDate ?? "") < today;
                  return (
                    <tr key={p.id} className={cn("hover:bg-muted/40", cancelled && "text-muted-foreground line-through decoration-1")}>
                      <td data-label={tab === "cheques" ? "سررسید" : "شماره"} className={cn("px-3 py-2 tabular-nums", overdue && "font-semibold text-destructive")}>
                        {tab === "cheques" ? day(p.chequeDueDate) : toDisplayDigits(p.number)}
                      </td>
                      <td data-label={tab === "cheques" ? "شماره چک" : "تاریخ"} className="px-3 py-2 tabular-nums">
                        {tab === "cheques" ? <bdi dir="ltr">{p.chequeNumber}</bdi> : day(p.paidAt)}
                      </td>
                      <td data-label="طرف حساب" className="px-3 py-2 font-medium">{party(p)}</td>
                      <td data-label={tab === "cheques" ? "بانک" : "نوع"} className="px-3 py-2">
                        {tab === "cheques" ? (p.chequeBank ?? "—") : PAYMENT_METHOD_LABELS[p.method]}
                      </td>
                      <td data-label="مبلغ" className="px-3 py-2 font-semibold tabular-nums">{formatToman(p.amount)}</td>
                      <td data-label="فاکتور" className="px-3 py-2 tabular-nums">
                        {p.document ? (
                          <Link to={`/documents/invoice/${p.document.id}`} className="text-primary hover:underline">
                            {toDisplayDigits(p.document.number)}
                          </Link>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td data-label="وضعیت" className="px-3 py-2">
                        {cancelled ? (
                          <Badge variant="outline" title={p.cancelReason ?? undefined}>باطل شده</Badge>
                        ) : p.chequeStatus ? (
                          <Badge variant="outline" className={CHEQUE_TONE[p.chequeStatus]}>
                            {overdue ? "سررسید گذشته" : CHEQUE_STATUS_LABELS[p.chequeStatus]}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className={CHEQUE_TONE.CLEARED}>دریافت شد</Badge>
                        )}
                      </td>
                      <td className="px-1.5 py-1">{canWrite && !cancelled && rowMenu(p)}</td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
        {!loading && (
          <ListPagination
            page={pager.page}
            pageCount={pager.pageCount}
            total={pager.total}
            pageSize={pager.pageSize}
            onPageChange={pager.setPage}
          />
        )}
        {!loading && tab === "payments" && (
          <p className="text-xs text-muted-foreground">
            جمع رسیدهای فعال: {formatToman(counted.reduce((s, p) => s + p.amount, 0))} تومان از {formatNumber(counted.length)} رسید.
            رسید اشتباه حذف نمی‌شود؛ باطل می‌شود تا سابقه بماند.
          </p>
        )}
      </div>

      <PaymentDialog open={dialogOpen} onOpenChange={setDialogOpen} onSaved={reload} />

      <AlertDialog open={cancelling !== null} onOpenChange={(o) => !busy && !o && setCancelling(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ابطال رسید {cancelling && toDisplayDigits(cancelling.number)}</AlertDialogTitle>
            <AlertDialogDescription>
              رسید باطل‌شده دیگر در مانده حساب و گزارش‌ها حساب نمی‌شود و قابل برگشت نیست.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="pay-cancel-reason">دلیل ابطال</Label>
            <Textarea id="pay-cancel-reason" rows={2} value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>انصراف</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={busy || !cancelReason.trim()}
              onClick={(e) => {
                e.preventDefault();
                confirmCancel();
              }}
            >
              <Ban /> ابطال رسید
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}
