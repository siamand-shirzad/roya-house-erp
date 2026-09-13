import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Plus } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/components/auth-provider";
import { ChartAreaInteractive } from "@/components/chart-area-interactive";
import { RecentDocuments } from "@/components/recent-documents";
import { SectionCards } from "@/components/section-cards";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { TYPE_TO_SLUG } from "@/lib/documentTypeSlug";
import { DOCUMENT_WRITE_ROLES, type Document, type DocumentType, type Product } from "@/types";

const CREATE_ORDER: DocumentType[] = ["PROFORMA", "INVOICE", "GOODS_ISSUE"];
const NEW_LABEL: Record<DocumentType, string> = {
  PROFORMA: "پیش‌فاکتور جدید",
  INVOICE: "فاکتور جدید",
  GOODS_ISSUE: "حواله خروج جدید",
};

// Headline cards, the last 30 days of sales, and the most recent documents.
// Everything comes from two requests made here and shared by the widgets.
export function DashboardPage() {
  const { user } = useAuth();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.documents.list().then(setDocuments).catch(() => setDocuments([])),
      api.products.list({ active: "true" }).then(setProducts).catch(() => setProducts([])),
    ]).finally(() => setLoading(false));
  }, []);

  // The header's "new" button offers the first document type this role can
  // actually create; warehouse staff get a goods issue, not a proforma.
  const createType = user ? CREATE_ORDER.find((t) => DOCUMENT_WRITE_ROLES[t].includes(user.role)) : undefined;

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
        <SectionCards documents={documents} products={products} loading={loading} />
        <div className="grid gap-4 px-4 md:gap-6 lg:px-6 @5xl/main:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <ChartAreaInteractive invoices={documents.filter((d) => d.type === "INVOICE")} loading={loading} />
          <RecentDocuments documents={documents} loading={loading} />
        </div>
      </div>
    </AppShell>
  );
}
