import { can, type Module } from "@/lib/permissions";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { HandCoins, Plus, RotateCw } from "lucide-react";
import { PaymentDialog } from "@/components/payments/PaymentDialog";
import { PaymentStateBadge } from "@/components/payments/InvoicePaymentsCard";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/components/auth-provider";
import { StatusBadge } from "@/components/documents/StatusBadge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { api, errorMessage } from "@/lib/api";
import { TYPE_TO_SLUG } from "@/lib/documentTypeSlug";
import { formatJalaliDate, formatToman, toDisplayDigits } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  CHEQUE_STATUS_LABELS,
  DOCUMENT_TYPE_LABELS,
  PARTY_KIND_LABELS,
  PAYMENT_METHOD_LABELS,
  type Customer,
  type Document,
  type Payment,
} from "@/types";

export function CustomerDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const canSeePayments = can(user, "payments");
  useEffect(() => {
    if (!canSeePayments || !id) return;
    api.payments.list({ customerId: id }).then(setPayments).catch(() => setPayments([]));
  }, [id, version, canSeePayments]);
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([api.customers.get(id!), api.documents.list({ customerId: id })])
      .then(([buyer, docs]) => {
        if (cancelled) return;
        setCustomer(buyer);
        setDocuments(docs.sort((a, b) => Date.parse(b.issueDate) - Date.parse(a.issueDate)));
      })
      .catch((err) => { if (!cancelled) setError(errorMessage(err)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [id, version]);
  const canSell = user && can(user, "proforma", true);
  const sales = documents.filter((d) => d.type === "INVOICE" && d.status === "ISSUED")
    .reduce((sum, d) => sum + d.totals.grandTotal, 0);
  // Same rule as the API's balances: active payments, bounced cheques excluded.
  const paid = payments
    .filter((p) => p.status === "ACTIVE" && p.chequeStatus !== "BOUNCED")
    .reduce((sum, p) => sum + p.amount, 0);
  const balance = sales - paid;
  return (
    <AppShell
      title={customer?.name ?? "پرونده طرف حساب"}
      actions={
        <>
          {can(user, "payments", true) && customer && (
            <Button size="sm" variant="outline" onClick={() => setPaymentOpen(true)}>
              <HandCoins /> دریافت وجه
            </Button>
          )}
          {canSell && <Button asChild size="sm"><Link to={`/documents/proforma/new?customer=${id}`}><Plus /> پیش‌فاکتور جدید</Link></Button>}
        </>
      }
    >
      <div className="flex flex-col gap-4 p-4 md:p-6">
        {loading ? <Skeleton className="h-48 w-full" /> : error ? (
          <Alert variant="destructive"><AlertDescription>{error}<Button variant="outline" size="sm" onClick={() => setVersion((v) => v + 1)}><RotateCw /> تلاش مجدد</Button></AlertDescription></Alert>
        ) : customer && <>
          <div className="grid gap-4 md:grid-cols-2">
            <Card><CardHeader><CardTitle>اطلاعات تماس</CardTitle><CardDescription>{PARTY_KIND_LABELS[customer.partyKind ?? "CUSTOMER"]}{customer.customerCode ? ` · کد طرف حساب: ${customer.customerCode}` : " · بدون کد سپیدار"}</CardDescription></CardHeader>
              <CardContent className="flex flex-col gap-2 text-sm">
                <p>تلفن: <bdi>{customer.phone || "ثبت نشده"}</bdi></p>
                <p>شهر: {customer.city || "ثبت نشده"}</p><p>نشانی: {customer.address || "ثبت نشده"}</p>
              </CardContent></Card>
            <Card><CardHeader><CardTitle>فروش صادرشده (تومان)</CardTitle><CardDescription>تمام دوره‌ها · فقط فاکتورهای صادرشده</CardDescription></CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold tabular-nums">{formatToman(sales)}</p>
                {canSeePayments ? (
                  <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                    <p className="text-muted-foreground">دریافت‌شده: <span className="font-medium text-foreground tabular-nums">{formatToman(paid)}</span></p>
                    <p className="text-muted-foreground">
                      مانده:{" "}
                      <span className={cn("font-semibold tabular-nums", balance > 0 ? "text-destructive" : "text-emerald-700 dark:text-emerald-300")}>
                        {formatToman(Math.abs(balance))} {balance > 0 ? "بدهکار" : balance < 0 ? "بستانکار" : "تسویه"}
                      </span>
                    </p>
                  </div>
                ) : (
                  <p className="mt-2 text-sm text-muted-foreground">این مبلغ جمع فروش است؛ مانده بدهی مشتری نیست.</p>
                )}
              </CardContent>
            </Card>
          </div>
          <Card><CardHeader><CardTitle>تاریخچه اسناد و تحویل</CardTitle><CardDescription>از جدیدترین سند · پیوند هر سند به مراحل قبل و بعد</CardDescription></CardHeader>
            <CardContent className="flex flex-col gap-3">
              {!documents.length && <p className="py-6 text-center text-muted-foreground">هنوز سندی برای این مشتری ثبت نشده است.</p>}
              {documents.map((doc) => <article key={doc.id} className="flex flex-col gap-2 rounded-lg border p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Link className="font-medium underline-offset-4 hover:underline" to={`/documents/${TYPE_TO_SLUG[doc.type]}/${doc.id}`}>{DOCUMENT_TYPE_LABELS[doc.type].short} {doc.number}</Link>
                  <StatusBadge status={doc.status} /><PaymentStateBadge doc={doc} /><span className="ms-auto text-sm text-muted-foreground">{formatJalaliDate(new Date(doc.issueDate))}</span>
                </div>
                {doc.type !== "GOODS_ISSUE" && <p className="text-sm tabular-nums">{formatToman(doc.totals.grandTotal)} تومان</p>}
                <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                  {doc.source && <Link className="underline" to={`/documents/${TYPE_TO_SLUG[doc.source.type]}/${doc.source.id}`}>سند مبنا: {doc.source.number}</Link>}
                  {doc.derived?.filter((d) => d.status !== "CANCELLED").map((d) => <Link key={d.id} className="underline" to={`/documents/${TYPE_TO_SLUG[d.type]}/${d.id}`}>{DOCUMENT_TYPE_LABELS[d.type].short} {d.number}</Link>)}
                </div>
              </article>)}
            </CardContent>
          </Card>
          {canSeePayments && (
            <Card>
              <CardHeader><CardTitle>دریافت‌ها</CardTitle><CardDescription>رسیدهای دریافت و چک‌های این طرف حساب</CardDescription></CardHeader>
              <CardContent>
                {!payments.length ? (
                  <p className="py-6 text-center text-muted-foreground">دریافتی ثبت نشده است.</p>
                ) : (
                  <ul className="divide-y rounded-md border text-sm">
                    {payments.map((p) => (
                      <li key={p.id} className={cn("flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2", p.status === "CANCELLED" && "text-muted-foreground line-through")}>
                        <span className="tabular-nums">رسید {toDisplayDigits(p.number)}</span>
                        <span>{formatJalaliDate(new Date(`${p.paidAt}T12:00:00`))}</span>
                        <span>{PAYMENT_METHOD_LABELS[p.method]}</span>
                        {p.chequeStatus && <span className="text-xs text-muted-foreground">({CHEQUE_STATUS_LABELS[p.chequeStatus]})</span>}
                        {p.document && <Link className="text-primary underline-offset-4 hover:underline" to={`/documents/invoice/${p.document.id}`}>فاکتور {toDisplayDigits(p.document.number)}</Link>}
                        <span className="ms-auto font-semibold tabular-nums">{formatToman(p.amount)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          )}
          <PaymentDialog
            open={paymentOpen}
            onOpenChange={setPaymentOpen}
            preset={{ customer: { id: customer.id, name: customer.name } }}
            onSaved={() => setVersion((v) => v + 1)}
          />
        </>}
      </div>
    </AppShell>
  );
}
