import { canAccessPath } from "@/lib/permissions";
import { useAuth } from "@/components/auth-provider";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { TrendingDown, TrendingUp, Warehouse } from "lucide-react";

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
import { formatNumber, formatToman, toDisplayDigits } from "@/lib/format";
import { REVEAL, stagger } from "@/lib/motion";
import { stockLevel } from "@/lib/stock";
import { cn } from "@/lib/utils";
import type { Document, StockRow } from "@/types";

const DAY_MS = 86_400_000;

type Trend = { pct: number; up: boolean };

// Percentage change vs. the 30 days before the current 30-day window. Skipped
// (not "0%") when there's nothing to compare against or nothing changed —
// showing a real zero would read as noise, not a fabricated stat.
function periodTrend(current: number, previous: number): Trend | null {
  if (previous <= 0) return null;
  const pct = Math.round(((current - previous) / previous) * 100);
  return pct === 0 ? null : { pct: Math.abs(pct), up: pct > 0 };
}

function TrendBadge({ pct, up }: Trend) {
  const Icon = up ? TrendingUp : TrendingDown;
  return (
    <span
      title="نسبت به ۳۰ روز پیش از آن"
      className={cn(
        "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-xs font-medium tabular-nums",
        up
          ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300"
          : "bg-red-50 text-red-700 dark:bg-red-400/10 dark:text-red-300",
      )}
    >
      <Icon className="size-3" />
      {up ? "+" : "-"}
      {toDisplayDigits(pct)}٪
    </span>
  );
}

function StatCard({
  label,
  value,
  footer,
  icon,
  to,
  loading,
  failed,
  trend,
  index,
}: {
  label: string;
  value: ReactNode;
  footer: string;
  icon: ReactNode;
  to: string;
  loading: boolean;
  /** The request behind this card failed: show that, never a zero. */
  failed?: boolean;
  /** 30-day-over-30-day change, when there's enough history to compare. */
  trend?: Trend | null;
  index: number;
}) {
  const { user } = useAuth();
  if (!canAccessPath(user, to)) return null;
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
            {loading ? <Skeleton className="h-8 w-24" /> : failed ? <span className="text-muted-foreground">—</span> : value}
          </CardTitle>
          <CardAction>
            <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary transition-transform duration-200 [&>svg]:size-4.5 motion-safe:group-hover:scale-110">
              {icon}
            </div>
          </CardAction>
        </CardHeader>
        <CardFooter className={cn("flex items-center justify-between gap-2 text-sm", failed ? "text-destructive" : "text-muted-foreground")}>
          <span>{failed ? "دریافت اطلاعات ناموفق بود" : footer}</span>
          {!loading && !failed && trend && <TrendBadge {...trend} />}
        </CardFooter>
      </Card>
    </Link>
  );
}

// Headline counts. The dashboard loads documents and stock once and passes
// them down; these cards used to fetch four lists of their own.
export function SectionCards({
  documents,
  stock,
  loading,
  documentsFailed,
  stockFailed,
}: {
  documents: Document[];
  /** One row per active product (GET /api/inventory/stock). */
  stock: StockRow[];
  loading: boolean;
  /** Per source, so a stock outage doesn't discredit the document counts. */
  documentsFailed?: boolean;
  stockFailed?: boolean;
}) {
  const lowStock = stock.filter((r) => stockLevel(r) !== "ok").length;
  const issuedInvoices = documents.filter((d) => d.type === "INVOICE" && d.status === "ISSUED");
  const invoiceTotal = issuedInvoices.reduce((sum, d) => sum + d.totals.grandTotal, 0);
  const count = (type: Document["type"]) => documents.filter((d) => d.type === type).length;

  const now = Date.now();
  const last30Start = now - 30 * DAY_MS;
  const prev30Start = now - 60 * DAY_MS;
  const inWindow = (dateStr: string, start: number, end: number) => {
    const t = new Date(dateStr).getTime();
    return t >= start && t < end;
  };
  const sumIn = (docs: Document[], start: number, end: number) =>
    docs.filter((d) => inWindow(d.issueDate, start, end)).reduce((sum, d) => sum + d.totals.grandTotal, 0);
  const countIn = (type: Document["type"], start: number, end: number) =>
    documents.filter((d) => d.type === type && inWindow(d.issueDate, start, end)).length;

  const invoiceTrend = periodTrend(
    sumIn(issuedInvoices, last30Start, now),
    sumIn(issuedInvoices, prev30Start, last30Start),
  );
  const proformaTrend = periodTrend(countIn("PROFORMA", last30Start, now), countIn("PROFORMA", prev30Start, last30Start));
  const goodsIssueTrend = periodTrend(countIn("GOODS_ISSUE", last30Start, now), countIn("GOODS_ISSUE", prev30Start, last30Start));

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
        failed={documentsFailed}
        trend={invoiceTrend}
      />
      <StatCard
        index={1}
        label="پیش فاکتورها"
        value={<AnimatedNumber value={count("PROFORMA")} format={formatNumber} />}
        footer="تمام دوره‌ها · همه وضعیت‌ها"
        icon={<DocumentTypeIcon type="PROFORMA" />}
        to="/documents/proforma"
        loading={loading}
        failed={documentsFailed}
        trend={proformaTrend}
      />
      <StatCard
        index={2}
        label="حواله‌های خروج از انبار"
        value={<AnimatedNumber value={count("GOODS_ISSUE")} format={formatNumber} />}
        footer="تمام دوره‌ها · همه وضعیت‌ها"
        icon={<DocumentTypeIcon type="GOODS_ISSUE" />}
        to="/documents/goods-issue"
        loading={loading}
        failed={documentsFailed}
        trend={goodsIssueTrend}
      />
      <StatCard
        index={3}
        label="کالاهای کم‌موجود"
        value={<AnimatedNumber value={lowStock} format={formatNumber} />}
        footer={`از ${formatNumber(stock.length)} کالای فعال در انبار`}
        icon={<Warehouse />}
        to={lowStock ? "/inventory?low=1" : "/inventory"}
        loading={loading}
        failed={stockFailed}
      />
    </div>
  );
}
