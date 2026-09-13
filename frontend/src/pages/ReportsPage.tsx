import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartColumn, Clock, TriangleAlert } from "lucide-react";

import { AnimatedNumber } from "@/components/animated-number";
import { AppShell } from "@/components/app-shell";
import { SegmentedControl } from "@/components/segmented-control";
import { REVEAL, stagger } from "@/lib/motion";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { api, errorMessage } from "@/lib/api";
import {
  formatJalaliDate,
  formatJalaliMonth,
  formatNumber,
  formatToman,
  formatTomanCompact,
  jalaliToGregorian,
  toDisplayDigits,
  toIsoDate,
  toJalali,
} from "@/lib/format";
import { CategoryIcon, DocumentTypeIcon } from "@/lib/icons";
import { cn } from "@/lib/utils";
import { CATEGORY_LABELS, type DocumentType, type ReportFollowUpRow, type SalesReport } from "@/types";

// Sales reports. Every figure counts ISSUED documents only (see
// backend/src/routes/reports.ts). Chart rules follow the dataviz skill: one
// series in one hue with no legend (the title names it), one axis, rounded
// data-ends, a hover tooltip, and a table view; rankings are bars with their
// value printed beside them in text colour.

type Preset = "month" | "lastMonth" | "30d" | "year" | "all";

const PRESETS: { value: Preset; label: string }[] = [
  { value: "month", label: "این ماه" },
  { value: "lastMonth", label: "ماه قبل" },
  { value: "30d", label: "30 روز اخیر" },
  { value: "year", label: "امسال" },
  { value: "all", label: "همه" },
];

type Range = { from?: Date; to?: Date };

const DAY_MS = 86_400_000;
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const parseDay = (day: string) => {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y, m - 1, d);
};

function rangeFor(preset: Preset): Range {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const { jy, jm } = toJalali(today);
  switch (preset) {
    case "month":
      return { from: jalaliToGregorian(jy, jm, 1), to: today };
    case "lastMonth": {
      const [py, pm] = jm === 1 ? [jy - 1, 12] : [jy, jm - 1];
      return { from: jalaliToGregorian(py, pm, 1), to: addDays(jalaliToGregorian(jy, jm, 1), -1) };
    }
    case "30d":
      return { from: addDays(today, -29), to: today };
    case "year":
      return { from: jalaliToGregorian(jy, 1, 1), to: today };
    case "all":
      return {};
  }
}

type Bucket = { key: string; label: string; title: string; total: number; count: number };

// Days with no sales still get a (zero) bar, so gaps read as gaps in time.
// Ranges longer than two months are bucketed by Jalali month instead.
function buildBuckets(report: SalesReport, range: Range): Bucket[] {
  const first = range.from ?? (report.daily[0] ? parseDay(report.daily[0].day) : undefined);
  if (!first) return [];
  const now = new Date();
  const last = range.to ?? new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const byDay = new Map(report.daily.map((r) => [r.day, r]));
  const spanDays = Math.round((last.getTime() - first.getTime()) / DAY_MS) + 1;

  if (spanDays <= 62) {
    const out: Bucket[] = [];
    for (let d = first; d.getTime() <= last.getTime(); d = addDays(d, 1)) {
      const key = toIsoDate(d);
      const row = byDay.get(key);
      const { jm, jd } = toJalali(d);
      out.push({
        key,
        label: toDisplayDigits(`${jm}/${jd}`),
        title: formatJalaliDate(d),
        total: row?.grandTotal ?? 0,
        count: row?.count ?? 0,
      });
    }
    return out;
  }

  const months = new Map<string, Bucket>();
  let { jy, jm } = toJalali(first);
  const end = toJalali(last);
  while (jy < end.jy || (jy === end.jy && jm <= end.jm)) {
    const key = `${jy}-${jm}`;
    months.set(key, { key, label: formatJalaliMonth(jy, jm), title: formatJalaliMonth(jy, jm), total: 0, count: 0 });
    jm += 1;
    if (jm > 12) {
      jm = 1;
      jy += 1;
    }
  }
  for (const row of report.daily) {
    const j = toJalali(parseDay(row.day));
    const bucket = months.get(`${j.jy}-${j.jm}`);
    if (bucket) {
      bucket.total += row.grandTotal;
      bucket.count += row.count;
    }
  }
  return [...months.values()];
}

export function ReportsPage() {
  const [preset, setPreset] = useState<Preset>("month");
  const [report, setReport] = useState<SalesReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const range = useMemo(() => rangeFor(preset), [preset]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    api.reports
      .sales({ from: range.from && toIsoDate(range.from), to: range.to && toIsoDate(range.to) })
      .then((r) => !cancelled && setReport(r))
      .catch((err) => !cancelled && setError(`دریافت گزارش ناموفق بود: ${errorMessage(err)}`))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [range]);

  const buckets = useMemo(() => (report ? buildBuckets(report, range) : []), [report, range]);
  const monthly = buckets.length > 0 && !buckets[0].key.includes("-", 5);
  const sales = report?.sales;
  const conversion = report?.proformas.issued
    ? Math.round((report.proformas.converted / report.proformas.issued) * 100)
    : null;
  const firstLoad = loading && !report;

  return (
    <AppShell title="گزارشات">
      <div className="space-y-4 p-4 md:p-6">
        <div className="flex flex-wrap items-center gap-2">
          <SegmentedControl ariaLabel="بازه‌ی گزارش" items={PRESETS} value={preset} onValueChange={setPreset} />
          <span className="text-sm text-muted-foreground tabular-nums sm:ms-auto">
            {range.from && range.to
              ? `${formatJalaliDate(range.from)} تا ${formatJalaliDate(range.to)}`
              : "از ابتدا تا امروز"}
          </span>
        </div>

        {error && (
          <Alert variant="destructive">
            <TriangleAlert />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className={cn("grid gap-4 sm:grid-cols-2 xl:grid-cols-4", loading && report && "opacity-60 transition-opacity")}>
          <Kpi
            index={0}
            label="فروش (تومان)"
            loading={firstLoad}
            value={sales ? <AnimatedNumber value={sales.grandTotal} format={formatToman} /> : ""}
            hint={
              sales
                ? `شامل ${formatToman(sales.taxTotal)} مالیات، پس از ${formatToman(sales.discountTotal)} تخفیف`
                : ""
            }
          />
          <Kpi
            index={1}
            label="فاکتورهای صادرشده"
            loading={firstLoad}
            value={sales ? <AnimatedNumber value={sales.invoiceCount} format={formatNumber} /> : ""}
            hint={report ? `${toDisplayDigits(report.goodsIssues.issued)} حواله‌ی خروج در همین بازه` : ""}
          />
          <Kpi
            index={2}
            label="میانگین هر فاکتور (تومان)"
            loading={firstLoad}
            value={sales ? <AnimatedNumber value={sales.averageInvoice} format={formatToman} /> : ""}
            hint="جمع فروش تقسیم بر تعداد فاکتور"
          />
          <Kpi
            index={3}
            label="تبدیل پیش‌فاکتور به فاکتور"
            loading={firstLoad}
            value={
              conversion === null ? "—" : <AnimatedNumber value={conversion} format={(n) => `${toDisplayDigits(n)}%`} />
            }
            hint={
              report
                ? `${toDisplayDigits(report.proformas.converted)} از ${toDisplayDigits(report.proformas.issued)} پیش‌فاکتور صادرشده`
                : ""
            }
          />
        </div>

        <Card className={REVEAL} style={stagger(4)}>
          <CardHeader>
            <CardTitle>روند فروش</CardTitle>
            <CardDescription>
              جمع فاکتورهای صادرشده {monthly ? "در هر ماه" : "در هر روز"} (تومان)
            </CardDescription>
          </CardHeader>
          <CardContent className="px-2 sm:px-6">
            {firstLoad ? (
              <Skeleton className="h-[260px] w-full" />
            ) : !sales || sales.invoiceCount === 0 ? (
              <EmptyState icon={<ChartColumn className="size-6" />}>در این بازه فاکتور صادرشده‌ای نیست.</EmptyState>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={buckets} margin={{ top: 8, right: 8, left: 8, bottom: 0 }} barCategoryGap={2}>
                    <CartesianGrid vertical={false} stroke="var(--border)" />
                    <XAxis
                      dataKey="label"
                      reversed
                      tickLine={false}
                      axisLine={false}
                      tickMargin={8}
                      minTickGap={16}
                      interval="preserveStartEnd"
                      tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                    />
                    <YAxis
                      orientation="right"
                      width={56}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={formatTomanCompact}
                      tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                    />
                    <Tooltip
                      cursor={{ fill: "var(--muted)", opacity: 0.6 }}
                      contentStyle={{
                        background: "var(--popover)",
                        border: "1px solid var(--border)",
                        borderRadius: "var(--radius)",
                        color: "var(--popover-foreground)",
                        direction: "rtl",
                        fontFamily: "inherit",
                      }}
                      formatter={(value, _name, item) => [
                        `${formatToman(Number(value ?? 0))} تومان — ${toDisplayDigits((item?.payload as Bucket)?.count ?? 0)} فاکتور`,
                        "فروش",
                      ]}
                      labelFormatter={(_, payload) => (payload?.[0]?.payload as Bucket | undefined)?.title ?? ""}
                    />
                    <Bar dataKey="total" fill="var(--chart-1)" radius={[4, 4, 0, 0]} maxBarSize={28} />
                  </BarChart>
                </ResponsiveContainer>
                <details className="mt-3 px-2 text-sm sm:px-0">
                  <summary className="cursor-pointer text-muted-foreground hover:text-foreground">نمایش جدول</summary>
                  <div className="mt-2 max-h-64 overflow-auto rounded-lg border">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-muted text-muted-foreground">
                        <tr>
                          <th className="px-3 py-2 text-right font-medium">{monthly ? "ماه" : "روز"}</th>
                          <th className="px-3 py-2 text-right font-medium">فاکتور</th>
                          <th className="px-3 py-2 text-right font-medium">فروش (تومان)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {buckets
                          .filter((b) => b.count > 0)
                          .map((b) => (
                            <tr key={b.key}>
                              <td className="px-3 py-1.5 tabular-nums">{b.title}</td>
                              <td className="px-3 py-1.5 tabular-nums">{toDisplayDigits(b.count)}</td>
                              <td className="px-3 py-1.5 tabular-nums">{formatToman(b.total)}</td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </details>
              </>
            )}
          </CardContent>
        </Card>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card className={REVEAL} style={stagger(5)}>
            <CardHeader>
              <CardTitle>مشتریان برتر</CardTitle>
              <CardDescription>بیشترین مبلغ فاکتور در این بازه (تومان)</CardDescription>
            </CardHeader>
            <CardContent>
              {firstLoad ? (
                <ListSkeleton />
              ) : report && report.topCustomers.length > 0 ? (
                <BarList
                  rows={report.topCustomers.map((c) => ({
                    key: `${c.customerId ?? ""}-${c.name}`,
                    label: c.name,
                    sublabel: `${toDisplayDigits(c.invoiceCount)} فاکتور`,
                    value: c.grandTotal,
                    valueLabel: formatToman(c.grandTotal),
                  }))}
                />
              ) : (
                <EmptyState>فروشی در این بازه ثبت نشده است.</EmptyState>
              )}
            </CardContent>
          </Card>

          <Card className={REVEAL} style={stagger(6)}>
            <CardHeader>
              <CardTitle>کالاهای پرفروش</CardTitle>
              <CardDescription>مبلغ فروش پس از تخفیف و بدون مالیات (تومان)</CardDescription>
            </CardHeader>
            <CardContent>
              {firstLoad ? (
                <ListSkeleton />
              ) : report && report.topProducts.length > 0 ? (
                <BarList
                  rows={report.topProducts.map((p) => ({
                    key: `${p.productId ?? ""}-${p.name}-${p.unit}`,
                    label: p.name,
                    sublabel: `${formatNumber(p.quantity)} ${p.unit}`,
                    value: p.amount,
                    valueLabel: formatToman(p.amount),
                  }))}
                />
              ) : (
                <EmptyState>فروشی در این بازه ثبت نشده است.</EmptyState>
              )}
            </CardContent>
          </Card>
        </div>

        <Card className={REVEAL} style={stagger(7)}>
          <CardHeader>
            <CardTitle>فروش به تفکیک دسته‌بندی</CardTitle>
            <CardDescription>مبلغ فروش پس از تخفیف و بدون مالیات (تومان)</CardDescription>
          </CardHeader>
          <CardContent>
            {firstLoad ? (
              <ListSkeleton />
            ) : report && report.categories.length > 0 ? (
              <BarList
                rows={(() => {
                  const total = report.categories.reduce((sum, c) => sum + c.amount, 0) || 1;
                  return report.categories.map((c) => ({
                    key: c.category,
                    label: (
                      <span className="inline-flex items-center gap-2">
                        <CategoryIcon category={c.category} className="size-4 text-muted-foreground" />
                        {CATEGORY_LABELS[c.category] ?? c.category}
                      </span>
                    ),
                    sublabel: `${toDisplayDigits(Math.round((c.amount / total) * 100))}%`,
                    value: c.amount,
                    valueLabel: formatToman(c.amount),
                  }));
                })()}
              />
            ) : (
              <EmptyState>فروشی در این بازه ثبت نشده است.</EmptyState>
            )}
          </CardContent>
        </Card>

        <div className="grid gap-4 lg:grid-cols-2">
          <FollowUpCard
            type="PROFORMA"
            title="پیش‌فاکتورهای باز"
            description="صادر شده ولی هنوز به فاکتور تبدیل نشده — مشتری را پیگیری کنید."
            data={report?.openProformas}
            loading={firstLoad}
            emptyText="همه‌ی پیش‌فاکتورهای صادرشده به فاکتور تبدیل شده‌اند."
          />
          <FollowUpCard
            type="INVOICE"
            title="فاکتورهای بدون حواله"
            description="فاکتور صادر شده ولی هنوز حواله‌ی خروجِ صادرشده ندارد — کالا از انبار خارج نشده است."
            data={report?.undeliveredInvoices}
            loading={firstLoad}
            emptyText="برای همه‌ی فاکتورهای صادرشده حواله ثبت شده است."
          />
        </div>
      </div>
    </AppShell>
  );
}

function Kpi({
  label,
  value,
  hint,
  loading,
  index,
}: {
  label: string;
  value: ReactNode;
  hint: string;
  loading: boolean;
  index: number;
}) {
  return (
    <Card className={cn("gap-2", REVEAL)} style={stagger(index)}>
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-2xl font-bold tabular-nums">
          {loading ? <Skeleton className="h-8 w-28" /> : value}
        </CardTitle>
      </CardHeader>
      <CardContent className="text-xs text-muted-foreground">
        {loading ? <Skeleton className="h-3 w-40" /> : hint}
      </CardContent>
    </Card>
  );
}

type BarRow = { key: string; label: ReactNode; sublabel?: string; value: number; valueLabel: string };

function BarList({ rows }: { rows: BarRow[] }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ol className="space-y-3">
      {rows.map((r) => (
        <li key={r.key} className="space-y-1.5">
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 truncate">
              {r.label}
              {r.sublabel && <span className="ms-2 text-xs text-muted-foreground tabular-nums">{r.sublabel}</span>}
            </span>
            <span className="shrink-0 font-medium tabular-nums">{r.valueLabel}</span>
          </div>
          <div className="h-2 rounded-full bg-muted" aria-hidden>
            <div
              className="h-full rounded-full bg-chart-1 motion-safe:animate-bar-grow"
              style={{ width: `${Math.max(2, (r.value / max) * 100)}%` }}
            />
          </div>
        </li>
      ))}
    </ol>
  );
}

function FollowUpCard({
  type,
  title,
  description,
  data,
  loading,
  emptyText,
}: {
  type: DocumentType;
  title: string;
  description: string;
  data?: { total: number; rows: ReportFollowUpRow[] };
  loading: boolean;
  emptyText: string;
}) {
  const slug = type === "PROFORMA" ? "proforma" : "invoice";
  return (
    <Card className={REVEAL} style={stagger(8)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DocumentTypeIcon type={type} className="size-5 text-muted-foreground" />
          {title}
          {data && data.total > 0 && (
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium tabular-nums text-muted-foreground">
              {toDisplayDigits(data.total)}
            </span>
          )}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <ListSkeleton />
        ) : !data || data.rows.length === 0 ? (
          <EmptyState>{emptyText}</EmptyState>
        ) : (
          <div className="max-h-80 overflow-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-muted text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-right font-medium">شماره</th>
                  <th className="px-3 py-2 text-right font-medium">خریدار</th>
                  <th className="px-3 py-2 text-right font-medium">مبلغ (تومان)</th>
                  <th className="px-3 py-2 text-right font-medium">گذشته</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {data.rows.map((row) => (
                  <tr key={row.id} className="hover:bg-muted/40">
                    <td className="px-3 py-1.5 font-medium tabular-nums">
                      <Link to={`/documents/${slug}/${row.id}`} className="hover:text-primary hover:underline">
                        {toDisplayDigits(row.number)}
                      </Link>
                    </td>
                    <td className="max-w-40 truncate px-3 py-1.5">{row.buyerName || "—"}</td>
                    <td className="px-3 py-1.5 tabular-nums">{formatToman(row.grandTotal)}</td>
                    <td className="px-3 py-1.5">
                      <AgeLabel days={row.ageDays} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {data && data.total > data.rows.length && (
          <p className="mt-2 text-xs text-muted-foreground">
            {toDisplayDigits(data.rows.length)} مورد قدیمی‌تر از {toDisplayDigits(data.total)} نمایش داده شده است.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// Warning is a status, so it carries an icon and words, never colour alone.
function AgeLabel({ days }: { days: number }) {
  const text = days === 0 ? "امروز" : `${toDisplayDigits(days)} روز`;
  if (days <= 30) return <span className="text-muted-foreground tabular-nums">{text}</span>;
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-amber-600/25 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800 tabular-nums dark:border-amber-400/25 dark:bg-amber-400/10 dark:text-amber-300">
      <Clock className="size-3.5" /> {text}
    </span>
  );
}

function EmptyState({ children, icon }: { children: ReactNode; icon?: ReactNode }) {
  return (
    <div className="flex min-h-32 flex-col items-center justify-center gap-2 text-center text-sm text-muted-foreground">
      {icon}
      {children}
    </div>
  );
}

function ListSkeleton() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="space-y-1.5">
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-2 w-full" />
        </div>
      ))}
    </div>
  );
}
