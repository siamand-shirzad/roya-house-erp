import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Tags } from "lucide-react";

import { AnimatedNumber } from "@/components/animated-number";
import {
  Card,
  CardAction,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { DocumentTypeIcon } from "@/lib/icons";
import { formatNumber, formatToman } from "@/lib/format";
import { REVEAL, stagger } from "@/lib/motion";
import { cn } from "@/lib/utils";
import type { Document, Product } from "@/types";

function StatCard({
  label,
  value,
  footer,
  icon,
  to,
  loading,
  index,
}: {
  label: string;
  value: ReactNode;
  footer: string;
  icon: ReactNode;
  to: string;
  loading: boolean;
  index: number;
}) {
  return (
    <Link
      to={to}
      className={cn("group rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", REVEAL)}
      style={stagger(index)}
    >
      <Card className="@container/card h-full gap-4 transition-[border-color,box-shadow,translate] duration-200 ease-out group-hover:border-primary/30 group-hover:shadow-md motion-safe:group-hover:-translate-y-0.5">
        <CardHeader>
          <CardDescription>{label}</CardDescription>
          <CardTitle className="text-2xl font-bold tabular-nums @[250px]/card:text-3xl">
            {loading ? <Skeleton className="h-8 w-24" /> : value}
          </CardTitle>
          <CardAction>
            <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary transition-transform duration-200 [&>svg]:size-4.5 motion-safe:group-hover:scale-110">
              {icon}
            </div>
          </CardAction>
        </CardHeader>
        <CardFooter className="text-sm text-muted-foreground">{footer}</CardFooter>
      </Card>
    </Link>
  );
}

// Headline counts. The dashboard loads documents and products once and passes
// them down; these cards used to fetch four lists of their own.
export function SectionCards({
  documents,
  products,
  loading,
}: {
  documents: Document[];
  products: Product[];
  loading: boolean;
}) {
  const issuedInvoices = documents.filter((d) => d.type === "INVOICE" && d.status === "ISSUED");
  const invoiceTotal = issuedInvoices.reduce((sum, d) => sum + d.totals.grandTotal, 0);
  const count = (type: Document["type"]) => documents.filter((d) => d.type === type).length;

  return (
    <div className="grid grid-cols-1 gap-4 px-4 lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
      <StatCard
        index={0}
        label="جمع فاکتورهای صادرشده (تومان)"
        value={<AnimatedNumber value={invoiceTotal} format={formatToman} />}
        footer={`${formatNumber(issuedInvoices.length)} فاکتور صادرشده`}
        icon={<DocumentTypeIcon type="INVOICE" />}
        to="/documents/invoice"
        loading={loading}
      />
      <StatCard
        index={1}
        label="پیش فاکتورها"
        value={<AnimatedNumber value={count("PROFORMA")} format={formatNumber} />}
        footer="پیش فاکتور (Proforma Invoice)"
        icon={<DocumentTypeIcon type="PROFORMA" />}
        to="/documents/proforma"
        loading={loading}
      />
      <StatCard
        index={2}
        label="حواله‌های خروج از انبار"
        value={<AnimatedNumber value={count("GOODS_ISSUE")} format={formatNumber} />}
        footer="حواله خروج از انبار کالا"
        icon={<DocumentTypeIcon type="GOODS_ISSUE" />}
        to="/documents/goods-issue"
        loading={loading}
      />
      <StatCard
        index={3}
        label="کالاهای فهرست قیمت"
        value={<AnimatedNumber value={products.length} format={formatNumber} />}
        footer="کالای فعال در کاتالوگ رویا هاوس"
        icon={<Tags />}
        to="/products"
        loading={loading}
      />
    </div>
  );
}
