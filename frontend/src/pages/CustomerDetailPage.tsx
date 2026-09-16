import { can, type Module } from "@/lib/permissions";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Plus, RotateCw } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/components/auth-provider";
import { StatusBadge } from "@/components/documents/StatusBadge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { api, errorMessage } from "@/lib/api";
import { TYPE_TO_SLUG } from "@/lib/documentTypeSlug";
import { formatJalaliDate, formatToman } from "@/lib/format";
import { DOCUMENT_TYPE_LABELS, type Customer, type Document } from "@/types";

export function CustomerDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
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
  return (
    <AppShell title={customer?.name ?? "پرونده مشتری"} actions={canSell && <Button asChild size="sm"><Link to={`/documents/proforma/new?customer=${id}`}><Plus /> پیش‌فاکتور جدید</Link></Button>}>
      <div className="flex flex-col gap-4 p-4 md:p-6">
        {loading ? <Skeleton className="h-48 w-full" /> : error ? (
          <Alert variant="destructive"><AlertDescription>{error}<Button variant="outline" size="sm" onClick={() => setVersion((v) => v + 1)}><RotateCw /> تلاش مجدد</Button></AlertDescription></Alert>
        ) : customer && <>
          <div className="grid gap-4 md:grid-cols-2">
            <Card><CardHeader><CardTitle>اطلاعات تماس</CardTitle><CardDescription>{customer.customerCode ? `کد مشتری: ${customer.customerCode}` : "مشخصات مشتری"}</CardDescription></CardHeader>
              <CardContent className="flex flex-col gap-2 text-sm">
                <p>تلفن: <bdi>{customer.phone || "ثبت نشده"}</bdi></p>
                <p>شهر: {customer.city || "ثبت نشده"}</p><p>نشانی: {customer.address || "ثبت نشده"}</p>
              </CardContent></Card>
            <Card><CardHeader><CardTitle>فروش صادرشده (تومان)</CardTitle><CardDescription>تمام دوره‌ها · فقط فاکتورهای صادرشده</CardDescription></CardHeader>
              <CardContent><p className="text-2xl font-semibold tabular-nums">{formatToman(sales)}</p><p className="mt-2 text-sm text-muted-foreground">این مبلغ جمع فروش است؛ مانده بدهی مشتری نیست.</p></CardContent>
            </Card>
          </div>
          <Card><CardHeader><CardTitle>تاریخچه اسناد و تحویل</CardTitle><CardDescription>از جدیدترین سند · پیوند هر سند به مراحل قبل و بعد</CardDescription></CardHeader>
            <CardContent className="flex flex-col gap-3">
              {!documents.length && <p className="py-6 text-center text-muted-foreground">هنوز سندی برای این مشتری ثبت نشده است.</p>}
              {documents.map((doc) => <article key={doc.id} className="flex flex-col gap-2 rounded-lg border p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Link className="font-medium underline-offset-4 hover:underline" to={`/documents/${TYPE_TO_SLUG[doc.type]}/${doc.id}`}>{DOCUMENT_TYPE_LABELS[doc.type].short} {doc.number}</Link>
                  <StatusBadge status={doc.status} /><span className="ms-auto text-sm text-muted-foreground">{formatJalaliDate(new Date(doc.issueDate))}</span>
                </div>
                {doc.type !== "GOODS_ISSUE" && <p className="text-sm tabular-nums">{formatToman(doc.totals.grandTotal)} تومان</p>}
                <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                  {doc.source && <Link className="underline" to={`/documents/${TYPE_TO_SLUG[doc.source.type]}/${doc.source.id}`}>سند مبنا: {doc.source.number}</Link>}
                  {doc.derived?.filter((d) => d.status !== "CANCELLED").map((d) => <Link key={d.id} className="underline" to={`/documents/${TYPE_TO_SLUG[d.type]}/${d.id}`}>{DOCUMENT_TYPE_LABELS[d.type].short} {d.number}</Link>)}
                </div>
              </article>)}
            </CardContent>
          </Card>
        </>}
      </div>
    </AppShell>
  );
}
