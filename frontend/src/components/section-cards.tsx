import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Tags } from "lucide-react";

import {
  Card,
  CardAction,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { DocumentTypeIcon } from "@/lib/icons";
import { formatToman, toDisplayDigits } from "@/lib/format";
import type { Document, Product } from "@/types";

function StatCard({
  label,
  value,
  footer,
  icon,
  to,
  loading,
}: {
  label: string;
  value: ReactNode;
  footer: string;
  icon: ReactNode;
  to?: string;
  loading: boolean;
}) {
  const card = (
    <Card className="@container/card h-full gap-4 transition-colors group-hover:border-primary/40">
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-2xl font-bold tabular-nums @[250px]/card:text-3xl">
          {loading ? <Skeleton className="h-8 w-24" /> : value}
        </CardTitle>
        <CardAction>
          <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary [&>svg]:size-4.5">
            {icon}
          </div>
        </CardAction>
      </CardHeader>
      <CardFooter className="text-sm text-muted-foreground">{footer}</CardFooter>
    </Card>
  );

  if (!to) return card;
  return (
    <Link
      to={to}
      className="group rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {card}
    </Link>
  );
}

export function SectionCards() {
  const [products, setProducts] = useState<Product[]>([]);
  const [proformas, setProformas] = useState<Document[]>([]);
  const [invoices, setInvoices] = useState<Document[]>([]);
  const [goodsIssues, setGoodsIssues] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.products.list({ active: "true" }).then(setProducts).catch(() => setProducts([])),
      api.documents.list("PROFORMA").then(setProformas).catch(() => setProformas([])),
      api.documents.list("INVOICE").then(setInvoices).catch(() => setInvoices([])),
      api.documents.list("GOODS_ISSUE").then(setGoodsIssues).catch(() => setGoodsIssues([])),
    ]).finally(() => setLoading(false));
  }, []);

  const invoiceTotal = invoices.reduce((sum, d) => sum + d.totals.grandTotal, 0);

  return (
    <div className="grid grid-cols-1 gap-4 px-4 lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
      <StatCard
        label="جمع فاکتورهای فروش (تومان)"
        value={formatToman(invoiceTotal)}
        footer={`${toDisplayDigits(invoices.length)} فاکتور ثبت شده`}
        icon={<DocumentTypeIcon type="INVOICE" />}
        to="/documents/invoice"
        loading={loading}
      />
      <StatCard
        label="پیش فاکتورها"
        value={toDisplayDigits(proformas.length)}
        footer="پیش فاکتور (Proforma Invoice)"
        icon={<DocumentTypeIcon type="PROFORMA" />}
        to="/documents/proforma"
        loading={loading}
      />
      <StatCard
        label="حواله‌های خروج از انبار"
        value={toDisplayDigits(goodsIssues.length)}
        footer="حواله خروج از انبار کالا"
        icon={<DocumentTypeIcon type="GOODS_ISSUE" />}
        to="/documents/goods-issue"
        loading={loading}
      />
      <StatCard
        label="کالاهای فهرست قیمت"
        value={toDisplayDigits(products.length)}
        footer="کالای فعال در کاتالوگ رویا هاوس"
        icon={<Tags />}
        to="/products"
        loading={loading}
      />
    </div>
  );
}
