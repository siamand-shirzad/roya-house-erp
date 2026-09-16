import { can, type Module } from "@/lib/permissions";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Plus } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/components/auth-provider";
import { SalesActivity } from "@/components/dashboard/sales-activity";
import { TopCustomers, TopProducts } from "@/components/dashboard/sales-leaders";
import { RecentDocuments } from "@/components/recent-documents";
import { SectionCards } from "@/components/section-cards";
import { Button } from "@/components/ui/button";
import { FollowUpTasks } from "@/components/follow-up-tasks";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { TYPE_TO_SLUG } from "@/lib/documentTypeSlug";
import { formatJalaliDateLong, toIsoDate } from "@/lib/format";
import { REVEAL } from "@/lib/motion";
import { type Document, type DocumentType, type StockRow } from "@/types";

const CREATE_ORDER: DocumentType[] = ["PROFORMA", "INVOICE", "GOODS_ISSUE"];
const NEW_LABEL: Record<DocumentType, string> = {
  PROFORMA: "پیش‌فاکتور جدید",
  INVOICE: "فاکتور جدید",
  GOODS_ISSUE: "حواله خروج جدید",
};

// Layout after the studio-admin CRM dashboard: greeting, headline cards with
// period comparison, sales activity, follow-ups beside recent documents, then
// the top products and customers.
// Everything comes from two requests (documents, stock) made here and shared by the widgets.
export function DashboardPage() {
  const { user } = useAuth();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [stock, setStock] = useState<StockRow[]>([]);
  const [loading, setLoading] = useState(true);
  // Tracked separately so one failed request doesn't blank the whole page —
  // and, more importantly, so a failed request is never drawn as a confident
  // zero ("no low stock", "no documents") when the truth is "not known".
  const [documentsFailed, setDocumentsFailed] = useState(false);
  const [stockFailed, setStockFailed] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.allSettled([
      // Charts and cards look back at most 12 months; drafts of any age come too.
      api.documents.list({ since: toIsoDate(new Date(Date.now() - 400 * 86_400_000)) }).then((rows) => {
        if (!cancelled) setDocuments(rows);
      }),
      (can(user, "inventory") ? api.inventory.stock() : Promise.resolve([])).then((rows) => {
        if (!cancelled) setStock(rows);
      }),
    ]).then(([docs, rows]) => {
      if (cancelled) return;
      setDocumentsFailed(docs.status === "rejected");
      setStockFailed(rows.status === "rejected");
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [reloadKey, user]);

  const retry = () => setReloadKey((k) => k + 1);

  // The header's "new" button offers the first document type this role can
  // actually create; warehouse staff get a goods issue, not a proforma.
  const canSeeSales = can(user, "invoice");
  const createType = user ? CREATE_ORDER.find((t) => can(user, t.toLowerCase() as Module, true)) : undefined;

  return (
    <AppShell
      title="داشبورد"
      actions={
        createType && (
          <Button asChild size="sm">
            <Link to={`/documents/${TYPE_TO_SLUG[createType]}/new`}>
              <Plus /> {NEW_LABEL[createType]}
            </Link>
          </Button>
        )
      }
    >
      <div className="flex flex-col gap-4 p-4 md:gap-6 md:p-6">
        <section className={cn("flex flex-wrap items-end justify-between gap-2", REVEAL)}>
          <div className="space-y-1">
            <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">
              {user?.fullName ? `سلام، ${user.fullName.split(" ")[0]}` : "نمای کلی فروش"}
            </h2>
            <p className="text-sm text-muted-foreground">
              فروش، تبدیل پیش‌فاکتور و تحویل از انبار در یک نگاه — ارقام فقط از اسناد صادرشده.
            </p>
          </div>
          <p className="text-sm text-muted-foreground tabular-nums">{formatJalaliDateLong(new Date())}</p>
        </section>

        {(documentsFailed || stockFailed) && <Alert variant="destructive"><AlertDescription>
          دریافت {documentsFailed && stockFailed ? "اسناد و موجودی" : documentsFailed ? "اسناد" : "موجودی"} ناموفق بود.
          <Button variant="outline" size="sm" onClick={retry} disabled={loading}>تلاش مجدد</Button>
        </AlertDescription></Alert>}

        <SectionCards
          documents={documents}
          stock={stock}
          loading={loading}
          documentsFailed={documentsFailed}
          stockFailed={stockFailed}
        />

        {canSeeSales && <SalesActivity documents={documents} loading={loading} failed={documentsFailed} />}

        <div className="grid grid-cols-1 gap-4 md:gap-6 @5xl/main:grid-cols-12">
          {user && !documentsFailed && (
            <div className="@5xl/main:col-span-5">
              {loading ? <Skeleton className="h-full min-h-72 w-full rounded-xl" /> : <FollowUpTasks documents={documents} user={user} />}
            </div>
          )}
          <div className={documentsFailed ? "@5xl/main:col-span-12" : "@5xl/main:col-span-7"}>
            <RecentDocuments documents={documents} loading={loading} failed={documentsFailed} onRetry={retry} />
          </div>
        </div>

        {canSeeSales && (
          <div className="grid grid-cols-1 gap-4 md:gap-6 @5xl/main:grid-cols-2">
            <TopProducts documents={documents} loading={loading} failed={documentsFailed} />
            <TopCustomers documents={documents} loading={loading} failed={documentsFailed} />
          </div>
        )}
      </div>
    </AppShell>
  );
}
