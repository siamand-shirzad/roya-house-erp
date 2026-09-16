import { can, canAccessPath } from "@/lib/permissions";
import { useAuth } from "@/components/auth-provider";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowUpLeft } from "lucide-react";

import { AnimatedNumber } from "@/components/animated-number";
import { periodTrend, pointTrend, TrendBadge, type Trend } from "@/components/trend-badge";
import { Card, CardAction, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatNumber, formatToman, toDisplayDigits } from "@/lib/format";
import { REVEAL, stagger } from "@/lib/motion";
import { stockLevel } from "@/lib/stock";
import { cn } from "@/lib/utils";
import type { Document, StockRow } from "@/types";

const DAY_MS = 86_400_000;
const MAX_CARDS = 4;

type Kpi = {
  key: string;
  label: string;
  value: ReactNode;
  /** The comparison line under the value: "<previous> <context>". */
  previous?: ReactNode;
  context: string;
  trend?: Trend | null;
  to: string;
  failed?: boolean;
};

function KpiCard({ kpi, loading, index }: { kpi: Kpi; loading: boolean; index: number }) {
  return (
    <Link
      to={kpi.to}
      className={cn("group rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", REVEAL)}
      style={stagger(index)}
    >
      <Card className="h-full gap-3 transition-[border-color,box-shadow,translate] duration-200 ease-out group-hover:border-primary/30 group-hover:shadow-md motion-safe:group-hover:-translate-y-0.5">
        <CardHeader>
          <CardDescription>{kpi.label}</CardDescription>
          <CardAction>
            {/* RTL: "open" points up and to the reading end. */}
            <ArrowUpLeft className="size-4 text-muted-foreground transition-transform duration-200 group-hover:text-foreground motion-safe:group-hover:-translate-x-0.5 motion-safe:group-hover:-translate-y-0.5" />
          </CardAction>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex flex-wrap items-center gap-3">
            <div className="font-display text-3xl leading-none font-semibold tracking-tight tabular-nums">
              {loading ? <Skeleton className="h-8 w-24" /> : kpi.failed ? <span className="text-muted-foreground">—</span> : kpi.value}
            </div>
            {!loading && !kpi.failed && kpi.trend && <TrendBadge {...kpi.trend} title="نسبت به دوره‌ی قبل" />}
          </div>
          <div className={cn("text-sm", kpi.failed && "text-destructive")}>
            {loading ? (
              <Skeleton className="h-4 w-32" />
            ) : kpi.failed ? (
              "دریافت اطلاعات ناموفق بود"
            ) : (
              <>
                {kpi.previous !== undefined && <span className="font-medium tabular-nums text-foreground">{kpi.previous} </span>}
                <span className="text-muted-foreground">{kpi.context}</span>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : null);
const pctLabel = (n: number | null) => (n === null ? "—" : `${toDisplayDigits(n)}%`);

// Headline figures for the last 30 days, each compared with the 30 days
// before. Cards the user can't open are dropped and the first four remaining
// are shown, so a warehouse user sees goods issues and stock rather than
// empty slots.
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
  const { user } = useAuth();

  const now = Date.now();
  const last = [now - 30 * DAY_MS, now] as const;
  const prev = [now - 60 * DAY_MS, now - 30 * DAY_MS] as const;
  const issued = (type: Document["type"], [start, end]: readonly [number, number]) =>
    documents.filter((d) => {
      if (d.type !== type || d.status !== "ISSUED") return false;
      const t = new Date(d.issueDate).getTime();
      return t >= start && t < end;
    });
  const sum = (docs: Document[]) => docs.reduce((s, d) => s + d.totals.grandTotal, 0);
  const converted = (docs: Document[]) =>
    docs.filter((d) => d.derived?.some((x) => x.type === "INVOICE" && x.status !== "CANCELLED")).length;

  const salesNow = sum(issued("INVOICE", last));
  const salesPrev = sum(issued("INVOICE", prev));
  const proformasNow = issued("PROFORMA", last);
  const proformasPrev = issued("PROFORMA", prev);
  const conversionNow = pct(converted(proformasNow), proformasNow.length);
  const conversionPrev = pct(converted(proformasPrev), proformasPrev.length);
  const issuesNow = issued("GOODS_ISSUE", last).length;
  const issuesPrev = issued("GOODS_ISSUE", prev).length;
  const lowStock = stock.filter((r) => stockLevel(r) !== "ok").length;

  const kpis: Kpi[] = [
    {
      key: "sales",
      label: "فروش 30 روز اخیر (تومان)",
      value: <AnimatedNumber value={salesNow} format={formatToman} />,
      previous: formatToman(salesPrev),
      context: "در 30 روز قبل",
      trend: periodTrend(salesNow, salesPrev),
      to: "/documents/invoice",
      failed: documentsFailed,
    },
    {
      key: "proformas",
      label: "پیش‌فاکتورهای صادرشده",
      value: <AnimatedNumber value={proformasNow.length} format={formatNumber} />,
      previous: formatNumber(proformasPrev.length),
      context: "در 30 روز قبل",
      trend: periodTrend(proformasNow.length, proformasPrev.length),
      to: "/documents/proforma",
      failed: documentsFailed,
    },
    {
      key: "conversion",
      label: "تبدیل پیش‌فاکتور به فاکتور",
      value: pctLabel(conversionNow),
      previous: pctLabel(conversionPrev),
      context: "در 30 روز قبل",
      trend: pointTrend(conversionNow, conversionPrev),
      to: "/documents/proforma",
      failed: documentsFailed,
    },
    {
      key: "issues",
      label: "حواله‌های خروج صادرشده",
      value: <AnimatedNumber value={issuesNow} format={formatNumber} />,
      previous: formatNumber(issuesPrev),
      context: "در 30 روز قبل",
      trend: periodTrend(issuesNow, issuesPrev),
      to: "/documents/goods-issue",
      failed: documentsFailed,
    },
    {
      key: "stock",
      label: "کالاهای زیر حداقل موجودی",
      value: <AnimatedNumber value={lowStock} format={formatNumber} />,
      context: `منفی یا کمتر از حداقل · از ${formatNumber(stock.length)} کالا`,
      to: lowStock ? "/inventory?low=1" : "/inventory",
      failed: stockFailed,
    },
  ];

  // Five candidates, four slots: people who write goods issues but not
  // invoices (the warehouse) get the goods-issue card instead of conversion.
  const warehouseFirst = can(user, "goods_issue", true) && !can(user, "invoice", true);
  const dropped = warehouseFirst ? "conversion" : "issues";
  const visible = kpis.filter((k) => canAccessPath(user, k.to));
  const shown = visible.length > MAX_CARDS ? visible.filter((k) => k.key !== dropped).slice(0, MAX_CARDS) : visible;

  return (
    <div className="grid grid-cols-1 gap-4 @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
      {shown.map((kpi, i) => (
        <KpiCard key={kpi.key} kpi={kpi} loading={loading} index={i} />
      ))}
    </div>
  );
}
