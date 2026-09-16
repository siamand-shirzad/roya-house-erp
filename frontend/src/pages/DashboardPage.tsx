import { can, type Module } from "@/lib/permissions";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Plus } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/components/auth-provider";
import { ChartAreaInteractive } from "@/components/chart-area-interactive";
import { RecentDocuments } from "@/components/recent-documents";
import { SectionCards } from "@/components/section-cards";
import { Button } from "@/components/ui/button";
import { FollowUpTasks } from "@/components/follow-up-tasks";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { api } from "@/lib/api";
import { TYPE_TO_SLUG } from "@/lib/documentTypeSlug";
import { type Document, type DocumentType, type StockRow } from "@/types";

const CREATE_ORDER: DocumentType[] = ["PROFORMA", "INVOICE", "GOODS_ISSUE"];
const NEW_LABEL: Record<DocumentType, string> = {
  PROFORMA: "پیش‌فاکتور جدید",
  INVOICE: "فاکتور جدید",
  GOODS_ISSUE: "حواله خروج جدید",
};

// Headline cards, the last 30 days of sales, and the most recent documents.
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
      api.documents.list().then((rows) => {
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
      <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
        {(documentsFailed || stockFailed) && <div className="px-4 lg:px-6"><Alert variant="destructive"><AlertDescription>
          دریافت {documentsFailed && stockFailed ? "اسناد و موجودی" : documentsFailed ? "اسناد" : "موجودی"} ناموفق بود.
          <Button variant="outline" size="sm" onClick={retry} disabled={loading}>تلاش مجدد</Button>
        </AlertDescription></Alert></div>}
        <SectionCards
          documents={documents}
          stock={stock}
          loading={loading}
          documentsFailed={documentsFailed}
          stockFailed={stockFailed}
        />
        {!loading && !documentsFailed && user && <div className="px-4 lg:px-6"><FollowUpTasks documents={documents} user={user} /></div>}
        <div className="grid gap-4 px-4 md:gap-6 lg:px-6 @5xl/main:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          {can(user, "invoice") && <ChartAreaInteractive
            invoices={documents.filter((d) => d.type === "INVOICE")}
            loading={loading}
            failed={documentsFailed}
          />}
          <RecentDocuments
            documents={documents}
            loading={loading}
            failed={documentsFailed}
            onRetry={retry}
          />
        </div>
      </div>
    </AppShell>
  );
}
